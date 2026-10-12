import { useEffect, useReducer, useState } from "react";
import { api, onChange } from "../api";

/**
 * GET soʻrov holati. path = null boʻlsa soʻrov yuborilmaydi.
 * Qayta yuklanadi: mutatsiyadan keyin, oynaga qaytilganda va (poll berilsa) davriy.
 */
export function useApi(path, { poll = 0 } = {}) {
  const [state, setState] = useState({ path: null, data: undefined, error: null });
  const [version, reload] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    api(path).then(
      (data) => live && setState({ path, data, error: null }),
      (error) => live && setState((s) => ({ path, data: s.path === path ? s.data : undefined, error })),
    );
    return () => { live = false; };
  }, [path, version]);

  useEffect(() => {
    const offChange = onChange(reload);
    const onFocus = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onFocus);
    const t = poll ? setInterval(onFocus, poll) : null;
    return () => { offChange(); document.removeEventListener("visibilitychange", onFocus); clearInterval(t); };
  }, [poll]);

  // Boshqa path uchun qolgan eski maʼlumot koʻrsatilmaydi
  const fresh = path && state.path === path;
  return { data: fresh ? state.data : undefined, error: fresh ? state.error : null, loading: !!path && !fresh, reload };
}

// Tugma bosilganda bajariladigan amal: ikki marta yuborilmaydi, xato toast bilan koʻrsatiladi
export function useAction(toast) {
  const [busy, setBusy] = useState(false);
  const run = async (fn, okMsg) => {
    if (busy) return undefined;
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) toast(okMsg);
      return r ?? true;
    } catch (e) {
      toast(e.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return [run, busy];
}
