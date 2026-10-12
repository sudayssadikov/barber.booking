export const ROLES = { admin: "Admin", master: "Usta", client: "Mijoz" };
const PERMS = {
  admin: ["users.manage", "bookings.all", "bookings.own", "book"],
  master: ["bookings.own", "book"],
  client: ["book"],
};
export const can = (user, perm) => !!user && user.status !== "blocked" && !!PERMS[user.role]?.includes(perm);
export const homeFor = (u) => (u?.role === "admin" ? "/admin" : u?.role === "master" ? "/master" : "/account");
