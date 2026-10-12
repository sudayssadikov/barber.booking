import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RequireRole from "./components/RequireRole.jsx";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import Book from "./pages/Book.jsx";
import Account from "./pages/Account.jsx";
import Bookings from "./pages/admin/Bookings.jsx";
import Users from "./pages/admin/Users.jsx";
import MasterSchedule from "./pages/MasterSchedule.jsx";

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
        <Route path="master" element={<RequireRole roles={["master"]}><MasterSchedule /></RequireRole>} />
        <Route path="admin" element={<RequireRole roles={["admin"]}><Bookings /></RequireRole>} />
        <Route path="admin/users" element={<RequireRole roles={["admin"]}><Users /></RequireRole>} />
        <Route path="*" element={<div className="w"><div className="empty" style={{ margin: "48px 0" }}>Sahifa topilmadi.</div></div>} />
      </Route>
    </Routes>
  );
}
