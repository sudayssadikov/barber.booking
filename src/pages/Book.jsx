import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Avatar from "../components/Avatar.jsx";
import { SERVICES, RULES, byMaster } from "../../shared/config.js";
import { dow, eligible, fD, fT, inWindow, money, nowTK, quote, windowDates, WD, MO } from "../../shared/availability.js";
import { post } from "../api";
import { useApi } from "../hooks/useApi";
import { useStored, useTick, write } from "../lib/store";

const DRAFT = "kb_d";
const EMPTY = { svc: [], master: "any", date: null, time: null, step: 1 };

export default function Book() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const draft = useStored(DRAFT, EMPTY); // qoralama: kirish/roʻyxatdan oʻtishda yoʻqolmaydi
  const [sending, setSending] = useState(false);
  useTick();
  const now = nowTK();

  // Qoralama eskirgan boʻlishi mumkin (kun oʻtgan, vaqt band boʻlgan, konfiguratsiya oʻzgargan) —
  // har renderda tekshirilib, yaroqsiz qismlari tashlab yuboriladi
  const qt = quote(Array.isArray(draft.svc) ? draft.svc.filter((id) => SERVICES.some((s) => s.id === id)) : []);
  const svc = qt?.ids ?? [];
  const elig = eligible(svc);
  const master = draft.master === "any" || elig.some((m) => m.id === draft.master) ? draft.master : "any";

  // Boʻsh vaqtlar serverdan: boshqa mijozlarning bronlari faqat serverda koʻrinadi
  const avail = useApi(svc.length && elig.length ? `/availability?svc=${svc.join(",")}&master=${master}` : null, { poll: 60_000 });
  const days = avail.data?.days;
  const date = svc.length && inWindow(draft.date, now) && (!days || days[draft.date]) ? draft.date : null;
  const times = (date && days?.[date]) || [];
  const time = !days ? (date ? draft.time : null) : times.includes(draft.time) ? draft.time : null;

  const bk = { svc, master, date, time };
  const maxStep = !svc.length ? 1 : !elig.length ? 2 : time == null ? 3 : 4;
  const step = Math.min(Math.max(+draft.step || 1, 1), maxStep);
  const set = (p) => write(DRAFT, { ...bk, step, ...p });
  const dur = qt?.dur ?? 0;
  const price = qt?.price ?? 0;

  async function confirm() {
    if (sending) return;
    setSending(true);
    try {
      await post("/bookings", { svc, master, date, time });
      write(DRAFT, EMPTY);
      toast("Yozilish yuborildi. Tasdiqlangach holat yangilanadi.");
      nav("/account");
    } catch (e) {
      toast(e.message);
      if (e.code === "slot_taken") set({ time: null, step: 3 });
      else if (e.code === "bad_services") write(DRAFT, EMPTY);
      setSending(false);
    }
  }

  const bar = (label, disabled, next) => (
    <div className="bar row">
      <div><b>{money(price)}</b><div className="mute" style={{ fontSize: ".85rem" }}>{dur ? `${dur} daqiqa` : "Xizmat tanlang"}</div></div>
      <button className="btn" disabled={disabled} onClick={() => set({ step: next })}>{label}</button>
    </div>
  );

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 720 }}>
      <div className="steps" aria-label={`Qadam ${step} / 4`}>{[1, 2, 3, 4].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      {step > 1 && <button className="nl" onClick={() => set({ step: step - 1 })}>← Orqaga</button>}

      {step === 1 && (<>
        <h2 style={{ marginBottom: 18 }}>Xizmatni tanlang</h2>
        <div className="stack">
          {SERVICES.map((s) => {
            const on = svc.includes(s.id);
            return (
              <button key={s.id} className={"opt" + (on ? " on" : "")} aria-pressed={on}
                onClick={() => set({ svc: on ? svc.filter((x) => x !== s.id) : [...svc, s.id], master: "any", date: null, time: null })}>
                <div><b>{s.name}</b><div className="mute" style={{ fontSize: ".88rem" }}>{s.d} · {s.min} daq.</div></div>
                <span className="price">{money(s.price)}</span>
              </button>
            );
          })}
        </div>
        {bar("Davom etish", !svc.length, 2)}
      </>)}

      {step === 2 && (<>
        <h2 style={{ marginBottom: 18 }}>Ustani tanlang</h2>
        {elig.length === 0 ? <div className="empty">Tanlangan xizmatlarning hammasini bitta usta bajara olmaydi. Xizmatlarni kamaytiring.</div> : (
          <div className="stack">
            <button className={"opt" + (master === "any" ? " on" : "")} aria-pressed={master === "any"} onClick={() => set({ master: "any", date: null, time: null })}>
              <div><b>Istalgan boʻsh usta</b><div className="mute" style={{ fontSize: ".88rem" }}>Eng koʻp vaqt tanlovi</div></div>
            </button>
            {elig.map((m) => (
              <button key={m.id} className={"opt" + (master === m.id ? " on" : "")} aria-pressed={master === m.id} onClick={() => set({ master: m.id, date: null, time: null })}>
                <div className="row" style={{ justifyContent: "flex-start" }}><Avatar m={m} /><div><b>{m.name}</b><div className="mute" style={{ fontSize: ".88rem" }}>{m.role} · {m.exp} yil</div></div></div>
              </button>
            ))}
          </div>
        )}
        {bar("Davom etish", !elig.length, 3)}
      </>)}

      {step === 3 && (<>
        <h2 style={{ marginBottom: 18 }}>Sana va vaqt</h2>
        {avail.error ? <div className="empty">{avail.error.message}</div> : !days ? <p className="mute">Boʻsh vaqtlar yuklanmoqda…</p> : (<>
          <div className="days">
            {windowDates(now).map((d) => (
              <button key={d} disabled={!days[d]} className={"day" + (date === d ? " on" : "")} aria-pressed={date === d} onClick={() => set({ date: d, time: null })}>
                <small>{WD[dow(d)]}</small><b>{+d.slice(8)}</b><small>{MO[+d.slice(5, 7) - 1]}</small>
              </button>
            ))}
          </div>
          {Object.keys(days).length === 0 ? <div className="empty">Yaqin {RULES.AHEAD} kunda boʻsh vaqt yoʻq. Boshqa ustani tanlab koʻring.</div>
            : !date ? <p className="mute">Avval kunni tanlang.</p>
            : <div className="times">{times.map((t) => <button key={t} className={"chip" + (time === t ? " on" : "")} aria-pressed={time === t} onClick={() => set({ time: t })}>{fT(t)}</button>)}</div>}
        </>)}
        {bar("Davom etish", time == null, 4)}
      </>)}

      {step === 4 && (<>
        <h2 style={{ marginBottom: 18 }}>Tasdiqlash</h2>
        <div className="card stack">
          <div className="row"><span className="mute">Xizmatlar</span><b style={{ textAlign: "right" }}>{qt.items.map((s) => s.name).join(", ")}</b></div>
          <div className="row"><span className="mute">Usta</span><b>{master === "any" ? "Istalgan boʻsh usta" : byMaster(master).name}</b></div>
          <div className="row"><span className="mute">Vaqt</span><b>{fD(date)}, {fT(time)}–{fT(time + dur)}</b></div>
          <div className="row"><span className="mute">Narx</span><b>{money(price)}</b></div>
        </div>
        <p className="mute" style={{ margin: "12px 0" }}>Vaqtdan {RULES.CANCEL_H} soat oldin gacha bepul bekor qilish mumkin.</p>
        {user ? <button className="btn" style={{ width: "100%" }} disabled={sending} onClick={confirm}>{sending ? "Yuborilmoqda…" : "Yozilishni tasdiqlash"}</button> : (
          <div className="card stack">
            <b>Davom etish uchun akkauntingizga kiring</b>
            <p className="mute">Tanlovingiz saqlanib turadi.</p>
            <Link to="/login" state={{ from: "/book" }} className="btn" style={{ textDecoration: "none" }}>Kirish</Link>
            <Link to="/register" state={{ from: "/book" }} className="btn ghost" style={{ textDecoration: "none" }}>Roʻyxatdan oʻtish</Link>
          </div>
        )}
      </>)}
    </div>
  );
}
