import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "./Toast.jsx";
import BookingCard from "./BookingCard.jsx";
import { STATUS } from "../config/content";
import { active, addD, byTime, minsTo, nowTK, money } from "../lib/availability";
import { TRANSITIONS, setStatus } from "../lib/bookings";
import { useStored, useTick } from "../lib/store";

const LABEL = { confirmed: "Tasdiqlash", done: "Bajarildi", noshow: "Kelmadi", cancelled: "Bekor qilish" };

// Admin (hamma bronlar) va usta (faqat oʻzining bronlari) uchun umumiy jadval
export default function BookingsBoard({ title, masterId }) {
  const { user } = useAuth();
  const toast = useToast();
  const all = useStored("kb_b", []);
  useTick();
  const now = nowTK();
  const [date, setDate] = useState(now.date);
  const [mode, setMode] = useState("day");

  const scope = masterId ? all.filter((b) => b.masterId === masterId) : all;
  const pend = scope.filter((b) => b.status === "pending").length;
  const list = (mode === "day" ? scope.filter((b) => b.date === date) : scope.filter((b) => b.status === "pending"))
    .sort(byTime);
  const today = scope.filter((b) => b.date === now.date && (active(b) || b.status === "done")).length;
  const revenue = scope.filter((b) => b.status === "done").reduce((a, b) => a + b.price, 0);

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 860 }}>
      <h2 style={{ marginBottom: 18 }}>{title}</h2>
      <div className="grid" style={{ marginBottom: 22 }}>
        <div className="card"><div className="mute">Bugungi bronlar</div><h3>{today}</h3></div>
        <div className="card"><div className="mute">Tasdiqlash kutilmoqda</div><h3>{pend}</h3></div>
        <div className="card"><div className="mute">Bajarilgan xizmatlar summasi</div><h3>{money(revenue)}</h3></div>
      </div>
      <div className="tabs">
        <button className={"nl" + (mode === "day" ? " on" : "")} onClick={() => setMode("day")}>Kun boʻyicha</button>
        <button className={"nl" + (mode === "pend" ? " on" : "")} onClick={() => setMode("pend")}>Kutilayotganlar ({pend})</button>
        {mode === "day" && (<>
          <button className="nl" aria-label="Oldingi kun" onClick={() => setDate(addD(date, -1))}>←</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: "auto" }} aria-label="Sana" />
          <button className="nl" aria-label="Keyingi kun" onClick={() => setDate(addD(date, 1))}>→</button>
          {date !== now.date && <button className="nl" onClick={() => setDate(now.date)}>Bugun</button>}
        </>)}
      </div>
      {list.length === 0 ? <div className="empty">{mode === "day" ? "Bu kunga bronlar yoʻq." : "Tasdiqlash kutayotgan bron yoʻq."}</div> : (
        <div className="stack">
          {list.map((b) => (
            <BookingCard key={b.id} b={b} showClient>
              {(TRANSITIONS[b.status] || []).map((s) => (
                <button key={s} className={"btn sm" + (s === "cancelled" || s === "noshow" ? " bad" : s === "done" ? "" : " ghost")}
                  disabled={(s === "done" || s === "noshow") && minsTo(b) > 0}
                  title={(s === "done" || s === "noshow") && minsTo(b) > 0 ? "Vaqti kelgach belgilanadi" : ""}
                  onClick={() => (s !== "cancelled" || window.confirm("Bron bekor qilinsinmi?")) && toast(setStatus(user, b.id, s) || `Holat: ${STATUS[s]}`)}>{LABEL[s]}</button>
              ))}
            </BookingCard>
          ))}
        </div>
      )}
    </div>
  );
}
