import { read, write } from "./store";
import { SERVICES, RULES } from "../config/content";
import { active, eligible, slotMap, nowTK, minsTo, canCancel, inWindow } from "./availability";

export const TRANSITIONS = { pending: ["confirmed", "cancelled"], confirmed: ["done", "noshow", "cancelled"] };
const KEY = "kb_b";
export const allBookings = () => read(KEY, []);
const patch = (id, p) => write(KEY, allBookings().map((x) => (x.id === id ? { ...x, ...p } : x)));

export function createBooking(user, d) {
  if (!user) return { error: "Avval akkauntingizga kiring." };
  const svcIds = [...new Set(d.svc || [])];
  const sv = svcIds.map((id) => SERVICES.find((s) => s.id === id));
  if (!sv.length || sv.some((s) => !s)) return { error: "Xizmatlar notoʻgʻri tanlangan. Qaytadan tanlang.", restart: true };
  const now = nowTK();
  if (!inWindow(d.date, now) || !Number.isInteger(d.time)) return { error: "Sana yoki vaqt eskirgan. Boshqa vaqtni tanlang.", retime: true };
  const dur = sv.reduce((a, s) => a + s.min, 0);
  const price = sv.reduce((a, s) => a + s.price, 0);
  const all = allBookings();
  const ids = slotMap(eligible(svcIds, d.master), d.date, dur, all, now)[d.time];
  if (!ids?.length) return { error: "Bu vaqt band boʻlib qoldi. Boshqa vaqtni tanlang.", retime: true };
  const mine = all.filter((b) => b.userId === user.id && active(b) && minsTo(b) + b.dur > 0);
  if (mine.length >= RULES.MAX_ACTIVE) return { error: `Bir vaqtda ${RULES.MAX_ACTIVE} tadan ortiq faol yozilish boʻlishi mumkin emas.` };
  if (mine.some((b) => b.date === d.date && d.time < b.start + b.dur && d.time + dur > b.start)) return { error: "Bu vaqtda sizda boshqa yozilish bor." };
  // "Istalgan usta": shu kuni eng kam band boʻlgan ustaga tushadi
  const load = (id) => all.filter((b) => b.masterId === id && b.date === d.date && active(b)).length;
  const masterId = ids.reduce((best, id) => (load(id) < load(best) ? id : best));
  const b = { id: crypto.randomUUID(), userId: user.id, name: user.name, phone: user.phone, masterId, svc: svcIds, date: d.date, start: d.time, dur, price, status: "pending", created: Date.now() };
  write(KEY, [...all, b]);
  return { booking: b };
}

// admin — hamma bronlar, usta — faqat oʻziniki
export const manages = (u, b) => !!u && (u.role === "admin" || (u.role === "master" && u.masterId === b.masterId));
// Natija: null — muvaffaqiyatli, aks holda xato matni
export function setStatus(user, id, status) {
  const b = allBookings().find((x) => x.id === id); // eskirgan UI holati emas, saqlangan holat tekshiriladi
  if (!b) return "Bron topilmadi";
  if (!manages(user, b)) return "Ruxsat yoʻq";
  if (!TRANSITIONS[b.status]?.includes(status)) return "Bu holatni oʻzgartirib boʻlmaydi";
  if ((status === "done" || status === "noshow") && minsTo(b) > 0) return "Vaqti kelgach belgilanadi";
  patch(id, { status });
  return null;
}
export function cancelOwn(user, id) {
  const b = allBookings().find((x) => x.id === id);
  if (!b || !user || b.userId !== user.id || !canCancel(b)) return false;
  patch(id, { status: "cancelled" });
  return true;
}
export const cancelAllFor = (userId) =>
  write(KEY, allBookings().map((b) => (b.userId === userId && active(b) ? { ...b, status: "cancelled" } : b)));
// Ism oʻzgarsa, kelgusi bronlardagi nusxa ham yangilanadi
export const renameIn = (userId, name) =>
  write(KEY, allBookings().map((b) => (b.userId === userId && active(b) ? { ...b, name } : b)));
