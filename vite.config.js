import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": `http://localhost:${process.env.PORT || 3001}` } },
  test: { environment: "node", include: ["{shared,server}/**/*.test.js"] },
});
