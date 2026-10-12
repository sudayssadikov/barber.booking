// Salon egasi faqat shu faylni oʻzgartiradi.
export const SALON = {
  name: "Usta Barber",
  addr: "Toshkent sh., Chilonzor, 9-kvartal",
  tel: "+998 90 123 45 67",
  hours: "Du–Sha 09:00–20:00 · Yakshanba — dam olish kuni",
};
export const RULES = { STEP: 30, BUF: 0, LEAD: 30, AHEAD: 14, CANCEL_H: 3, MAX_ACTIVE: 3 };
export const SERVICES = [
  { id: "s1", name: "Soch olish", min: 45, price: 80000, d: "Yuvish, kesish va yoʻnalish berish" },
  { id: "s2", name: "Soqol dizayni", min: 30, price: 50000, d: "Shakl berish, issiq sochiq bilan" },
  { id: "s3", name: "Soch + soqol", min: 75, price: 120000, d: "Toʻliq obraz bir qatnovda" },
  { id: "s4", name: "Bolalar soch olishi", min: 30, price: 60000, d: "12 yoshgacha bolalar uchun" },
  { id: "s5", name: "Yuz parvarishi", min: 40, price: 90000, d: "Tozalash va namlantirish" },
  { id: "s6", name: "Soch boʻyash", min: 90, price: 160000, d: "Rang tanlash va boʻyash" },
];
// img — ixtiyoriy: oʻz serveringizdagi rasm manzili
export const MASTERS = [
  { id: "m1", name: "Jasur Karimov", role: "Katta barber", exp: 7, img: "", work: ["10:00", "20:00"], brk: ["14:00", "15:00"], off: [0], svc: ["s1", "s2", "s3", "s5", "s6"] },
  { id: "m2", name: "Dilshod Rahimov", role: "Barber", exp: 4, img: "", work: ["09:00", "19:00"], brk: ["13:00", "14:00"], off: [1], svc: ["s1", "s2", "s3", "s4"] },
  { id: "m3", name: "Malika Yusupova", role: "Stilist", exp: 5, img: "", work: ["10:00", "19:00"], brk: ["13:30", "14:30"], off: [0], svc: ["s1", "s4", "s5", "s6"] },
];
export const STATUS = { pending: "Kutilmoqda", confirmed: "Tasdiqlangan", done: "Bajarilgan", cancelled: "Bekor qilingan", noshow: "Kelmadi" };
export const byService = (id) => SERVICES.find((s) => s.id === id);
export const byMaster = (id) => MASTERS.find((m) => m.id === id);
