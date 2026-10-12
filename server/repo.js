// SQL qatlami: route'lar toʻgʻridan-toʻgʻri SQL yozmaydi, faqat shu funksiyalarni chaqiradi.
const ACTIVE = "status IN ('pending', 'confirmed')";

export const toUser = (r) => r && ({
  id: r.id, name: r.name, phone: r.phone, role: r.role, masterId: r.master_id ?? null, status: r.status, createdAt: r.created_at,
});
export const toBooking = (r) => r && ({
  id: r.id, userId: r.user_id ?? null, name: r.name, phone: r.phone, masterId: r.master_id, svc: JSON.parse(r.services),
  date: r.date, start: r.start, dur: r.dur, price: r.price, status: r.status, created: r.created_at, updated: r.updated_at,
});

export function createRepo(db) {
  const q = (sql) => db.prepare(sql);
  const s = {
    userById: q("SELECT * FROM users WHERE id = ?"),
    userByPhone: q("SELECT * FROM users WHERE phone = ?"),
    userByMaster: q("SELECT * FROM users WHERE master_id = ?"),
    users: q("SELECT * FROM users ORDER BY created_at"),
    userCount: q("SELECT COUNT(*) AS n FROM users"),
    adminsExcept: q("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND id != ?"),
    insertUser: q(`INSERT INTO users (id, name, phone, pw_hash, role, master_id, status, created_at)
                   VALUES ($id, $name, $phone, $pwHash, $role, $masterId, 'active', $createdAt)`),
    updateUser: q("UPDATE users SET name = $name, role = $role, master_id = $masterId, status = $status WHERE id = $id"),
    setPw: q("UPDATE users SET pw_hash = ? WHERE id = ?"),
    deleteUser: q("DELETE FROM users WHERE id = ?"),

    sessionUser: q(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`),
    insertSession: q("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
    deleteSession: q("DELETE FROM sessions WHERE token_hash = ?"),
    deleteSessionsOf: q("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?"),
    purgeSessions: q("DELETE FROM sessions WHERE expires_at <= ?"),

    attempt: q("SELECT * FROM login_attempts WHERE phone = ?"),
    setAttempt: q(`INSERT INTO login_attempts (phone, fails, locked_until) VALUES (?, ?, ?)
                   ON CONFLICT(phone) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until`),
    clearAttempt: q("DELETE FROM login_attempts WHERE phone = ?"),

    bookingById: q("SELECT * FROM bookings WHERE id = ?"),
    activeBetween: q(`SELECT * FROM bookings WHERE date >= ? AND date < ? AND ${ACTIVE}`),
    activeOn: q(`SELECT * FROM bookings WHERE date = ? AND ${ACTIVE}`),
    activeOfUser: q(`SELECT * FROM bookings WHERE user_id = ? AND ${ACTIVE}`),
    ofUser: q("SELECT * FROM bookings WHERE user_id = ? ORDER BY date DESC, start DESC LIMIT 200"),
    onDate: q("SELECT * FROM bookings WHERE date = $date AND ($m IS NULL OR master_id = $m) ORDER BY start"),
    pending: q("SELECT * FROM bookings WHERE status = 'pending' AND date >= $from AND ($m IS NULL OR master_id = $m) ORDER BY date, start"),
    stats: q(`SELECT
                SUM(CASE WHEN date = $today AND status IN ('pending', 'confirmed', 'done') THEN 1 ELSE 0 END) AS today,
                SUM(CASE WHEN status = 'pending' AND date >= $today THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'done' AND date >= $monthStart THEN price ELSE 0 END) AS revenue
              FROM bookings WHERE $m IS NULL OR master_id = $m`),
    insertBooking: q(`INSERT INTO bookings (id, user_id, name, phone, master_id, services, date, start, dur, price, status, created_at, updated_at)
                      VALUES ($id, $userId, $name, $phone, $masterId, $services, $date, $start, $dur, $price, 'pending', $now, $now)`),
    setStatus: q("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?"),
    renameIn: q(`UPDATE bookings SET name = ? WHERE user_id = ? AND ${ACTIVE}`),
  };
  const all = (stmt, ...a) => stmt.all(...a);

  return {
    userById: (id) => s.userById.get(id),
    userByPhone: (phone) => s.userByPhone.get(phone),
    userByMaster: (masterId) => s.userByMaster.get(masterId),
    users: () => all(s.users).map(toUser),
    userCount: () => s.userCount.get().n,
    activeAdminsExcept: (id) => s.adminsExcept.get(id).n,
    insertUser: (u) => s.insertUser.run({ id: u.id, name: u.name, phone: u.phone, pwHash: u.pwHash, role: u.role, masterId: u.masterId, createdAt: u.createdAt }),
    updateUser: (u) => s.updateUser.run({ id: u.id, name: u.name, role: u.role, masterId: u.masterId, status: u.status }),
    setPassword: (id, hash) => s.setPw.run(hash, id),
    deleteUser: (id) => s.deleteUser.run(id),

    sessionUser: (tokenHash, now) => toUser(s.sessionUser.get(tokenHash, now)),
    insertSession: (tokenHash, userId, expiresAt) => s.insertSession.run(tokenHash, userId, expiresAt),
    deleteSession: (tokenHash) => s.deleteSession.run(tokenHash),
    // keepHash — joriy sessiya saqlanib qoladi (masalan, parolni oʻzi almashtirganda)
    deleteSessionsOf: (userId, keepHash = "") => s.deleteSessionsOf.run(userId, keepHash),
    purgeSessions: (now) => s.purgeSessions.run(now),

    attempt: (phone) => s.attempt.get(phone),
    setAttempt: (phone, fails, lockedUntil) => s.setAttempt.run(phone, fails, lockedUntil),
    clearAttempt: (phone) => s.clearAttempt.run(phone),

    bookingById: (id) => toBooking(s.bookingById.get(id)),
    activeBetween: (from, to) => all(s.activeBetween, from, to).map(toBooking),
    activeOn: (date) => all(s.activeOn, date).map(toBooking),
    activeOfUser: (userId) => all(s.activeOfUser, userId).map(toBooking),
    ofUser: (userId) => all(s.ofUser, userId).map(toBooking),
    onDate: (date, masterId) => all(s.onDate, { date, m: masterId ?? null }).map(toBooking),
    pending: (from, masterId) => all(s.pending, { from, m: masterId ?? null }).map(toBooking),
    stats: (today, masterId) => {
      const r = s.stats.get({ today, monthStart: `${today.slice(0, 7)}-01`, m: masterId ?? null });
      return { today: r.today ?? 0, pending: r.pending ?? 0, revenue: r.revenue ?? 0 };
    },
    insertBooking: (b) => s.insertBooking.run({
      id: b.id, userId: b.userId, name: b.name, phone: b.phone, masterId: b.masterId, services: JSON.stringify(b.svc),
      date: b.date, start: b.start, dur: b.dur, price: b.price, now: b.created,
    }),
    setStatus: (id, status, now) => s.setStatus.run(status, now, id),
    renameIn: (userId, name) => s.renameIn.run(name, userId),
  };
}
