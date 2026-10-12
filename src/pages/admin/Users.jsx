import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import { MASTERS, byMaster } from "../../config/content";
import { ROLES } from "../../lib/roles";
import { phoneDigits } from "../../lib/availability";

const NEW = { name: "", ph: "", pw: "", role: "client", masterId: "" };

export default function Users() {
  const { user: me, users, createUser, setRole, setBlocked, removeUser, setPassword } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [f, setF] = useState(NEW);
  const [resetFor, setResetFor] = useState(null);
  const [newPw, setNewPw] = useState("");
  const say = (r, okMsg) => toast(r.ok ? okMsg : r.error);

  const taken = (id) => users.some((u) => u.masterId === id);
  const list = users.filter((u) => (u.name + u.phone).toLowerCase().includes(q.toLowerCase()));

  async function add(e) {
    e.preventDefault();
    if (f.name.trim().length < 2 || !/^\d{9}$/.test(f.ph) || f.pw.length < 6) return toast("Ism, 9 xonali telefon va kamida 6 belgili parolni toʻgʻri kiriting");
    const r = await createUser({ name: f.name, phone: `+998${f.ph}`, pw: f.pw, role: f.role, masterId: f.role === "master" ? f.masterId : null });
    say(r, "Foydalanuvchi qoʻshildi");
    if (r.ok) setF(NEW);
  }

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 900 }}>
      <h2 style={{ marginBottom: 18 }}>Foydalanuvchilar</h2>

      <form className="card stack" onSubmit={add} style={{ marginBottom: 22 }}>
        <h3>Yangi foydalanuvchi</h3>
        <div className="fr">
          <label>Ism<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Telefon (+998)<input inputMode="numeric" value={f.ph} onChange={(e) => setF({ ...f, ph: phoneDigits(e.target.value) })} /></label>
          <label>Parol<input type="password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} autoComplete="new-password" /></label>
          <label>Rol
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value, masterId: "" })}>
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {f.role === "master" && (
            <label>Usta profili
              <select value={f.masterId} onChange={(e) => setF({ ...f, masterId: e.target.value })}>
                <option value="">Tanlang</option>
                {MASTERS.map((m) => <option key={m.id} value={m.id} disabled={taken(m.id)}>{m.name}{taken(m.id) ? " (band)" : ""}</option>)}
              </select>
            </label>
          )}
        </div>
        <button className="btn sm" style={{ justifySelf: "start" }}>Qoʻshish</button>
      </form>

      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="Ism yoki telefon boʻyicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />
        <span className="mute" style={{ whiteSpace: "nowrap" }}>{list.length} ta</span>
      </div>

      <div className="stack">
        {list.map((u) => {
          const self = u.id === me.id;
          return (
            <div className="card stack" key={u.id}>
              <div className="row">
                <div><b>{u.name}</b>{self && <span className="mute"> (siz)</span>}<div className="mute">{u.phone}</div></div>
                <span className={`badge ${u.status === "blocked" ? "cancelled" : u.role}`}>{u.status === "blocked" ? "Bloklangan" : ROLES[u.role]}</span>
              </div>
              <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                <select value={u.role} disabled={self} aria-label="Rol"
                  onChange={(e) => {
                    const role = e.target.value;
                    if (role === "master") { const free = MASTERS.find((m) => !taken(m.id)); return say(setRole(u.id, role, free?.id), "Rol yangilandi"); }
                    say(setRole(u.id, role), "Rol yangilandi");
                  }}>
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {u.role === "master" && (
                  <select value={u.masterId || ""} aria-label="Usta profili" onChange={(e) => say(setRole(u.id, "master", e.target.value), "Usta profili yangilandi")}>
                    {MASTERS.map((m) => <option key={m.id} value={m.id} disabled={taken(m.id) && u.masterId !== m.id}>{m.name}</option>)}
                  </select>
                )}
                {u.role === "master" && !byMaster(u.masterId) && <span className="err">Profil bogʻlanmagan</span>}
                <button className="btn sm ghost" disabled={self} onClick={() => say(setBlocked(u.id, u.status !== "blocked"), u.status === "blocked" ? "Faollashtirildi" : "Bloklandi, faol bronlari bekor qilindi")}>{u.status === "blocked" ? "Faollashtirish" : "Bloklash"}</button>
                <button className="btn sm ghost" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPw(""); }}>Parolni tiklash</button>
                <button className="btn sm bad" disabled={self} onClick={() => window.confirm(`${u.name} oʻchirilsinmi? Faol bronlari bekor qilinadi.`) && say(removeUser(u.id), "Oʻchirildi")}>Oʻchirish</button>
              </div>
              {resetFor === u.id && (
                <form className="row" onSubmit={async (e) => { e.preventDefault(); const r = await setPassword(u.id, newPw); say(r, "Parol yangilandi"); if (r.ok) setResetFor(null); }}>
                  <input type="password" placeholder="Yangi parol (kamida 6 belgi)" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
                  <button className="btn sm">Saqlash</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
