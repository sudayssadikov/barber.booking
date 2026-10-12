import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SALON } from "../../shared/config.js";
import Loading from "./Loading.jsx";

export default function Layout() {
  const { ready, error, user, needsSetup, logout, refresh } = useAuth();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("kb_t"); } catch { return null; } });
  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  if (!ready) return <Loading />;
  if (error && !user) return (
    <div className="w"><div className="empty stack" style={{ margin: "48px 0" }}>
      <span>{error.message}</span>
      <button className="btn sm" style={{ justifySelf: "center" }} onClick={refresh}>Qayta urinish</button>
    </div></div>
  );
  if (needsSetup && pathname !== "/setup") return <Navigate to="/setup" replace />;

  const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  const cls = ({ isActive }) => "nl" + (isActive ? " on" : "");
  return (
    <>
      <header>
        <div className="w nav">
          <Link to="/" className="logo" style={{ textDecoration: "none", color: "inherit" }}>Usta <b>Barber</b></Link>
          {!needsSetup && <NavLink to="/book" className={cls}>Yozilish</NavLink>}
          {user && <NavLink to="/account" className={cls}>Kabinet</NavLink>}
          {user?.role === "master" && <NavLink to="/master" className={cls}>Jadvalim</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin" end className={cls}>Bronlar</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin/users" className={cls}>Foydalanuvchilar</NavLink>}
          {!needsSetup && (user
            ? <button className="nl" onClick={async () => { await logout(); nav("/"); }}>Chiqish</button>
            : <NavLink to="/login" className={cls}>Kirish</NavLink>)}
          <button className="nl" aria-label="Rejimni almashtirish" onClick={() => { const n = dark ? "light" : "dark"; try { localStorage.setItem("kb_t", n); } catch { /* saqlanmasa ham rejim almashadi */ } setTheme(n); }}>{dark ? "☀" : "☾"}</button>
        </div>
      </header>
      <main><Outlet /></main>
      <footer><div className="w">© {SALON.name} · {SALON.addr} · {SALON.tel}</div></footer>
    </>
  );
}
