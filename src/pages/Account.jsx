import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import BookingCard from "../components/BookingCard.jsx";
import Loading from "../components/Loading.jsx";
import { SALON, RULES } from "../../shared/config.js";
import { ROLES } from "../../shared/roles.js";
import { active, byTime, canCancel, isUpcoming, nowTK } from "../../shared/availability.js";
import { checkName, checkPassword } from "../../shared/validation.js";
import { patch, post } from "../api";
import { useApi, useAction } from "../hooks/useApi";
import { useTick } from "../lib/store";

const TABS = [["up", "Kelgusi"], ["old", "Oʻtgan"], ["cx", "Bekor qilingan"], ["me", "Profil"]];

export default function Account() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  useTick();
  const now = nowTK();
  const { data, error } = useApi("/bookings/mine");
  const [run, busy] = useAction(toast);
  const [tab, setTab] = useState("up");
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ old: "", next: "" });

  const mine = [...(data?.items ?? [])].sort(byTime);
  const L = {
    up: mine.filter((b) => isUpcoming(b, now)),
    old: mine.filter((b) => b.status === "done" || b.status === "noshow" || (active(b) && !isUpcoming(b, now))).reverse(),
    cx: mine.filter((b) => b.status === "cancelled").reverse(),
    me: [],
  };

  const rename = (e) => {
    e.preventDefault();
    const err = checkName(name);
    if (err) return toast(err);
    run(async () => { await patch("/me", { name: name.trim() }); await refresh(); }, "Ism yangilandi");
  };
  const changePw = async (e) => {
    e.preventDefault();
    const err = checkPassword(pw.next);
    if (err) return toast(err);
    if (await run(() => post("/me/password", pw), "Parol yangilandi. Boshqa qurilmalardagi sessiyalar yopildi.")) setPw({ old: "", next: "" });
  };
  const cancel = (b) => window.confirm("Yozilish bekor qilinsinmi?") && run(() => post(`/bookings/${b.id}/cancel`), "Yozilish bekor qilindi");

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 720 }}>
      <div className="sh">
        <div><h2>Salom, {user.name.split(" ")[0]}</h2><p className="mute">{user.phone} · <span className={`badge ${user.role}`}>{ROLES[user.role]}</span></p></div>
        <Link to="/book" className="btn" style={{ textDecoration: "none" }}>Yangi yozilish</Link>
      </div>
      <div className="tabs">
        {TABS.map(([k, t]) => <button key={k} className={"nl" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{t}{k !== "me" && data && ` (${L[k].length})`}</button>)}
      </div>

      {tab === "me" ? (
        <div className="stack">
          <form className="card stack" onSubmit={rename}>
            <h3>Profil</h3>
            <label>Ism<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" /></label>
            <button className="btn sm" disabled={busy}>Saqlash</button>
          </form>
          <form className="card stack" onSubmit={changePw}>
            <h3>Parolni almashtirish</h3>
            <label>Joriy parol<input type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" /></label>
            <label>Yangi parol<input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></label>
            <button className="btn sm" disabled={busy}>Yangilash</button>
          </form>
        </div>
      ) : error ? <div className="empty">{error.message}</div>
        : !data ? <Loading />
        : L[tab].length === 0 ? (
          <div className="empty">{tab === "up" ? "Hozircha kelgusi yozilish yoʻq." : "Bu yerda hozircha hech narsa yoʻq."}</div>
        ) : (
          <div className="stack">
            {L[tab].map((b) => (
              <BookingCard key={b.id} b={b}>
                {canCancel(b, now) && <button className="btn sm bad" disabled={busy} onClick={() => cancel(b)}>Bekor qilish</button>}
                {isUpcoming(b, now) && !canCancel(b, now) && <span className="mute" style={{ fontSize: ".85rem" }}>Bekor qilish muddati oʻtgan ({RULES.CANCEL_H} soatdan kam qoldi). Salonga qoʻngʻiroq qiling: <a href={`tel:${SALON.tel.replace(/\s/g, "")}`}>{SALON.tel}</a></span>}
                {!active(b) && <Link to="/book" className="btn sm ghost" style={{ textDecoration: "none" }}>Yana yozilish</Link>}
              </BookingCard>
            ))}
          </div>
        )}
    </div>
  );
}
