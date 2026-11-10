import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "fs";

// Emits dist/sw.js from ./sw.js with a per-build id, so each deploy ships a
// new service worker (which then drops the previous build's app shell).
function serviceWorker(): Plugin {
  return {
    name: "service-worker",
    apply: "build",
    generateBundle() {
      const source = readFileSync(path.resolve(import.meta.dirname, "sw.js"), "utf8").replace(
        "__BUILD_ID__",
        Date.now().toString(36),
      );
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // The end-to-end run points this at its own backend.
        target: process.env.VITE_API_PROXY ?? "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
