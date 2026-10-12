import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, post, onUnauthorized } from "../api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// Sessiya httpOnly cookie'da — JS uni oʻqiy olmaydi. Holat serverdan /api/me orqali olinadi.
export function AuthProvider({ children }) {
  const [state, setState] = useState({ ready: false, user: null, needsSetup: false, error: null });

  const refresh = useCallback(async () => {
    try {
      const r = await api("/me");
      setState({ ready: true, user: r.user, needsSetup: r.needsSetup, error: null });
    } catch (error) {
      setState((s) => ({ ...s, ready: true, error }));
    }
  }, []);

  useEffect(() => {
    refresh();
    return onUnauthorized(() => setState((s) => ({ ...s, user: null })));
  }, [refresh]);

  const value = useMemo(() => {
    const enter = (path) => async (data) => {
      const { user } = await post(path, data);
      setState({ ready: true, user, needsSetup: false, error: null });
      return user;
    };
    return {
      ...state,
      refresh,
      login: enter("/auth/login"),
      register: enter("/auth/register"),
      setup: enter("/auth/setup"),
      logout: async () => {
        await post("/auth/logout").catch(() => {});
        setState((s) => ({ ...s, user: null }));
      },
    };
  }, [state, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
