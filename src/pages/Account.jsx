import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import BookingCard from "../components/BookingCard.jsx";
import { SALON, RULES } from "../config/content";
import { ROLES } from "../lib/roles";
import { active, byTime, canCancel, isPast } from "../lib/availability";
import { cancelOwn } from "../lib/bookings";
import { useStored, useTick } from "../lib/store";

export default function Account() {
  const { user, rename, setPassword } = useAuth();
  const toast = useToast();
  const bookings = useStored("kb_b", []);
  useTick();
  const [tab, setTab] = useState("up");
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ old: "", next: "" });

  const mine = bookings.filter((b) => b.userId === user.id).sort(byTime);
  const L = {
    up: mine.filter((b) => active(b) && !isPast(b)),
    old: mine.filter((b) => b.status === "done" || b.status === "noshow" || (active(b) && isPast(b))).reverse(),
    cx: mine.filter((b) => b.status === "cancelled").reverse(),
    me: [],
  };
  const tabs = [["up", "Kelgusi"], ["old", "Oʻtgan"], ["cx", "Bekor qilingan"], ["me", "Profil"]];

  async function changePw(e) {
    e.preventDefault();
    const r = await setPassword(user.id, pw.next, pw.old);
    toast(r.ok ? "Parol yangilandi" : r.error);
    if (r.ok) setPw({ old: "", next: "" });
  }

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 720 }}>
      <div className="sh">
        <div><h2>Salom, {user.name.split(" ")[0]}</h2><p className="mute">{user.phone} · <span className={`badge ${user.role}`}>{ROLES[user.role]}</span></p></div>
        <Link to="/book" className="btn" style={{ textDecoration: "none" }}>Yangi yozilish</Link>
      </div>
      <div className="tabs">
        {tabs.map(([k, t]) => <button key={k} className={"nl" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{t}{k !== "me" && ` (${L[k].length})`}</button>)}
      </div>

      {tab === "me" ? (
        <div className="stack">
          <form className="card stack" onSubmit={(e) => { e.preventDefault(); const r = rename(user.id, name); toast(r.ok ? "Ism yangilandi" : r.error); }}>
            <h3>Profil</h3>
            <label>Ism<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <button className="btn sm">Saqlash</button>
          </form>
          <form className="card stack" onSubmit={changePw}>
            <h3>Parolni almashtirish</h3>
            <label>Joriy parol<input type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" /></label>
            <label>Yangi parol<input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></label>
            <button className="btn sm">Yangilash</button>
          </form>
        </div>
      ) : L[tab].length === 0 ? (
        <div className="empty">{tab === "up" ? "Hozircha kelgusi yozilish yoʻq." : "Bu yerda hozircha hech narsa yoʻq."}</div>
      ) : (
        <div className="stack">
          {L[tab].map((b) => (
            <BookingCard key={b.id} b={b}>
              {canCancel(b) && <button className="btn sm bad" onClick={() => window.confirm("Yozilish bekor qilinsinmi?") && toast(cancelOwn(user, b.id) ? "Yozilish bekor qilindi" : "Bekor qilib boʻlmadi: muddat oʻtgan")}>Bekor qilish</button>}
              {active(b) && !isPast(b) && !canCancel(b) && <span className="mute" style={{ fontSize: ".85rem" }}>Bekor qilish muddati oʻtgan ({RULES.CANCEL_H} soatdan kam qoldi). Salonga qoʻngʻiroq qiling: {SALON.tel}</span>}
              {!active(b) && <Link to="/book" className="btn sm ghost" style={{ textDecoration: "none" }}>Yana yozilish</Link>}
            </BookingCard>
          ))}
        </div>
      )}
    </div>
  );
}
