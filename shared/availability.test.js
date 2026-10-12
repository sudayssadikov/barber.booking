import { describe, it, expect } from "vitest";
import { slots, slotMap, freeDays, inWindow, canCancel, canMark, quote, pickMaster, clashes, byTime, phoneDigits, addD } from "./availability.js";
import { byMaster, RULES } from "./config.js";

// 2026-10-12 — dushanba, Toshkent vaqti 10:00
const now = { date: "2026-10-12", min: 600 };
const m1 = byMaster("m1"); // 10:00–20:00, tanaffus 14:00–15:00, yakshanba dam
const bk = (p) => ({ masterId: "m1", date: "2026-10-13", start: 600, dur: 45, status: "pending", ...p });

describe("slots", () => {
  it("ish vaqti va tanaffusni hisobga oladi", () => {
    const s = slots(m1, "2026-10-13", 45, [], now);
    expect(s[0]).toBe(600);
    expect(s.at(-1) + 45).toBeLessThanOrEqual(1200);
    expect(s.some((t) => t < 900 && t + 45 > 840)).toBe(false); // 14:00–15:00 band emas
  });
  it("dam olish kunida boʻsh vaqt yoʻq", () => {
    expect(slots(m1, "2026-10-18", 45, [], now)).toEqual([]); // yakshanba
  });
  it("bugun uchun oʻtgan va LEAD daqiqadan yaqin vaqtlarni bermaydi", () => {
    expect(slots(m1, now.date, 45, [], now)[0]).toBe(600 + RULES.LEAD);
  });
  it("oʻtgan sana va oynadan tashqari sana — boʻsh", () => {
    expect(slots(m1, "2026-10-11", 45, [], now)).toEqual([]);
    expect(slots(m1, addD(now.date, RULES.AHEAD), 45, [], now)).toEqual([]);
  });
  it("faol bronlar bilan kesishgan vaqtlarni chiqarmaydi, bekor qilinganlarni hisobga olmaydi", () => {
    const s = slots(m1, "2026-10-13", 45, [bk({})], now);
    expect(s).not.toContain(600);
    expect(s).not.toContain(630);
    expect(s).toContain(660);
    expect(slots(m1, "2026-10-13", 45, [bk({ status: "cancelled" })], now)).toContain(600);
    expect(slots(m1, "2026-10-13", 45, [bk({ masterId: "m2" })], now)).toContain(600);
  });
});

describe("slotMap / freeDays / pickMaster", () => {
  it("vaqt boʻyicha boʻsh ustalarni yigʻadi", () => {
    const map = slotMap([byMaster("m1"), byMaster("m3")], "2026-10-13", 45, [bk({})], now);
    expect(map[600]).toEqual(["m3"]);
  });
  it("freeDays boʻsh kunlarni tashlab yuboradi", () => {
    const days = freeDays([m1], 45, [], now);
    expect(days["2026-10-18"]).toBeUndefined();
    expect(days["2026-10-13"].length).toBeGreaterThan(0);
  });
  it("eng kam band ustani tanlaydi", () => {
    expect(pickMaster(["m1", "m3"], [bk({ start: 900 })], "2026-10-13")).toBe("m3");
    expect(pickMaster(["m1", "m3"], [], "2026-10-13")).toBe("m1");
  });
});

describe("qoidalar", () => {
  it("inWindow", () => {
    expect(inWindow("2026-10-12", now)).toBe(true);
    expect(inWindow("2026-10-11", now)).toBe(false);
    expect(inWindow("2026-13-40", now)).toBe(false);
    expect(inWindow(undefined, now)).toBe(false);
  });
  it("canCancel — CANCEL_H soatdan oldin", () => {
    expect(canCancel(bk({ date: now.date, start: 600 + RULES.CANCEL_H * 60 }), now)).toBe(true);
    expect(canCancel(bk({ date: now.date, start: 600 + RULES.CANCEL_H * 60 - 1 }), now)).toBe(false);
    expect(canCancel(bk({ status: "done" }), now)).toBe(false);
  });
  it("canMark — vaqti kelgach", () => {
    expect(canMark(bk({ date: now.date, start: 600 }), now)).toBe(true);
    expect(canMark(bk({ date: now.date, start: 630 }), now)).toBe(false);
  });
  it("quote notoʻgʻri xizmatlarni rad etadi va takrorlarni olib tashlaydi", () => {
    expect(quote([])).toBeNull();
    expect(quote(["s1", "nope"])).toBeNull();
    expect(quote("s1")).toBeNull();
    expect(quote(["s1", "s1", "s2"])).toMatchObject({ ids: ["s1", "s2"], dur: 75, price: 130000 });
  });
  it("clashes faqat faol va kesishgan bronlarni sanaydi", () => {
    expect(clashes([bk({})], "2026-10-13", 630, 30)).toBe(true);
    expect(clashes([bk({})], "2026-10-13", 645, 30)).toBe(false);
    expect(clashes([bk({ status: "cancelled" })], "2026-10-13", 630, 30)).toBe(false);
  });
  it("byTime raqamli saralaydi", () => {
    expect([bk({ start: 1200 }), bk({ start: 600 })].sort(byTime).map((b) => b.start)).toEqual([600, 1200]);
  });
  it("phoneDigits", () => {
    expect(phoneDigits("+998 90 123-45-67")).toBe("901234567");
    expect(phoneDigits("90 123 45 67")).toBe("901234567");
  });
});
