# Usta Barber — onlayn yozilish (React + Vite, JSX)

```bash
npm install
npm run dev      # ishlab chiqish
npm run build    # production (dist/)
```

## Rollar
| Rol | Imkoniyat |
|---|---|
| Mijoz | Bron qilish, oʻz bronlarini koʻrish/bekor qilish, profil va parol |
| Usta | Mijozning hamma imkoniyati + oʻz jadvali (`/master`): tasdiqlash, bajarildi, kelmadi |
| Admin | Hamma bronlar (`/admin`) va foydalanuvchilar boshqaruvi (`/admin/users`) |

Birinchi ishga tushishda `/setup` ekrani salon egasi (admin) akkauntini yaratadi.
Himoyalar: kamida bitta faol admin qoladi, oʻzini bloklash/oʻchirish/rolini oʻzgartirish taqiqlangan,
bloklangan yoki oʻchirilgan foydalanuvchi sessiyasi darhol tugaydi, 5 ta xato urinishdan keyin 1 daqiqa kutish.

## Tuzilma
- `src/config/content.js` — salon, xizmatlar, ustalar, qoidalar (egasi shu faylni oʻzgartiradi)
- `src/lib/` — `store` (localStorage qatlami), `availability` (boʻsh vaqt), `bookings`, `roles`
- `src/context/AuthContext.jsx` — akkaunt va foydalanuvchilar boshqaruvi
- `src/components/`, `src/pages/` — UI

## Eslatma
Ma'lumotlar brauzerda (localStorage) saqlanadi. Bir nechta qurilmadan real foydalanish uchun
`src/lib/store.js` va `src/context/AuthContext.jsx` ni backend (API) bilan almashtirish kerak.
SPA uchun serverda barcha yoʻllar `index.html` ga yoʻnaltirilsin.
