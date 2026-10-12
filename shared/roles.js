export const ROLES = { admin: "Admin", master: "Usta", client: "Mijoz" };
export const ROLE_KEYS = Object.keys(ROLES);
const PERMS = {
  admin: ["users.manage", "bookings.all", "bookings.staff", "book"],
  master: ["bookings.staff", "book"],
  client: ["book"],
};
export const can = (user, perm) => !!user && user.status !== "blocked" && !!PERMS[user.role]?.includes(perm);
export const homeFor = (u) => (u?.role === "admin" ? "/admin" : u?.role === "master" ? "/master" : "/account");

// Bron holatlari oqimi: kalit — joriy holat, qiymat — oʻtish mumkin boʻlgan holatlar
export const TRANSITIONS = { pending: ["confirmed", "cancelled"], confirmed: ["done", "noshow", "cancelled"] };
export const canTransition = (from, to) => !!TRANSITIONS[from]?.includes(to);
