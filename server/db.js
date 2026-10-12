import { createRequire } from "node:module";

// node:sqlite faqat "node:" prefiksi bilan mavjud; Vite/Vitest esa importdagi prefiksni olib tashlaydi.
// require orqali yuklash bu muammoni chetlab oʻtadi.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");

// Har bir element — bitta migratsiya. Yangisini faqat oxiriga qoʻshing, eskisini oʻzgartirmang.
const MIGRATIONS = [
  `CREATE TABLE users (
     id         TEXT PRIMARY KEY,
     name       TEXT NOT NULL,
     phone      TEXT NOT NULL UNIQUE,
     pw_hash    TEXT NOT NULL,
     role       TEXT NOT NULL CHECK (role IN ('admin', 'master', 'client')),
     master_id  TEXT UNIQUE,
     status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
     created_at INTEGER NOT NULL,
     CHECK ((role = 'master') = (master_id IS NOT NULL))
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE bookings (
     id         TEXT PRIMARY KEY,
     user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
     name       TEXT NOT NULL,
     phone      TEXT NOT NULL,
     master_id  TEXT NOT NULL,
     services   TEXT NOT NULL,
     date       TEXT NOT NULL,
     start      INTEGER NOT NULL,
     dur        INTEGER NOT NULL CHECK (dur > 0),
     price      INTEGER NOT NULL CHECK (price >= 0),
     status     TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'done', 'noshow', 'cancelled')),
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE INDEX bookings_master_date ON bookings(master_id, date);
   CREATE INDEX bookings_user ON bookings(user_id);
   CREATE INDEX bookings_date ON bookings(date);
   CREATE TABLE login_attempts (
     phone        TEXT PRIMARY KEY,
     fails        INTEGER NOT NULL,
     locked_until INTEGER NOT NULL DEFAULT 0
   );`,
];

export function openDb(file = ":memory:") {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  MIGRATIONS.slice(version).forEach((sql, i) =>
    tx(db, () => { db.exec(sql); db.exec(`PRAGMA user_version = ${version + i + 1}`); }));
  return db;
}

// Sinxron tranzaksiya: BEGIN IMMEDIATE yozish qulfini darhol oladi, shuning uchun
// "tekshir → yoz" ketma-ketligi (masalan, vaqt boʻshmi → bron) boshqa jarayon bilan aralashmaydi.
export function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
