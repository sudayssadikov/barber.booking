import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RequireRole from "./components/RequireRole.jsx";
import Loading from "./components/Loading.jsx";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import Book from "./pages/Book.jsx";
import Account from "./pages/Account.jsx";

// Xodimlar sahifalari alohida yuklanadi — mijozlar uchun asosiy JS yengilroq
const Bookings = lazy(() => import("./pages/admin/Bookings.jsx"));
const Users = lazy(() => import("./pages/admin/Users.jsx"));
const MasterSchedule = lazy(() => import("./pages/MasterSchedule.jsx"));

const Staff = ({ roles, children }) => <RequireRole roles={roles}><Suspense fallback={<Loading />}>{children}</Suspense></RequireRole>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="book" element={<Book />} />
        <Route path="login" element={<Auth mode="login" />} />
        <Route path="register" element={<Auth mode="register" />} />
        <Route path="setup" element={<Auth mode="setup" />} />
        <Route path="account" element={<RequireRole><Account /></RequireRole>} />
        <Route path="master" element={<Staff roles={["master"]}><MasterSchedule /></Staff>} />
        <Route path="admin" element={<Staff roles={["admin"]}><Bookings /></Staff>} />
        <Route path="admin/users" element={<Staff roles={["admin"]}><Users /></Staff>} />
        <Route path="*" element={<div className="w"><div className="empty" style={{ margin: "48px 0" }}>Sahifa topilmadi.</div></div>} />
      </Route>
    </Routes>
  );
}
