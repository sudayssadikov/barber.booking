import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/Toast.jsx";
import Avatar from "../components/Avatar.jsx";
import { SERVICES, RULES, byService, byMaster } from "../config/content";
import { addD, dow, eligible, fD, fT, inWindow, money, nowTK, slotMap, WD, MO } from "../lib/availability";
import { createBooking } from "../lib/bookings";
import { useStored, useTick, write } from "../lib/store";

const EMPTY = { svc: [], master: "any", date: null, time: null, step: 1 };

export default function Book() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const draft = useStored("kb_d", EMPTY); // qoralama: kirish/roʻyxatdan oʻtishda yoʻqolmaydi
  const bookings = useStored("kb_b", []);
  useTick();
  const now = nowTK();

  // Qoralama eskirgan boʻlishi mumkin (kun oʻtgan, vaqt band boʻlgan, konfiguratsiya oʻzgargan) —
  // har renderda tekshirib, yaroqsiz qismlari tashlab yuboriladi
  const svc = (Array.isArray(draft.svc) ? draft.svc : []).filter(byService);
  const elig = eligible(svc);
  const master = draft.master === "any" || elig.some((m) => m.id === draft.master) ? draft.master : "any";
  const sv = svc.map(byService);
  const dur = sv.reduce((a, s) => a + s.min, 0);
  const price = sv.reduce((a, s) => a + s.price, 0);
  const pool = eligible(svc, master);
  const map = (d) => slotMap(pool, d, dur, bookings, now);
  const dates = Array.from({ length: RULES.AHEAD }, (_, i) => addD(now.date, i));
  const date = svc.length && inWindow(draft.date, now) ? draft.date : null;
  const times = date ? Object.keys(map(date)).map(Number).sort((a, b) => a - b) : [];
  const time = times.includes(draft.time) ? draft.time : null;
  const bk = { svc, master, date, time };
  const maxStep = !svc.length ? 1 : !elig.length ? 2 : time == null ? 3 : 4;
  const step = Math.min(Math.max(+draft.step || 1, 1), maxStep);
  const set = (p) => write("kb_d", { ...bk, step, ...p });

  function confirm() {
    const r = createBooking(user, bk);
    if (r.error) {
      toast(r.error);
      if (r.restart) write("kb_d", EMPTY);
      else if (r.retime) set({ time: null, step: 3 });
      return;
    }
    write("kb_d", EMPTY);
    toast("Yozilish yuborildi. Tasdiqlangach holat yangilanadi.");
    nav("/account");
  }
  const bar = (label, disabled, next) => (
    <div className="bar row">
      <div><b>{money(price)}</b><div className="mute" style={{ fontSize: ".85rem" }}>{dur ? `${dur} daqiqa` : "Xizmat tanlang"}</div></div>
      <button className="btn" disabled={disabled} onClick={() => set({ step: next })}>{label}</button>
    </div>
  );

  return (
    <div className="w fade" style={{ padding: "32px 20px 48px", maxWidth: 720 }}>
      <div className="steps">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      {step > 1 && <button className="nl" onClick={() => set({ step: step - 1 })}>← Orqaga</button>}

      {step === 1 && (<>
        <h2 style={{ marginBottom: 18 }}>Xizmatni tanlang</h2>
        <div className="stack">
          {SERVICES.map((s) => {
            const on = bk.svc.includes(s.id);
            return (
              <button key={s.id} className={"opt" + (on ? " on" : "")} aria-pressed={on}
                onClick={() => set({ svc: on ? bk.svc.filter((x) => x !== s.id) : [...bk.svc, s.id], master: "any", date: null, time: null })}>
                <div><b>{s.name}</b><div className="mute" style={{ fontSize: ".88rem" }}>{s.d} · {s.min} daq.</div></div>
                <span className="price">{money(s.price)}</span>
              </button>
            );
          })}
        </div>
        {bar("Davom etish", !dur, 2)}
      </>)}

      {step === 2 && (<>
        <h2 style={{ marginBottom: 18 }}>Ustani tanlang</h2>
        {elig.length === 0 ? <div className="empty">Tanlangan xizmatlarning hammasini bitta usta bajara olmaydi. Xizmatlarni kamaytiring.</div> : (
          <div className="stack">
            <button className={"opt" + (bk.master === "any" ? " on" : "")} onClick={() => set({ master: "any", date: null, time: null })}>
              <div><b>Istalgan boʻsh usta</b><div className="mute" style={{ fontSize: ".88rem" }}>Eng koʻp vaqt tanlovi</div></div>
            </button>
            {elig.map((m) => (
              <button key={m.id} className={"opt" + (bk.master === m.id ? " on" : "")} onClick={() => set({ master: m.id, date: null, time: null })}>
                <div className="row" style={{ justifyContent: "flex-start" }}><Avatar m={m} /><div><b>{m.name}</b><div className="mute" style={{ fontSize: ".88rem" }}>{m.role} · {m.exp} yil</div></div></div>
              </button>
            ))}
          </div>
        )}
        {bar("Davom etish", !elig.length, 3)}
      </>)}

      {step === 3 && (<>
        <h2 style={{ marginBottom: 18 }}>Sana va vaqt</h2>
        <div className="days">
          {dates.map((d) => (
            <button key={d} disabled={!Object.keys(map(d)).length} className={"day" + (bk.date === d ? " on" : "")} onClick={() => set({ date: d, time: null })}>
              <small>{WD[dow(d)]}</small><b>{+d.slice(8)}</b><small>{MO[+d.slice(5, 7) - 1]}</small>
            </button>
          ))}
        </div>
        {!bk.date ? <p className="mute">Avval kunni tanlang.</p> : times.length === 0 ? <p className="mute">Bu kunga boʻsh vaqt qolmadi.</p> : (
          <div className="times">{times.map((t) => <button key={t} className={"chip" + (bk.time === t ? " on" : "")} onClick={() => set({ time: t })}>{fT(t)}</button>)}</div>
        )}
        {bar("Davom etish", bk.time == null, 4)}
      </>)}

      {step === 4 && (<>
        <h2 style={{ marginBottom: 18 }}>Tasdiqlash</h2>
        <div className="card stack">
          <div className="row"><span className="mute">Xizmatlar</span><b style={{ textAlign: "right" }}>{sv.map((s) => s.name).join(", ")}</b></div>
          <div className="row"><span className="mute">Usta</span><b>{bk.master === "any" ? "Istalgan boʻsh usta" : byMaster(bk.master).name}</b></div>
          <div className="row"><span className="mute">Vaqt</span><b>{fD(bk.date)}, {fT(bk.time)}–{fT(bk.time + dur)}</b></div>
          <div className="row"><span className="mute">Narx</span><b>{money(price)}</b></div>
        </div>
        <p className="mute" style={{ margin: "12px 0" }}>Vaqtdan {RULES.CANCEL_H} soat oldin gacha bepul bekor qilish mumkin.</p>
        {user ? <button className="btn" style={{ width: "100%" }} onClick={confirm}>Yozilishni tasdiqlash</button> : (
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
