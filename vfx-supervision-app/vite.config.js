import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  // All app data lives in the browser's localStorage, which is scoped to
  // the exact origin (host + port) — a silent port fallback (Vite's
  // default when 5173 is already taken, e.g. by a leftover dev server
  // from an earlier session) lands you on a different origin with none of
  // your projects visible. strictPort makes that a loud "port in use"
  // error instead of a silent, confusing empty project list.
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
