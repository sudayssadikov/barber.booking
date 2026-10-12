// Kiritmalar tekshiruvi. Xato boʻlsa matn, toʻgʻri boʻlsa null qaytaradi — forma ham, API ham bir xil qoida.
export const PHONE_RE = /^\+998\d{9}$/;
export const PW_MIN = 8;
export const PW_MAX = 128;

export const checkName = (v) => {
  const n = typeof v === "string" ? v.trim() : "";
  return n.length < 2 ? "Ism kamida 2 ta harf boʻlsin" : n.length > 60 ? "Ism juda uzun" : null;
};
export const checkPhone = (v) => (typeof v === "string" && PHONE_RE.test(v) ? null : "Telefon raqam 9 ta raqamdan iborat boʻlsin (masalan 901234567)");
export const checkPassword = (v) =>
  typeof v !== "string" || v.length < PW_MIN ? `Parol kamida ${PW_MIN} ta belgi boʻlsin`
    : v.length > PW_MAX ? "Parol juda uzun"
    : !/\d/.test(v) || !/\p{L}/u.test(v) ? "Parolda kamida bitta harf va bitta raqam boʻlsin"
    : null;
// Birinchi topilgan xato
export const firstError = (...errs) => errs.find(Boolean) || null;
