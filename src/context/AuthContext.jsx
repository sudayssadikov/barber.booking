import { createContext, useContext, useMemo } from "react";
import { read, write, useStored } from "../lib/store";
import { cancelAllFor, renameIn } from "../lib/bookings";
import { MASTERS } from "../config/content";
import { ROLES, can } from "../lib/roles";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ub:${s}`)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
const hashPw = (phone, pw) => sha(`${phone}:${pw}`);
const ok = { ok: true };
const fail = (error) => ({ ok: false, error });
const LOCK = { tries: 5, ms: 60_000 };
const ROLE_KEYS = Object.keys(ROLES);

export function AuthProvider({ children }) {
  const users = useStored("kb_u", []);
  const sid = useStored("kb_s", null);
  // Sessiya har renderda tekshiriladi: oʻchirilgan yoki bloklangan foydalanuvchi avtomatik chiqadi
  const user = useMemo(() => { const u = users.find((x) => x.id === sid); return u && u.status !== "blocked" ? u : null; }, [users, sid]);
  const needsSetup = users.length === 0;
  const save = (list) => write("kb_u", list);
  const isAdmin = can(user, "users.manage");
  const denied = fail("Ruxsat yoʻq");
  const activeAdmins = (except) => users.filter((u) => u.role === "admin" && u.status !== "blocked" && u.id !== except).length;

  async function login(phone, pw) {
    const locks = read("kb_lock", {});
    const l = locks[phone];
    if (l?.until > Date.now()) return fail(`Koʻp urinish. ${Math.ceil((l.until - Date.now()) / 1000)} soniyadan keyin urinib koʻring.`);
    const h = await hashPw(phone, pw);
    const u = users.find((x) => x.phone === phone && x.hash === h);
    if (!u) {
      const n = (l?.n || 0) + 1;
      write("kb_lock", { ...locks, [phone]: n >= LOCK.tries ? { n: 0, until: Date.now() + LOCK.ms } : { n } });
      return fail("Telefon yoki parol notoʻgʻri");
    }
    if (u.status === "blocked") return fail("Akkaunt bloklangan. Salon bilan bogʻlaning.");
    const { [phone]: _drop, ...rest } = locks;
    write("kb_lock", rest);
    write("kb_s", u.id);
    return { ok: true, user: u };
  }

  async function addUser({ name, phone, pw, role = "client", masterId = null }) {
    if (!name?.trim() || name.trim().length < 2) return fail("Ismni kiriting");
    if (!/^\+998\d{9}$/.test(phone || "")) return fail("Telefon raqam notoʻgʻri");
    if (!pw || pw.length < 6) return fail("Parol kamida 6 ta belgi boʻlsin");
    if (!ROLE_KEYS.includes(role)) return fail("Notoʻgʻri rol");
    if (users.some((u) => u.phone === phone)) return fail("Bu raqam bilan akkaunt allaqachon mavjud");
    if (role === "master" && (!masterId || !MASTERS.some((m) => m.id === masterId) || users.some((u) => u.masterId === masterId))) return fail("Usta profili tanlanmagan yoki boshqa foydalanuvchiga bogʻlangan");
    const u = { id: crypto.randomUUID(), name: name.trim(), phone, hash: await hashPw(phone, pw), role, masterId: role === "master" ? masterId : null, status: "active", createdAt: Date.now() };
    save([...users, u]);
    return { ok: true, user: u };
  }
  // Admin panelidan qoʻshish
  const createUser = (data) => (isAdmin ? addUser(data) : Promise.resolve(denied));
  // Oʻzi roʻyxatdan oʻtish: birinchi foydalanuvchi — admin, qolganlar — mijoz
  async function register(data) {
    const r = await addUser({ name: data.name, phone: data.phone, pw: data.pw, role: needsSetup ? "admin" : "client" });
    if (r.ok) write("kb_s", r.user.id);
    return r;
  }
  const logout = () => write("kb_s", null);

  function setRole(id, role, masterId = null) {
    if (!isAdmin) return denied;
    if (!ROLE_KEYS.includes(role)) return fail("Notoʻgʻri rol");
    const u = users.find((x) => x.id === id);
    if (!u) return fail("Foydalanuvchi topilmadi");
    if (u.id === user?.id) return fail("Oʻz rolingizni oʻzgartira olmaysiz");
    if (u.role === "admin" && role !== "admin" && activeAdmins(id) === 0) return fail("Kamida bitta faol admin qolishi shart");
    if (role === "master" && (!masterId || !MASTERS.some((m) => m.id === masterId) || users.some((x) => x.masterId === masterId && x.id !== id))) return fail("Usta profili tanlanmagan yoki band");
    save(users.map((x) => (x.id === id ? { ...x, role, masterId: role === "master" ? masterId : null } : x)));
    return ok;
  }
  function setBlocked(id, blocked) {
    if (!isAdmin) return denied;
    const u = users.find((x) => x.id === id);
    if (!u) return fail("Foydalanuvchi topilmadi");
    if (u.id === user?.id) return fail("Oʻzingizni bloklay olmaysiz");
    if (blocked && u.role === "admin" && activeAdmins(id) === 0) return fail("Kamida bitta faol admin qolishi shart");
    save(users.map((x) => (x.id === id ? { ...x, status: blocked ? "blocked" : "active" } : x)));
    if (blocked) cancelAllFor(id);
    return ok;
  }
  function removeUser(id) {
    if (!isAdmin) return denied;
    const u = users.find((x) => x.id === id);
    if (!u) return fail("Foydalanuvchi topilmadi");
    if (u.id === user?.id) return fail("Oʻzingizni oʻchira olmaysiz");
    if (u.role === "admin" && activeAdmins(id) === 0) return fail("Kamida bitta faol admin qolishi shart");
    cancelAllFor(id);
    save(users.filter((x) => x.id !== id));
    return ok;
  }
  // Oʻzi uchun joriy parol talab qilinadi; admin boshqalar uchun parolni tiklay oladi
  async function setPassword(id, pw, oldPw) {
    const u = users.find((x) => x.id === id);
    if (!u) return fail("Foydalanuvchi topilmadi");
    if (pw.length < 6) return fail("Parol kamida 6 ta belgi boʻlsin");
    const self = id === user?.id;
    if (!self && !isAdmin) return denied;
    if (self && (await hashPw(u.phone, oldPw || "")) !== u.hash) return fail("Joriy parol notoʻgʻri");
    const hash = await hashPw(u.phone, pw);
    save(users.map((x) => (x.id === id ? { ...x, hash } : x)));
    return ok;
  }
  function rename(id, name) {
    if (id !== user?.id && !isAdmin) return denied;
    const n = (name || "").trim();
    if (n.length < 2) return fail("Ism kamida 2 ta harf boʻlsin");
    if (!users.some((x) => x.id === id)) return fail("Foydalanuvchi topilmadi");
    save(users.map((x) => (x.id === id ? { ...x, name: n } : x)));
    renameIn(id, n);
    return ok;
  }

  return (
    <Ctx.Provider value={{ user, users, needsSetup, login, register, logout, createUser, setRole, setBlocked, removeUser, setPassword, rename }}>
      {children}
    </Ctx.Provider>
  );
}
