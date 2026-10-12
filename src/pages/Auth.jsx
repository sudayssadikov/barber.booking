import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../../shared/roles.js";
import { phoneDigits } from "../../shared/availability.js";
import { checkName, checkPhone, checkPassword, firstError, PW_MIN } from "../../shared/validation.js";

const TEXT = {
  setup: ["Salon egasi akkaunti", "Tizim birinchi marta ishga tushdi. Bu akkaunt admin boʻladi: bronlar va foydalanuvchilarni shu yerdan boshqarasiz."],
  register: ["Roʻyxatdan oʻtish", "Telefon raqamingiz akkauntingiz identifikatori boʻladi."],
  login: ["Kirish", "Bronlaringizni koʻrish va boshqarish uchun kiring."],
};

// Faqat ilova ichidagi yoʻlga qaytariladi (tashqi saytga yoʻnaltirishning oldini olish)
const safeFrom = (p) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : null);

export default function Auth({ mode }) {
  const auth = useAuth();
  const nav = useNavigate();
  const from = safeFrom(useLocation().state?.from);
  const [f, setF] = useState({ name: "", ph: "", pw: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (auth.user) return <Navigate to={from || homeFor(auth.user)} replace />;
  if (mode === "setup" && !auth.needsSetup) return <Navigate to="/login" replace />;
  if (mode !== "setup" && auth.needsSetup) return <Navigate to="/setup" replace />;

  const reg = mode !== "login";
  const [title, hint] = TEXT[mode];
  const set = (k) => (e) => setF({ ...f, [k]: k === "ph" ? phoneDigits(e.target.value) : e.target.value });

  async function submit(e) {
    e.preventDefault();
    const phone = `+998${f.ph}`;
    const invalid = firstError(reg && checkName(f.name), checkPhone(phone), reg ? checkPassword(f.pw) : !f.pw && "Parolni kiriting");
    setErr(invalid || "");
    if (invalid) return;
    setBusy(true);
    try {
      const data = { name: f.name.trim(), phone, pw: f.pw };
      const user = await auth[mode](data);
      nav(from || homeFor(user), { replace: true });
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="w fade" style={{ maxWidth: 460, padding: "48px 20px" }}>
      <h2>{title}</h2>
      <p className="mute" style={{ margin: "8px 0 22px" }}>{hint}</p>
      <form onSubmit={submit} className="stack card" noValidate>
        {reg && <label>Ism<input value={f.name} onChange={set("name")} autoComplete="name" maxLength={60} /></label>}
        <label>Telefon
          <div className="ph"><span>+998</span><input inputMode="numeric" value={f.ph} onChange={set("ph")} placeholder="901234567" autoComplete="tel-national" /></div>
        </label>
        <label>Parol
          <input type="password" value={f.pw} onChange={set("pw")} autoComplete={reg ? "new-password" : "current-password"} maxLength={128} />
          {reg && <small className="mute">Kamida {PW_MIN} ta belgi, harf va raqam bilan</small>}
        </label>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? "Kuting…" : title}</button>
        {mode !== "setup" && (
          <button type="button" className="btn ghost" onClick={() => nav(reg ? "/login" : "/register", { state: { from } })}>
            {reg ? "Akkauntim bor: kirish" : "Akkaunt yaratish"}
          </button>
        )}
      </form>
    </div>
  );
}
