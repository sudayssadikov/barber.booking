import { STATUS, byService, byMaster } from "../../shared/config.js";
import { fD, fT, money } from "../../shared/availability.js";
export default function BookingCard({ b, showClient, children }) {
  // Konfiguratsiyadan oʻchirilgan xizmat/usta eski bronni buzmasin
  const svc = b.svc.map((id) => byService(id)?.name || "Xizmat oʻchirilgan").join(", ");
  return (
    <div className="card stack">
      <div className="row"><b>{fD(b.date)}, {fT(b.start)}–{fT(b.start + b.dur)}</b><span className={`badge ${b.status}`}>{STATUS[b.status]}</span></div>
      {showClient && <div>{b.name} · <a className="mute" href={`tel:${b.phone}`}>{b.phone}</a></div>}
      <div>{svc}</div>
      <div className="mute">Usta: {byMaster(b.masterId)?.name || "—"} · {money(b.price)}</div>
      {children && <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}
