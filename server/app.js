import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MASTERS, RULES } from "../shared/config.js";
import {
  DATE_RE, nowTK, inWindow, addD, quote, eligible, slotMap, freeDays, pickMaster, clashes, canCancel, canMark, isPast,
} from "../shared/availability.js";
import { ROLE_KEYS, can, canTransition } from "../shared/roles.js";
import { checkName, checkPhone, checkPassword, firstError } from "../shared/validation.js";
import { tx } from "./db.js";
import { createRepo, toUser } from "./repo.js";
import { HttpError, fail, ensure, valid, body } from "./http.js";
import { hashPassword, verifyPassword, dummyHash, newToken, sha256, parseCookies } from "./security.js";

const SESSION_MS = 30 * 24 * 3600_000;
const LOCK = { tries: 5, ms: 60_000 };
const COOKIE = "sid";

/**
 * @param {object} o
 * @param {import("node:sqlite").DatabaseSync} o.db
 * @param {() => Date} [o.clock]      — testlarda vaqtni boshqarish uchun
 * @param {boolean} [o.secureCookies] — HTTPS ortida true
 * @param {string|null} [o.staticDir] — production'da tayyor frontend (dist/)
 */
export function createApp({ db, clock = () => new Date(), secureCookies = false, staticDir = null }) {
  const repo = createRepo(db);
  const app = express();
  const now = () => nowTK(clock());
  const ms = () => clock().getTime();

  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin" });
    next();
  });

  const api = express.Router();
  app.use("/api", api);
  api.use(express.json({ limit: "16kb" }));
  api.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  // CSRF: oʻzgartiruvchi soʻrovlar maxsus sarlavha bilan kelishi shart.
  // Boshqa saytdan brauzer bu sarlavhani CORS ruxsatisiz yubora olmaydi.
  api.use((req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("X-Requested-With") !== "fetch") fail(403, "Soʻrov rad etildi");
    next();
  });

  // Sessiya: har soʻrovda bazadan tekshiriladi — bloklangan/oʻchirilgan foydalanuvchi darhol chiqariladi
  api.use((req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    req.tokenHash = token ? sha256(token) : null;
    req.user = req.tokenHash ? repo.sessionUser(req.tokenHash, ms()) ?? null : null;
    next();
  });

  const startSession = (res, userId) => {
    const token = newToken();
    repo.insertSession(sha256(token), userId, ms() + SESSION_MS);
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookies, maxAge: SESSION_MS, path: "/" });
  };
  const endSession = (req, res) => {
    if (req.tokenHash) repo.deleteSession(req.tokenHash);
    res.clearCookie(COOKIE, { path: "/" });
  };
  const authed = (req) => { ensure(req.user, 401, "Avval tizimga kiring"); return req.user; };
  const allowed = (req, perm) => { ensure(can(authed(req), perm), 403, "Ruxsat yoʻq"); return req.user; };

  // Foydalanuvchining kelgusi faol bronlarini bekor qilish (bloklash/oʻchirishda). Oʻtganlari tarix sifatida qoladi.
  const cancelUpcomingOf = (userId) => {
    const n = now();
    repo.activeOfUser(userId).filter((b) => !isPast(b, n)).forEach((b) => repo.setStatus(b.id, "cancelled", ms()));
  };

  // ───────────── Auth ─────────────
  api.get("/health", (_req, res) => res.json({ ok: true }));

  api.get("/me", (req, res) => res.json({ user: req.user, needsSetup: repo.userCount() === 0 }));

  const readCredentials = (req, withName) => {
    const { name, phone, pw } = body(req);
    valid(firstError(withName && checkName(name), checkPhone(phone), checkPassword(pw)));
    return { name: withName ? name.trim() : undefined, phone, pw };
  };
  const newUser = (data) => ({ id: randomUUID(), createdAt: ms(), masterId: null, ...data });

  // Birinchi ishga tushish: salon egasi (admin) akkaunti
  api.post("/auth/setup", async (req, res) => {
    const { name, phone, pw } = readCredentials(req, true);
    const u = newUser({ name, phone, pwHash: await hashPassword(pw), role: "admin" });
    tx(db, () => {
      ensure(repo.userCount() === 0, 409, "Tizim allaqachon sozlangan");
      repo.insertUser(u);
    });
    startSession(res, u.id);
    res.status(201).json({ user: toUser(repo.userById(u.id)) });
  });

  api.post("/auth/register", async (req, res) => {
    const { name, phone, pw } = readCredentials(req, true);
    const u = newUser({ name, phone, pwHash: await hashPassword(pw), role: "client" });
    tx(db, () => {
      ensure(repo.userCount() > 0, 409, "Tizim hali sozlanmagan");
      ensure(!repo.userByPhone(phone), 409, "Bu raqam bilan akkaunt allaqachon mavjud");
      repo.insertUser(u);
    });
    startSession(res, u.id);
    res.status(201).json({ user: toUser(repo.userById(u.id)) });
  });

  api.post("/auth/login", async (req, res) => {
    const { phone, pw } = body(req);
    valid(checkPhone(phone));
    ensure(typeof pw === "string" && pw.length > 0 && pw.length <= 128, 400, "Parolni kiriting");
    const lock = repo.attempt(phone);
    if (lock?.locked_until > ms()) fail(429, `Koʻp urinish. ${Math.ceil((lock.locked_until - ms()) / 1000)} soniyadan keyin urinib koʻring.`);
    const row = repo.userByPhone(phone);
    const ok = await verifyPassword(pw, row?.pw_hash ?? (await dummyHash()));
    if (!row || !ok) {
      const fails = (lock?.fails ?? 0) + 1;
      if (fails >= LOCK.tries) repo.setAttempt(phone, 0, ms() + LOCK.ms);
      else repo.setAttempt(phone, fails, 0);
      fail(401, "Telefon yoki parol notoʻgʻri");
    }
    ensure(row.status === "active", 403, "Akkaunt bloklangan. Salon bilan bogʻlaning.");
    repo.clearAttempt(phone);
    startSession(res, row.id);
    res.json({ user: toUser(row) });
  });

  api.post("/auth/logout", (req, res) => { endSession(req, res); res.status(204).end(); });

  api.patch("/me", (req, res) => {
    const u = authed(req);
    const { name } = body(req);
    valid(checkName(name));
    tx(db, () => {
      repo.updateUser({ ...u, name: name.trim() });
      repo.renameIn(u.id, name.trim());
    });
    res.json({ user: toUser(repo.userById(u.id)) });
  });

  api.post("/me/password", async (req, res) => {
    const u = authed(req);
    const { old, next } = body(req);
    valid(checkPassword(next));
    const row = repo.userById(u.id);
    ensure(await verifyPassword(String(old ?? ""), row.pw_hash), 400, "Joriy parol notoʻgʻri");
    repo.setPassword(u.id, await hashPassword(next));
    repo.deleteSessionsOf(u.id, req.tokenHash); // boshqa qurilmalardagi sessiyalar yopiladi
    res.status(204).end();
  });

  // ───────────── Bronlar ─────────────
  const readQuote = (svc) => { const qt = quote(svc); ensure(qt, 400, "Xizmatlar notoʻgʻri tanlangan", "bad_services"); return qt; };
  const readMaster = (master) => {
    ensure(master === "any" || MASTERS.some((m) => m.id === master), 400, "Usta notoʻgʻri tanlangan");
    return master;
  };

  // Ochiq: tanlangan xizmatlar uchun oyna boʻyicha boʻsh vaqtlar (shaxsiy maʼlumotlarsiz)
  api.get("/availability", (req, res) => {
    const qt = readQuote(String(req.query.svc ?? "").split(",").filter(Boolean));
    const pool = eligible(qt.ids, readMaster(String(req.query.master ?? "any")));
    const n = now();
    const busy = repo.activeBetween(n.date, addD(n.date, RULES.AHEAD));
    res.json({ dur: qt.dur, price: qt.price, days: freeDays(pool, qt.dur, busy, n) });
  });

  api.post("/bookings", (req, res) => {
    const u = allowed(req, "book");
    const { svc, master, date, time } = body(req);
    const qt = readQuote(svc);
    const pool = eligible(qt.ids, readMaster(master ?? "any"));
    ensure(pool.length, 400, "Tanlangan xizmatlarni bu usta bajarmaydi", "bad_services");
    const n = now();
    ensure(inWindow(date, n) && Number.isInteger(time), 409, "Sana yoki vaqt eskirgan. Boshqa vaqtni tanlang.", "slot_taken");

    const booking = tx(db, () => {
      const dayBookings = repo.activeOn(date);
      const free = slotMap(pool, date, qt.dur, dayBookings, n)[time];
      ensure(free?.length, 409, "Bu vaqt band boʻlib qoldi. Boshqa vaqtni tanlang.", "slot_taken");
      const mine = repo.activeOfUser(u.id).filter((b) => !isPast(b, n));
      ensure(mine.length < RULES.MAX_ACTIVE, 409, `Bir vaqtda ${RULES.MAX_ACTIVE} tadan ortiq faol yozilish boʻlishi mumkin emas.`);
      ensure(!clashes(mine, date, time, qt.dur), 409, "Bu vaqtda sizda boshqa yozilish bor.");
      const b = {
        id: randomUUID(), userId: u.id, name: u.name, phone: u.phone, masterId: pickMaster(free, dayBookings, date),
        svc: qt.ids, date, start: time, dur: qt.dur, price: qt.price, status: "pending", created: ms(),
      };
      repo.insertBooking(b);
      return repo.bookingById(b.id);
    });
    res.status(201).json({ booking });
  });

  api.get("/bookings/mine", (req, res) => res.json({ items: repo.ofUser(authed(req).id) }));

  api.post("/bookings/:id/cancel", (req, res) => {
    const u = authed(req);
    const b = tx(db, () => {
      const b = repo.bookingById(req.params.id);
      ensure(b && b.userId === u.id, 404, "Bron topilmadi");
      ensure(canCancel(b, now()), 409, `Bekor qilish muddati oʻtgan (${RULES.CANCEL_H} soatdan kam qoldi)`);
      repo.setStatus(b.id, "cancelled", ms());
      return repo.bookingById(b.id);
    });
    res.json({ booking: b });
  });

  // Xodimlar: admin — hamma bronlar, usta — faqat oʻziniki
  const scopeOf = (u) => (can(u, "bookings.all") ? null : u.masterId);
  api.get("/bookings", (req, res) => {
    const u = allowed(req, "bookings.staff");
    const m = scopeOf(u);
    const n = now();
    let items;
    if (req.query.status === "pending") items = repo.pending(n.date, m);
    else {
      const date = String(req.query.date ?? n.date);
      ensure(DATE_RE.test(date), 400, "Sana notoʻgʻri");
      items = repo.onDate(date, m);
    }
    res.json({ items, stats: repo.stats(n.date, m) });
  });

  api.patch("/bookings/:id", (req, res) => {
    const u = allowed(req, "bookings.staff");
    const { status } = body(req);
    const b = tx(db, () => {
      const b = repo.bookingById(req.params.id);
      const m = scopeOf(u);
      ensure(b && (m === null || b.masterId === m), 404, "Bron topilmadi");
      ensure(canTransition(b.status, status), 409, "Bu holatni oʻzgartirib boʻlmaydi");
      ensure(!["done", "noshow"].includes(status) || canMark(b, now()), 409, "Vaqti kelgach belgilanadi");
      repo.setStatus(b.id, status, ms());
      return repo.bookingById(b.id);
    });
    res.json({ booking: b });
  });

  // ───────────── Foydalanuvchilar (admin) ─────────────
  const checkMasterLink = (role, masterId, userId) => {
    if (role !== "master") return null;
    ensure(MASTERS.some((m) => m.id === masterId), 400, "Usta profili tanlanmagan");
    const owner = repo.userByMaster(masterId);
    ensure(!owner || owner.id === userId, 409, "Bu usta profili boshqa foydalanuvchiga bogʻlangan");
    return masterId;
  };
  const target = (id) => { const row = repo.userById(id); ensure(row, 404, "Foydalanuvchi topilmadi"); return row; };
  const keepsAdmin = (row) =>
    ensure(row.role !== "admin" || row.status !== "active" || repo.activeAdminsExcept(row.id) > 0, 409, "Kamida bitta faol admin qolishi shart");

  api.get("/users", (req, res) => { allowed(req, "users.manage"); res.json({ items: repo.users() }); });

  api.post("/users", async (req, res) => {
    allowed(req, "users.manage");
    const { name, phone, pw, role = "client", masterId } = body(req);
    valid(firstError(checkName(name), checkPhone(phone), checkPassword(pw)));
    ensure(ROLE_KEYS.includes(role), 400, "Notoʻgʻri rol");
    const u = newUser({ name: name.trim(), phone, pwHash: await hashPassword(pw), role });
    tx(db, () => {
      ensure(!repo.userByPhone(phone), 409, "Bu raqam bilan akkaunt allaqachon mavjud");
      u.masterId = checkMasterLink(role, masterId, u.id);
      repo.insertUser(u);
    });
    res.status(201).json({ user: toUser(repo.userById(u.id)) });
  });

  api.patch("/users/:id", (req, res) => {
    const me = allowed(req, "users.manage");
    const patch = body(req);
    const user = tx(db, () => {
      const row = target(req.params.id);
      const self = row.id === me.id;
      const next = { id: row.id, name: row.name, role: row.role, masterId: row.master_id, status: row.status };
      if (patch.name !== undefined) { valid(checkName(patch.name)); next.name = patch.name.trim(); }
      if (patch.role !== undefined || patch.masterId !== undefined) {
        const role = patch.role ?? row.role;
        ensure(ROLE_KEYS.includes(role), 400, "Notoʻgʻri rol");
        ensure(!self || role === row.role, 409, "Oʻz rolingizni oʻzgartira olmaysiz");
        next.role = role;
        next.masterId = checkMasterLink(role, patch.masterId ?? row.master_id, row.id);
      }
      if (patch.status !== undefined) {
        ensure(["active", "blocked"].includes(patch.status), 400, "Notoʻgʻri holat");
        ensure(!self || patch.status === row.status, 409, "Oʻzingizni bloklay olmaysiz");
        next.status = patch.status;
      }
      // Rol yoki holat oʻzgarishi oxirgi faol adminni yoʻqotmasin
      if (next.role !== "admin" || next.status !== "active") keepsAdmin(row);
      repo.updateUser(next);
      if (next.name !== row.name) repo.renameIn(row.id, next.name);
      if (next.status === "blocked" && row.status !== "blocked") {
        repo.deleteSessionsOf(row.id);
        cancelUpcomingOf(row.id);
      }
      return toUser(repo.userById(row.id));
    });
    res.json({ user });
  });

  api.post("/users/:id/password", async (req, res) => {
    allowed(req, "users.manage");
    const { pw } = body(req);
    valid(checkPassword(pw));
    const row = target(req.params.id);
    repo.setPassword(row.id, await hashPassword(pw));
    repo.deleteSessionsOf(row.id, req.tokenHash);
    res.status(204).end();
  });

  api.delete("/users/:id", (req, res) => {
    const me = allowed(req, "users.manage");
    tx(db, () => {
      const row = target(req.params.id);
      ensure(row.id !== me.id, 409, "Oʻzingizni oʻchira olmaysiz");
      keepsAdmin(row);
      cancelUpcomingOf(row.id);
      repo.deleteUser(row.id); // sessiyalar CASCADE bilan oʻchadi, bronlar tarixi qoladi
    });
    res.status(204).end();
  });

  api.use((_req, _res, next) => next(new HttpError(404, "Topilmadi")));

  // ───────────── Frontend (production) ─────────────
  if (staticDir && existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir, { index: false, maxAge: "1y", immutable: true, setHeaders: noCacheHtml }));
    app.use((req, res, next) => (req.method === "GET" ? res.set("Cache-Control", "no-cache").sendFile(path.join(staticDir, "index.html")) : next()));
  }

  // Xatolar: kutilgan (HttpError) — matni bilan, kutilmagan — logga yoziladi, foydalanuvchiga tafsilot berilmaydi
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Notoʻgʻri soʻrov" });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Soʻrov juda katta" });
    console.error(err);
    res.status(500).json({ error: "Serverda xatolik. Birozdan keyin urinib koʻring." });
  });

  return app;
}

const noCacheHtml = (res, file) => { if (file.endsWith(".html")) res.set("Cache-Control", "no-cache"); };

export const purgeExpiredSessions = (db, at = Date.now()) => createRepo(db).purgeSessions(at);
