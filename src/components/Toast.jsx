import { createContext, useContext, useState, useCallback, useRef } from "react";
const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState("");
  const timer = useRef();
  // Yangi xabar oldingi taymerni bekor qiladi — aks holda u yangisini erta yopib yuboradi
  const show = useCallback((m) => { clearTimeout(timer.current); setMsg(m); timer.current = setTimeout(() => setMsg(""), 3400); }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </Ctx.Provider>
  );
}
