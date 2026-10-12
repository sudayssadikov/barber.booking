// Ishlab chiqish: API (qayta yuklanadigan) + Vite bir vaqtda. Qoʻshimcha paket talab qilmaydi.
import { spawn } from "node:child_process";

const run = (args) => spawn(process.execPath, args, { stdio: "inherit" });
const procs = [
  run(["--watch-path=server", "--watch-path=shared", "server/index.js"]),
  run(["node_modules/vite/bin/vite.js"]),
];
const stop = (code = 0) => { procs.forEach((p) => p.kill()); process.exit(code); };
procs.forEach((p) => p.on("exit", (code) => stop(code ?? 0)));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
