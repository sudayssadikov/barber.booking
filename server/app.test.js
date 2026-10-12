import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb } from "./db.js";
import { createApp } from "./app.js";

// 2026-10-12 05:00 UTC = Toshkent 10:00, dushanba
const START = "2026-10-12T05:00:00Z";
const PW = "parol1234";

let srv, base, clock;
beforeEach(async () => {
  clock = new Date(START);
  const app = createApp({ db: openDb(":memory:"), clock: () => clock });
  srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  base = `http://127.0.0.1:${srv.address().port}/api`;
});
afterEach(() => srv.close());
const advance = (ms) => { clock = new Date(clock.getTime() + ms); };

// Har bir mijoz oʻz cookie'sini saqlaydi (brauzer kabi)
function client() {
  let cookie = "";
  const call = async (method, path, body, headers = { "X-Requested-With": "fetch" }) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...headers, ...(body && { "Content-Type": "application/json" }), ...(cookie && { cookie }) },
      body: body && JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  return {
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b ?? {}),
    patch: (p, b) => call("PATCH", p, b),
    del: (p) => call("DELETE", p),
    raw: call,
  };
}
const phone = (n) => `+99890000000${n}`;
async function setupAdmin() {
  const a = client();
  const r = await a.post("/auth/setup", { name: "Ega", phone: phone(1), pw: PW });
  expect(r.status).toBe(201);
  return { c: a, user: r.body.user };
}
async function registered(n, name = `Mijoz ${n}`) {
  const c = client();
  const r = await c.post("/auth/register", { name, phone: phone(n), pw: PW });
  expect(r.status).toBe(201);
  return { c, user: r.body.user };
}
const book = (c, p = {}) => c.post("/bookings", { svc: ["s1"], master: "m1", date: "2026-10-13", time: 600, ...p });

describe("auth", () => {
  it("birinchi foydalanuvchi — admin; setup ikkinchi marta ishlamaydi", async () => {
    expect((await client().get("/me")).body).toEqual({ user: null, needsSetup: true });
    expect((await client().post("/auth/register", { name: "Xurshid", phone: phone(2), pw: PW })).status).toBe(409);
    const { user } = await setupAdmin();
    expect(user.role).toBe("admin");
    expect(user.pw_hash).toBeUndefined();
    expect((await client().post("/auth/setup", { name: "Boshqa", phone: phone(3), pw: PW })).status).toBe(409);
  });

  it("roʻyxatdan oʻtgan foydalanuvchi — mijoz; takror raqam rad etiladi", async () => {
    await setupAdmin();
    const { c, user } = await registered(2);
    expect(user.role).toBe("client");
    expect((await c.get("/me")).body.user.id).toBe(user.id);
    expect((await client().post("/auth/register", { name: "Yusuf", phone: phone(2), pw: PW })).status).toBe(409);
  });

  it("kiritmalar serverda tekshiriladi", async () => {
    await setupAdmin();
    const c = client();
    expect((await c.post("/auth/register", { name: "A", phone: phone(2), pw: PW })).status).toBe(400);
    expect((await c.post("/auth/register", { name: "Ali", phone: "12345", pw: PW })).status).toBe(400);
    expect((await c.post("/auth/register", { name: "Ali", phone: phone(2), pw: "short" })).status).toBe(400);
    expect((await c.post("/auth/register", { name: "Ali", phone: phone(2), pw: "faqatharflar" })).status).toBe(400);
  });

  it("CSRF sarlavhasisiz oʻzgartiruvchi soʻrov rad etiladi", async () => {
    const r = await client().raw("POST", "/auth/setup", { name: "Ega", phone: phone(1), pw: PW }, {});
    expect(r.status).toBe(403);
  });

  it("5 ta xato urinishdan keyin 1 daqiqa qulf", async () => {
    await setupAdmin();
    const c = client();
    for (let i = 0; i < 5; i++) expect((await c.post("/auth/login", { phone: phone(1), pw: "notogri123" })).status).toBe(401);
    expect((await c.post("/auth/login", { phone: phone(1), pw: PW })).status).toBe(429);
    advance(61_000);
    expect((await c.post("/auth/login", { phone: phone(1), pw: PW })).status).toBe(200);
  });

  it("parol almashtirilsa boshqa sessiyalar yopiladi, joriysi qoladi", async () => {
    await setupAdmin();
    const { c } = await registered(2);
    const other = client();
    await other.post("/auth/login", { phone: phone(2), pw: PW });
    expect((await c.post("/me/password", { old: "notogri123", next: "yangi12345" })).status).toBe(400);
    expect((await c.post("/me/password", { old: PW, next: "yangi12345" })).status).toBe(204);
    expect((await c.get("/me")).body.user).not.toBeNull();
    expect((await other.get("/me")).body.user).toBeNull();
  });

  it("chiqishdan keyin sessiya ishlamaydi", async () => {
    const { c } = await setupAdmin();
    expect((await c.post("/auth/logout")).status).toBe(204);
    expect((await c.get("/users")).status).toBe(401);
  });
});

describe("bronlar", () => {
  it("boʻsh vaqtlar ochiq, notoʻgʻri xizmat — 400", async () => {
    const r = await client().get("/availability?svc=s1&master=m1");
    expect(r.body.days["2026-10-13"]).toContain(600);
    expect(r.body.days["2026-10-18"]).toBeUndefined(); // yakshanba
    expect((await client().get("/availability?svc=zzz")).status).toBe(400);
  });

  it("bir vaqtni ikki kishi band qila olmaydi; 'istalgan usta' boshqasiga tushadi", async () => {
    await setupAdmin();
    const a = await registered(2), b = await registered(3), c = await registered(4);
    const r1 = await book(a.c);
    expect(r1.status).toBe(201);
    expect(r1.body.booking).toMatchObject({ masterId: "m1", status: "pending", dur: 45, price: 80000, name: "Mijoz 2" });
    const r2 = await book(b.c);
    expect(r2.status).toBe(409);
    expect(r2.body.code).toBe("slot_taken");
    const r3 = await book(c.c, { master: "any" });
    expect(r3.status).toBe(201);
    expect(r3.body.booking.masterId).not.toBe("m1");
    expect((await client().get("/availability?svc=s1&master=m1")).body.days["2026-10-13"]).not.toContain(600);
  });

  it("parallel soʻrovlarda ham faqat bittasi oʻtadi", async () => {
    await setupAdmin();
    const users = await Promise.all([2, 3, 4, 5, 6].map((n) => registered(n)));
    const rs = await Promise.all(users.map((u) => book(u.c)));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
  });

  it("narx va davomiylik serverda hisoblanadi (clientga ishonilmaydi)", async () => {
    await setupAdmin();
    const { c } = await registered(2);
    const r = await book(c, { svc: ["s1", "s2", "s1"], price: 1, dur: 1 });
    expect(r.body.booking).toMatchObject({ svc: ["s1", "s2"], dur: 75, price: 130000 });
  });

  it("oʻtgan sana, oynadan tashqari sana va notoʻgʻri vaqt rad etiladi", async () => {
    await setupAdmin();
    const { c } = await registered(2);
    expect((await book(c, { date: "2026-10-11" })).status).toBe(409);
    expect((await book(c, { date: "2026-10-26" })).status).toBe(409);
    expect((await book(c, { time: 605 })).status).toBe(409);
    expect((await book(c, { time: "600" })).status).toBe(409);
    expect((await book(c, { date: "2026-10-12", time: 600 })).status).toBe(409); // LEAD dan yaqin
    expect((await book(c, { svc: ["s4"], master: "m1" })).status).toBe(400); // m1 bolalar soch olmaydi
  });

  it("faol bronlar soni va oʻz bronlari kesishishi cheklanadi", async () => {
    await setupAdmin();
    const { c } = await registered(2);
    expect((await book(c, { master: "m3", time: 600 })).status).toBe(201);
    expect((await book(c, { master: "m1", time: 630 })).body.error).toMatch(/boshqa yozilish/);
    expect((await book(c, { time: 720 })).status).toBe(201);
    expect((await book(c, { time: 900 })).status).toBe(201);
    expect((await book(c, { time: 1020 })).body.error).toMatch(/faol yozilish/);
  });

  it("mijoz faqat oʻz bronini va muddatidan oldin bekor qiladi", async () => {
    await setupAdmin();
    const a = await registered(2), b = await registered(3);
    const far = (await book(a.c)).body.booking;
    const near = (await book(a.c, { date: "2026-10-12", time: 660 })).body.booking;
    expect((await b.c.post(`/bookings/${far.id}/cancel`)).status).toBe(404);
    expect((await a.c.post(`/bookings/${near.id}/cancel`)).status).toBe(409);
    expect((await a.c.post(`/bookings/${far.id}/cancel`)).body.booking.status).toBe("cancelled");
    expect((await a.c.get("/bookings/mine")).body.items).toHaveLength(2);
  });

  it("mijoz xodimlar API'siga kira olmaydi", async () => {
    await setupAdmin();
    const { c } = await registered(2);
    expect((await c.get("/bookings")).status).toBe(403);
    expect((await c.get("/users")).status).toBe(403);
    expect((await client().post("/bookings", {})).status).toBe(401);
  });
});

describe("xodimlar", () => {
  it("usta faqat oʻz bronlarini koʻradi va boshqaradi; holatlar oqimi tekshiriladi", async () => {
    const admin = await setupAdmin();
    expect((await admin.c.post("/users", { name: "Jasur", phone: phone(5), pw: PW, role: "master", masterId: "m1" })).status).toBe(201);
    expect((await admin.c.post("/users", { name: "Boshqa", phone: phone(6), pw: PW, role: "master", masterId: "m1" })).status).toBe(409);
    const master = client();
    await master.post("/auth/login", { phone: phone(5), pw: PW });
    const { c } = await registered(2);
    const mine = (await book(c, { date: "2026-10-12", time: 660 })).body.booking;
    const other = (await book(c, { master: "m3", date: "2026-10-13", time: 600 })).body.booking;

    const list = await master.get("/bookings?date=2026-10-12");
    expect(list.body.items.map((b) => b.id)).toEqual([mine.id]);
    expect(list.body.stats).toMatchObject({ today: 1, pending: 1 });
    expect((await master.get("/bookings?status=pending")).body.items).toHaveLength(1);
    expect((await master.patch(`/bookings/${other.id}`, { status: "confirmed" })).status).toBe(404);

    expect((await master.patch(`/bookings/${mine.id}`, { status: "done" })).status).toBe(409); // pending → done yoʻq
    expect((await master.patch(`/bookings/${mine.id}`, { status: "confirmed" })).status).toBe(200);
    expect((await master.patch(`/bookings/${mine.id}`, { status: "done" })).body.error).toMatch(/Vaqti kelgach/);
    advance(60 * 60_000);
    expect((await master.patch(`/bookings/${mine.id}`, { status: "done" })).body.booking.status).toBe("done");
    expect((await master.patch(`/bookings/${mine.id}`, { status: "cancelled" })).status).toBe(409);
    expect((await admin.c.get("/bookings?date=2026-10-12")).body.stats.revenue).toBe(80000);
  });

  it("oxirgi admin himoyalangan; oʻzini bloklash/oʻchirish mumkin emas", async () => {
    const { c, user } = await setupAdmin();
    expect((await c.patch(`/users/${user.id}`, { status: "blocked" })).status).toBe(409);
    expect((await c.patch(`/users/${user.id}`, { role: "client" })).status).toBe(409);
    expect((await c.del(`/users/${user.id}`)).status).toBe(409);
    const second = (await c.post("/users", { name: "Admin 2", phone: phone(7), pw: PW, role: "admin" })).body.user;
    const c2 = client();
    await c2.post("/auth/login", { phone: phone(7), pw: PW });
    expect((await c2.patch(`/users/${user.id}`, { status: "blocked" })).status).toBe(200);
    // endi second yagona faol admin — birinchi admin uni bloklay olmaydi (u allaqachon chiqarilgan)
    expect((await c.get("/me")).body.user).toBeNull();
    expect((await c2.patch(`/users/${second.id}`, { role: "client" })).status).toBe(409);
  });

  it("bloklangan foydalanuvchi darhol chiqariladi, kelgusi bronlari bekor qilinadi", async () => {
    const admin = await setupAdmin();
    const { c, user } = await registered(2);
    const b = (await book(c)).body.booking;
    expect((await admin.c.patch(`/users/${user.id}`, { status: "blocked" })).status).toBe(200);
    expect((await c.get("/me")).body.user).toBeNull();
    expect((await c.post("/auth/login", { phone: phone(2), pw: PW })).status).toBe(403);
    expect((await admin.c.get("/bookings?date=2026-10-13")).body.items.find((x) => x.id === b.id).status).toBe("cancelled");
  });

  it("ism oʻzgarsa faol bronlardagi ism ham yangilanadi; oʻchirilganda tarix qoladi", async () => {
    const admin = await setupAdmin();
    const { c, user } = await registered(2);
    const b = (await book(c)).body.booking;
    await c.patch("/me", { name: "Yangi Ism" });
    let row = (await admin.c.get("/bookings?date=2026-10-13")).body.items[0];
    expect(row.name).toBe("Yangi Ism");
    expect((await admin.c.del(`/users/${user.id}`)).status).toBe(204);
    row = (await admin.c.get("/bookings?date=2026-10-13")).body.items[0];
    expect(row).toMatchObject({ id: b.id, status: "cancelled", userId: null });
  });

  it("usta profilini almashtirish va rolni oʻzgartirish", async () => {
    const admin = await setupAdmin();
    const { user } = await registered(2);
    expect((await admin.c.patch(`/users/${user.id}`, { role: "master" })).status).toBe(400);
    expect((await admin.c.patch(`/users/${user.id}`, { role: "master", masterId: "m2" })).body.user.masterId).toBe("m2");
    expect((await admin.c.patch(`/users/${user.id}`, { masterId: "m3" })).body.user.masterId).toBe("m3");
    expect((await admin.c.patch(`/users/${user.id}`, { role: "client" })).body.user.masterId).toBeNull();
  });
});
