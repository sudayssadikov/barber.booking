import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { createApp, purgeExpiredSessions } from "./app.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3001;
const DB_FILE = process.env.DB_FILE || path.join(root, "data", "app.db");

mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = openDb(DB_FILE);
const app = createApp({
  db,
  secureCookies: process.env.COOKIE_SECURE === "1",
  staticDir: path.join(root, "dist"), // build qilingan boʻlsa, frontend ham shu serverdan beriladi
});

purgeExpiredSessions(db);
const purge = setInterval(() => purgeExpiredSessions(db), 3600_000);
purge.unref();

const server = app.listen(PORT, () => console.log(`API: http://localhost:${PORT}  (baza: ${DB_FILE})`));

// Toʻxtatishda ochiq soʻrovlar tugatiladi va baza toʻgʻri yopiladi
const shutdown = () => {
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
