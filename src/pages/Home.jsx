import { Link, useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar.jsx";
import { SALON, SERVICES, MASTERS } from "../config/content";
import { money } from "../lib/availability";
import { write } from "../lib/store";

export default function Home() {
  const nav = useNavigate();
  const pick = (id) => { write("kb_d", { svc: [id], master: "any", date: null, time: null, step: 2 }); nav("/book"); };
  return (
    <div className="w fade">
      <div className="hero">
        <div>
          <span className="price">Chilonzor · 2018-yildan</span>
          <h1 style={{ margin: "10px 0 0" }}>Aniq soch.<br />Aniq vaqt.</h1>
          <p>Ustangizni tanlang, qulay vaqtni band qiling va navbatsiz keling. Yozilish 1 daqiqa vaqt oladi.</p>
          <Link to="/book" className="btn" style={{ textDecoration: "none" }}>Hozir yozilish</Link>
        </div>
        <div className="pole" aria-hidden="true" />
      </div>
      <section>
        <div className="sh"><h2>Xizmatlar</h2></div>
        <div className="grid">
          {SERVICES.map((s) => (
            <div className="card" key={s.id}>
              <div className="row"><h3>{s.name}</h3><span className="price">{money(s.price)}</span></div>
              <p className="mute" style={{ margin: "8px 0 16px" }}>{s.d} · {s.min} daqiqa</p>
              <button className="btn sm ghost" onClick={() => pick(s.id)}>Yozilish</button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="sh"><h2>Ustalar</h2></div>
        <div className="grid">
          {MASTERS.map((m) => (
            <div className="card row" key={m.id} style={{ justifyContent: "flex-start" }}>
              <Avatar m={m} /><div><h3>{m.name}</h3><p className="mute">{m.role} · {m.exp} yil tajriba</p></div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="card"><h3>Manzil va ish vaqti</h3><p style={{ marginTop: 10 }}>{SALON.addr}</p><p className="mute">{SALON.hours}</p><p className="mute">{SALON.tel}</p></div>
      </section>
    </div>
  );
}
