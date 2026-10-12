import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../components/Toast.jsx";
import Loading from "../../components/Loading.jsx";
import { MASTERS, byMaster } from "../../../shared/config.js";
import { ROLES } from "../../../shared/roles.js";
import { phoneDigits } from "../../../shared/availability.js";
import { checkName, checkPhone, checkPassword, firstError } from "../../../shared/validation.js";
import { del, patch, post } from "../../api";
import { useApi, useAction } from "../../hooks/useApi";

const NEW = { name: "", ph: "", pw: "", role: "client", masterId: "" };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, error } = useApi("/users");
  const [run, busy] = useAction(toast);
  const [q, setQ] = useState("");
  const [f, setF] = useState(NEW);
  const [resetFor, setResetFor] = useState(null);
  const [newPw, setNewPw] = useState("");

  const users = data?.items ?? [];
  const owner = (masterId) => users.find((u) => u.masterId === masterId);
  const needle = q.trim().toLowerCase();
  const list = users.filter((u) => (u.name + u.phone).toLowerCase().includes(needle));

  async function add(e) {
    e.preventDefault();
    const phone = `+998${f.ph}`;
    const err = firstError(checkName(f.name), checkPhone(phone), checkPassword(f.pw), f.role === "master" && !f.masterId && "Usta profilini tanlang");
    if (err) return toast(err);
    const body = { name: f.name.trim(), phone, pw: f.pw, role: f.role, ...(f.role === "master" && { masterId: f.masterId }) };
    if (await run(() => post("/users", body), "Foydalanuvchi qoʻshildi")) setF(NEW);
  }
  const update = (u, body, msg) => run(() => patch(`/users/${u.id}`, body), msg);
  const changeRole = (u, role) => {
    if (role !== "master") return update(u, { role }, "Rol yangilandi");
    const free = MASTERS.find((m) => !owner(m.id));
    if (!free) return toast("Barcha usta profillari band");
    update(u, { role, masterId: free.id }, `Rol yangilandi: ${free.name} profiliga bogʻlandi`);
  };
  const remove = (u) => window.confirm(`${u.name} oʻchirilsinmi? Kelgusi bronlari bekor qilinadi.`) && run(() => del(`/users/${u.id}`), "Oʻchirildi");
  async function resetPw(e, u) {
    e.preventDefault();
    const err = checkPassword(newPw);
    if (err) return toast(err);
    if (await run(() => post(`/users/${u.id}/password`, { pw: newPw }), "Parol yangilandi, foydalanuvchi sessiyalari yopildi")) setResetFor(null);
  }

  if (error) return <div className="w"><div className="empty" style={{ margin: "48px 0" }}>{error.message}</div></div>;
  if (!data) return <Loading />;

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 900 }}>
      <h2 style={{ marginBottom: 18 }}>Foydalanuvchilar</h2>

      <form className="card stack" onSubmit={add} style={{ marginBottom: 22 }} noValidate>
        <h3>Yangi foydalanuvchi</h3>
        <div className="fr">
          <label>Ism<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} /></label>
          <label>Telefon (+998)<input inputMode="numeric" value={f.ph} onChange={(e) => setF({ ...f, ph: phoneDigits(e.target.value) })} placeholder="901234567" /></label>
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
                {MASTERS.map((m) => <option key={m.id} value={m.id} disabled={!!owner(m.id)}>{m.name}{owner(m.id) ? " (band)" : ""}</option>)}
              </select>
            </label>
          )}
        </div>
        <button className="btn sm" style={{ justifySelf: "start" }} disabled={busy}>Qoʻshish</button>
      </form>

      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="Ism yoki telefon boʻyicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />
        <span className="mute" style={{ whiteSpace: "nowrap" }}>{list.length} ta</span>
      </div>

      <div className="stack">
        {list.map((u) => {
          const self = u.id === me.id;
          const blocked = u.status === "blocked";
          return (
            <div className="card stack" key={u.id}>
              <div className="row">
                <div><b>{u.name}</b>{self && <span className="mute"> (siz)</span>}<div className="mute">{u.phone}</div></div>
                <span className={`badge ${blocked ? "cancelled" : u.role}`}>{blocked ? "Bloklangan" : ROLES[u.role]}</span>
              </div>
              <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                <select value={u.role} disabled={self || busy} aria-label="Rol" onChange={(e) => changeRole(u, e.target.value)}>
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {u.role === "master" && (
                  <select value={u.masterId || ""} disabled={busy} aria-label="Usta profili" onChange={(e) => update(u, { masterId: e.target.value }, "Usta profili yangilandi")}>
                    {MASTERS.map((m) => <option key={m.id} value={m.id} disabled={!!owner(m.id) && owner(m.id).id !== u.id}>{m.name}</option>)}
                  </select>
                )}
                {u.role === "master" && !byMaster(u.masterId) && <span className="err">Profil topilmadi</span>}
                <button className="btn sm ghost" disabled={self || busy}
                  onClick={() => update(u, { status: blocked ? "active" : "blocked" }, blocked ? "Faollashtirildi" : "Bloklandi, kelgusi bronlari bekor qilindi")}>
                  {blocked ? "Faollashtirish" : "Bloklash"}
                </button>
                <button className="btn sm ghost" onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPw(""); }}>Parolni tiklash</button>
                <button className="btn sm bad" disabled={self || busy} onClick={() => remove(u)}>Oʻchirish</button>
              </div>
              {resetFor === u.id && (
                <form className="row" onSubmit={(e) => resetPw(e, u)}>
                  <input type="password" placeholder="Yangi parol" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" aria-label="Yangi parol" />
                  <button className="btn sm" disabled={busy}>Saqlash</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
