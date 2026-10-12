import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../lib/roles";
import { phoneDigits } from "../lib/availability";

const TEXT = {
  setup: ["Salon egasi akkaunti", "Tizim birinchi marta ishga tushdi. Bu akkaunt admin boʻladi: bronlar va foydalanuvchilarni shu yerdan boshqarasiz."],
  register: ["Roʻyxatdan oʻtish", "Telefon raqamingiz akkauntingiz identifikatori boʻladi."],
  login: ["Kirish", "Bronlaringizni koʻrish va boshqarish uchun kiring."],
};

export default function Auth({ mode }) {
  const { user, needsSetup, login, register } = useAuth();
  const nav = useNavigate();
  const from = useLocation().state?.from;
  const [f, setF] = useState({ name: "", ph: "", pw: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from || homeFor(user)} replace />;
  if (mode === "setup" && !needsSetup) return <Navigate to="/login" replace />;
  if (mode !== "setup" && needsSetup) return <Navigate to="/setup" replace />;

  const reg = mode !== "login";
  const [title, hint] = TEXT[mode];
  const set = (k) => (e) => setF({ ...f, [k]: k === "ph" ? phoneDigits(e.target.value) : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (reg && f.name.trim().length < 2) return setErr("Ismingizni kiriting");
    if (!/^\d{9}$/.test(f.ph)) return setErr("Telefon raqam 9 ta raqamdan iborat boʻlsin (masalan 901234567)");
    if (f.pw.length < 6) return setErr("Parol kamida 6 ta belgi boʻlsin");
    setBusy(true);
    const phone = `+998${f.ph}`;
    const r = reg ? await register({ name: f.name, phone, pw: f.pw }) : await login(phone, f.pw);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    nav(from || homeFor(r.user), { replace: true });
  }

  return (
    <div className="w fade" style={{ maxWidth: 460, padding: "48px 20px" }}>
      <h2>{title}</h2>
      <p className="mute" style={{ margin: "8px 0 22px" }}>{hint}</p>
      <form onSubmit={submit} className="stack card">
        {reg && <label>Ism<input value={f.name} onChange={set("name")} autoComplete="name" /></label>}
        <label>Telefon
          <div className="ph"><span>+998</span><input inputMode="numeric" value={f.ph} onChange={set("ph")} placeholder="901234567" autoComplete="tel-national" /></div>
        </label>
        <label>Parol<input type="password" value={f.pw} onChange={set("pw")} autoComplete={reg ? "new-password" : "current-password"} /></label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn" disabled={busy}>{title}</button>
        {mode !== "setup" && (
          <button type="button" className="btn ghost" onClick={() => nav(reg ? "/login" : "/register", { state: { from } })}>
            {reg ? "Akkauntim bor: kirish" : "Akkaunt yaratish"}
          </button>
        )}
      </form>
    </div>
  );
}
