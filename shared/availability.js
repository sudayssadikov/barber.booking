// Bron qilish domen mantigʻi. Sof funksiyalar: client ham, server ham aynan shu koddan foydalanadi.
// Vaqtlar kun boshidan beri daqiqalarda (600 = 10:00), sanalar "YYYY-MM-DD" (Toshkent vaqti).
import { MASTERS, RULES, byService } from "./config.js";

export const WD = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
export const MO = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const toMin = (t) => { const [h, m] = t.split(":"); return +h * 60 + +m; };
export const fT = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const money = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} soʻm`;
export const dow = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
export const fD = (s) => { const d = new Date(`${s}T00:00:00Z`); return `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`; };
export const addD = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// "+998 90 123-45-67" yoki "901234567" -> "901234567" (milliy 9 xonali qism)
export const phoneDigits = (v) => { const d = String(v).replace(/\D/g, ""); return (d.length > 9 && d.startsWith("998") ? d.slice(3) : d).slice(0, 9); };

// Toshkent vaqti (qurilma/server vaqt zonasidan mustaqil)
export const nowTK = (at = new Date()) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(at).reduce((a, x) => ((a[x.type] = x.value), a), {});
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
};

// Sana bron qilish oynasidami: bugundan RULES.AHEAD kun ichida
export const inWindow = (date, now) =>
  typeof date === "string" && DATE_RE.test(date) && !Number.isNaN(Date.parse(date)) && date >= now.date && date < addD(now.date, RULES.AHEAD);
export const windowDates = (now) => Array.from({ length: RULES.AHEAD }, (_, i) => addD(now.date, i));
// Sana + boshlanish vaqti boʻyicha (raqamli) saralash
export const byTime = (a, b) => a.date.localeCompare(b.date) || a.start - b.start;

export const active = (b) => b.status === "pending" || b.status === "confirmed";
export const minsTo = (b, now) => (Date.parse(b.date) - Date.parse(now.date)) / 60000 + b.start - now.min;
export const isPast = (b, now) => minsTo(b, now) + b.dur <= 0;
export const isUpcoming = (b, now) => active(b) && !isPast(b, now);
export const canCancel = (b, now) => active(b) && minsTo(b, now) >= RULES.CANCEL_H * 60;
// "Bajarildi"/"Kelmadi" faqat bron vaqti boshlangach belgilanadi
export const canMark = (b, now) => minsTo(b, now) <= 0;

// Xizmatlar roʻyxatini tekshiradi va narx/davomiylikni hisoblaydi; notoʻgʻri boʻlsa null
export function quote(svcIds) {
  if (!Array.isArray(svcIds) || svcIds.length === 0 || svcIds.length > 10) return null;
  const ids = [...new Set(svcIds)];
  const sv = ids.map(byService);
  if (sv.some((s) => !s)) return null;
  return { ids, items: sv, dur: sv.reduce((a, s) => a + s.min, 0), price: sv.reduce((a, s) => a + s.price, 0) };
}

export const eligible = (svc, master = "any") =>
  MASTERS.filter((m) => svc.every((s) => m.svc.includes(s)) && (master === "any" || m.id === master));

const overlaps = (t, dur, b) => t < b.start + b.dur + RULES.BUF && t + dur + RULES.BUF > b.start;

// Ustaning shu kundagi boʻsh boshlanish vaqtlari
export function slots(m, date, dur, bookings, now) {
  if (!inWindow(date, now) || m.off.includes(dow(date))) return [];
  const s = toMin(m.work[0]), e = toMin(m.work[1]), bs = toMin(m.brk[0]), be = toMin(m.brk[1]);
  const busy = bookings.filter((b) => b.masterId === m.id && b.date === date && active(b));
  const out = [];
  for (let t = s; t + dur <= e; t += RULES.STEP) {
    if (t < be && t + dur > bs) continue; // tanaffus
    if (date === now.date && t < now.min + RULES.LEAD) continue; // oʻtib ketgan/juda yaqin
    if (busy.some((b) => overlaps(t, dur, b))) continue;
    out.push(t);
  }
  return out;
}
// vaqt -> [boʻsh usta idlari]
export function slotMap(pool, date, dur, bookings, now) {
  const o = {};
  pool.forEach((m) => slots(m, date, dur, bookings, now).forEach((t) => (o[t] = o[t] || []).push(m.id)));
  return o;
}
// Butun oyna boʻyicha: sana -> [boʻsh vaqtlar] (boʻsh kunlar kiritilmaydi)
export function freeDays(pool, dur, bookings, now) {
  const out = {};
  for (const d of windowDates(now)) {
    const times = Object.keys(slotMap(pool, d, dur, bookings, now)).map(Number).sort((a, b) => a - b);
    if (times.length) out[d] = times;
  }
  return out;
}
// "Istalgan usta": shu kuni eng kam band boʻlganiga; teng boʻlsa roʻyxatdagi tartib boʻyicha
export function pickMaster(ids, bookings, date) {
  const load = (id) => bookings.filter((b) => b.masterId === id && b.date === date && active(b)).length;
  return ids.reduce((best, id) => (load(id) < load(best) ? id : best));
}
// Mijozning ikki broni bir-biriga toʻgʻri kelmasin
export const clashes = (mine, date, start, dur) => mine.some((b) => active(b) && b.date === date && start < b.start + b.dur && start + dur > b.start);
