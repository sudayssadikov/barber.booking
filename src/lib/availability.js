import { MASTERS, RULES } from "../config/content";
export const WD = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
export const MO = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

export const toMin = (t) => { const [h, m] = t.split(":"); return +h * 60 + +m; };
export const fT = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
// "+998 90 123-45-67" yoki "901234567" -> "901234567" (milliy 9 xonali qism)
export const phoneDigits = (v) => { const d = String(v).replace(/\D/g, ""); return (d.length > 9 && d.startsWith("998") ? d.slice(3) : d).slice(0, 9); };
export const money = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} soʻm`;
export const dow = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
export const fD = (s) => { const d = new Date(`${s}T00:00:00Z`); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`; };
export const addD = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Toshkent vaqti (qurilma vaqt zonasidan mustaqil)
export const nowTK = () => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).reduce((a, x) => ((a[x.type] = x.value), a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
};

// Sana bron qilish oynasidami: bugundan RULES.AHEAD kun ichida
export const inWindow = (date, now) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date || "") && date >= now.date && date < addD(now.date, RULES.AHEAD);
// Sana + boshlanish vaqti boʻyicha (raqamli) saralash
export const byTime = (a, b) => a.date.localeCompare(b.date) || a.start - b.start;

export const active = (b) => b.status === "pending" || b.status === "confirmed";
export const minsTo = (b) => { const n = nowTK(); return (Date.parse(b.date) - Date.parse(n.date)) / 60000 + b.start - n.min; };
export const isPast = (b) => minsTo(b) + b.dur <= 0;
export const canCancel = (b) => active(b) && minsTo(b) >= RULES.CANCEL_H * 60;

export const eligible = (svc, master = "any") =>
  MASTERS.filter((m) => svc.every((s) => m.svc.includes(s)) && (master === "any" || m.id === master));

export function slots(m, date, dur, all, now) {
  if (!inWindow(date, now) || m.off.includes(dow(date))) return [];
  const s = toMin(m.work[0]), e = toMin(m.work[1]), bs = toMin(m.brk[0]), be = toMin(m.brk[1]);
  const busy = all.filter((b) => b.masterId === m.id && b.date === date && active(b));
  const out = [];
  for (let t = s; t + dur <= e; t += RULES.STEP) {
    if (t < be && t + dur > bs) continue; // tanaffus
    if (date === now.date && t < now.min + RULES.LEAD) continue; // oʻtib ketgan/juda yaqin
    if (busy.some((b) => t < b.start + b.dur + RULES.BUF && t + dur + RULES.BUF > b.start)) continue;
    out.push(t);
  }
  return out;
}
// vaqt -> [boʻsh usta idlari]
export function slotMap(pool, date, dur, all, now) {
  const o = {};
  pool.forEach((m) => slots(m, date, dur, all, now).forEach((t) => (o[t] = o[t] || []).push(m.id)));
  return o;
}
