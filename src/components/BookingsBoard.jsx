import { useState } from "react";
import { useToast } from "./Toast.jsx";
import BookingCard from "./BookingCard.jsx";
import Loading from "./Loading.jsx";
import { STATUS } from "../../shared/config.js";
import { addD, canMark, fD, money, nowTK } from "../../shared/availability.js";
import { TRANSITIONS } from "../../shared/roles.js";
import { patch } from "../api";
import { useApi, useAction } from "../hooks/useApi";
import { useTick } from "../lib/store";

const LABEL = { confirmed: "Tasdiqlash", done: "Bajarildi", noshow: "Kelmadi", cancelled: "Bekor qilish" };
const CONFIRM = { cancelled: "Bron bekor qilinsinmi? Mijozga qoʻngʻiroq qilishni unutmang.", noshow: "Mijoz kelmadi deb belgilansinmi?" };

// Admin (hamma bronlar) va usta (faqat oʻziniki — server cheklaydi) uchun umumiy jadval
export default function BookingsBoard({ title }) {
  const toast = useToast();
  useTick();
  const now = nowTK();
  const [date, setDate] = useState(now.date);
  const [mode, setMode] = useState("day");
  const { data, error } = useApi(mode === "day" ? `/bookings?date=${date}` : "/bookings?status=pending", { poll: 30_000 });
  const [run, busy] = useAction(toast);

  const change = (b, s) => {
    if (CONFIRM[s] && !window.confirm(CONFIRM[s])) return;
    run(() => patch(`/bookings/${b.id}`, { status: s }), `Holat: ${STATUS[s]}`);
  };
  const stats = data?.stats;
  const list = data?.items ?? [];

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 860 }}>
      <h2 style={{ marginBottom: 18 }}>{title}</h2>
      <div className="grid" style={{ marginBottom: 22 }}>
        <div className="card"><div className="mute">Bugungi bronlar</div><h3>{stats?.today ?? "—"}</h3></div>
        <div className="card"><div className="mute">Tasdiqlash kutilmoqda</div><h3>{stats?.pending ?? "—"}</h3></div>
        <div className="card"><div className="mute">Shu oy tushum (bajarilgan)</div><h3>{stats ? money(stats.revenue) : "—"}</h3></div>
      </div>
      <div className="tabs">
        <button className={"nl" + (mode === "day" ? " on" : "")} onClick={() => setMode("day")}>Kun boʻyicha</button>
        <button className={"nl" + (mode === "pend" ? " on" : "")} onClick={() => setMode("pend")}>Kutilayotganlar{stats ? ` (${stats.pending})` : ""}</button>
        {mode === "day" && (<>
          <button className="nl" aria-label="Oldingi kun" onClick={() => setDate(addD(date, -1))}>←</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: "auto" }} aria-label="Sana" />
          <button className="nl" aria-label="Keyingi kun" onClick={() => setDate(addD(date, 1))}>→</button>
          {date !== now.date && <button className="nl" onClick={() => setDate(now.date)}>Bugun</button>}
        </>)}
      </div>
      {error ? <div className="empty">{error.message}</div>
        : !data ? <Loading />
        : list.length === 0 ? <div className="empty">{mode === "day" ? `${fD(date)} — bronlar yoʻq.` : "Tasdiqlash kutayotgan bron yoʻq."}</div>
        : (
          <div className="stack">
            {list.map((b) => (
              <BookingCard key={b.id} b={b} showClient>
                {(TRANSITIONS[b.status] || []).map((s) => {
                  const early = (s === "done" || s === "noshow") && !canMark(b, now);
                  return (
                    <button key={s} className={"btn sm" + (s === "cancelled" || s === "noshow" ? " bad" : s === "done" ? "" : " ghost")}
                      disabled={busy || early} title={early ? "Vaqti kelgach belgilanadi" : ""} onClick={() => change(b, s)}>{LABEL[s]}</button>
                  );
                })}
              </BookingCard>
            ))}
          </div>
        )}
    </div>
  );
}
