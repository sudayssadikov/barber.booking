import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const KEYLEN = 64;

// Format: scrypt$<salt base64>$<kalit base64>
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(pw, stored) {
  const [alg, salt, key] = String(stored).split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const got = await scrypt(String(pw), Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(got, expected);
}
// Mavjud boʻlmagan raqam uchun ham parol tekshiriladi — javob vaqti boʻyicha raqam borligini bilib boʻlmaydi
let dummy;
export const dummyHash = async () => (dummy ??= await hashPassword(randomBytes(12).toString("hex")));

export const newToken = () => randomBytes(32).toString("base64url");
// Bazada tokenning oʻzi emas, xeshi saqlanadi: baza sizib chiqsa ham sessiyalarni oʻgʻirlab boʻlmaydi
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
