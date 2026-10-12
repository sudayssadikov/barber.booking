import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
// Faqat shu qurilmaga tegishli holat (bron qoralamasi, mavzu) uchun localStorage qatlami.
// Asosiy maʼlumotlar serverda — bu yerda saqlanmaydi.
const mem = {};
const subs = new Set();
const raw = (k) => { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } };
const notify = () => subs.forEach((f) => f());
const sub = (f) => { subs.add(f); return () => subs.delete(f); };
window.addEventListener("storage", notify);

// Buzilgan JSON ilovani yiqitmasin — standart qiymat qaytariladi
const parse = (s, d) => { if (!s) return d; try { return JSON.parse(s) ?? d; } catch { return d; } };
export const read = (k, d) => parse(raw(k), d);
export const write = (k, v) => {
  const s = JSON.stringify(v);
  mem[k] = s;
  try { localStorage.setItem(k, s); } catch { /* xotira toʻla yoki taqiqlangan */ }
  notify();
};
export const useStored = (k, d) => {
  const s = useSyncExternalStore(sub, () => raw(k));
  return useMemo(() => parse(s, d), [s]); // eslint-disable-line react-hooks/exhaustive-deps
};
// Davriy qayta render: oʻtib ketgan vaqtlar va tugmalar holati yangilanib turadi
export const useTick = (ms = 30_000) => {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
};
