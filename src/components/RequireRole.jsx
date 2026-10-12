import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) {
    return <div className="w"><div className="empty" style={{ margin: "48px 0" }}>Bu sahifaga kirish huquqingiz yoʻq.</div></div>;
  }
  return children;
}
