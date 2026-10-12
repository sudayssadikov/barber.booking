# Usta Barber — onlayn yozilish

React (Vite) frontend + Node.js (Express 5) API + SQLite. Bron qilish mantigʻi bitta umumiy modulda — client ham, server ham aynan shu koddan foydalanadi, lekin **yakuniy qaror har doim serverda**.

```bash
npm install
npm run dev      # API (:3001) + Vite (:5173), /api proxy orqali
npm test         # domen va API testlari (Vitest)
npm run lint     # ESLint
npm run check    # lint + test + build (CI shuni ishlatadi)

npm run build && npm start   # production: frontend ham API ham bitta portda (:3001)
```

Talab: **Node.js ≥ 22.13** (oʻrnatilgan `node:sqlite` ishlatiladi — native modul build qilinmaydi).

## Arxitektura

```
shared/            client + server uchun umumiy, sof funksiyalar
  config.js        salon, xizmatlar, ustalar, qoidalar — egasi shu faylni oʻzgartiradi
  availability.js  boʻsh vaqt, oyna, bekor qilish/belgilash qoidalari, narx hisobi
  roles.js         rollar, ruxsatlar, bron holatlari oqimi
  validation.js    ism/telefon/parol qoidalari (forma va API bir xil)
server/
  app.js           Express ilova (createApp — testlarda vaqt va baza beriladi)
  repo.js          SQL qatlami
  db.js            SQLite, migratsiyalar, tranzaksiya
  security.js      scrypt parol xeshi, sessiya tokenlari
  index.js         ishga tushirish, toʻxtatish, eskirgan sessiyalarni tozalash
src/               React UI (api.js — yagona server klienti, hooks/useApi.js — soʻrov holati)
```

## Muhim kafolatlar

- **Ikki kishi bir vaqtni band qila olmaydi** — bron `BEGIN IMMEDIATE` tranzaksiyasida qayta tekshirilib yoziladi (parallel soʻrovlar testi bor).
- **Narx, davomiylik va usta serverda hisoblanadi** — clientdan kelgan qiymatlarga ishonilmaydi.
- Oʻtgan sana, `AHEAD` kundan keyingi sana, tanaffus, dam olish kuni, `LEAD` daqiqadan yaqin vaqt — rad etiladi.
- Mijozda bir vaqtda `MAX_ACTIVE` tadan ortiq faol bron boʻlmaydi, oʻz bronlari bir-biriga toʻgʻri kelmaydi.
- Bekor qilish — vaqtdan `CANCEL_H` soat oldingacha. "Bajarildi/Kelmadi" — vaqti kelgach. Holatlar faqat `pending → confirmed → done|noshow`, `pending|confirmed → cancelled` boʻyicha oʻzgaradi.
- "Istalgan usta" — shu kuni eng kam band ustaga tushadi.

## Xavfsizlik

- Parollar: `scrypt` + tasodifiy salt; kamida 8 belgi, harf va raqam.
- Sessiya: `httpOnly`, `SameSite=Lax` cookie; bazada tokenning faqat SHA-256 xeshi saqlanadi.
- CSRF: oʻzgartiruvchi soʻrovlar `X-Requested-With: fetch` sarlavhasisiz rad etiladi.
- 5 ta xato urinishdan keyin raqam 1 daqiqaga qulflanadi; mavjud boʻlmagan raqam uchun ham parol tekshiriladi (vaqt boʻyicha raqam borligini bilib boʻlmaydi).
- Bloklash/oʻchirish/parolni tiklash foydalanuvchining sessiyalarini darhol yopadi; bloklash va oʻchirishda kelgusi bronlar bekor qilinadi, tarix saqlanadi.
- Kamida bitta faol admin qoladi; admin oʻzini bloklay, oʻchira yoki rolini oʻzgartira olmaydi.

## Rollar

| Rol | Imkoniyat |
|---|---|
| Mijoz | Bron qilish, oʻz bronlarini koʻrish/bekor qilish, profil va parol |
| Usta | Mijoz imkoniyatlari + oʻz jadvali (`/master`): tasdiqlash, bajarildi, kelmadi |
| Admin | Hamma bronlar (`/admin`) va foydalanuvchilar (`/admin/users`) |

Birinchi ishga tushishda `/setup` salon egasi (admin) akkauntini yaratadi.

## Sozlash (muhit oʻzgaruvchilari)

| Oʻzgaruvchi | Standart | Maʼnosi |
|---|---|---|
| `PORT` | `3001` | API porti |
| `DB_FILE` | `data/app.db` | SQLite fayli |
| `COOKIE_SECURE` | — | HTTPS ortida `1` qiling |

## API

| Metod | Yoʻl | Kim |
|---|---|---|
| GET | `/api/me` | hamma |
| POST | `/api/auth/setup` · `/register` · `/login` · `/logout` | hamma |
| PATCH | `/api/me` · POST `/api/me/password` | kirgan |
| GET | `/api/availability?svc=s1,s2&master=any` | hamma |
| POST | `/api/bookings` · GET `/api/bookings/mine` · POST `/api/bookings/:id/cancel` | kirgan |
| GET | `/api/bookings?date=…` / `?status=pending` · PATCH `/api/bookings/:id` | usta (oʻziniki), admin |
| GET/POST | `/api/users` · PATCH/DELETE `/api/users/:id` · POST `/api/users/:id/password` | admin |
