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

// Link previews of the home page (WhatsApp, Facebook…). Crawlers don't run
// JavaScript, and Vercel serves index.html before any rewrite, so the tags
// must be in the file itself. og:image needs an absolute URL: VITE_SITE_URL,
// or the production domain Vercel exposes while building.
function homePreview(): Plugin {
  const site = (
    process.env.VITE_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
  ).replace(/\/$/, "");
  const title = "ArtisanShop — Curated goods from independent makers";
  const description =
    "Premium goods made by independent artisans, shipped from their workshops. Pay on delivery or by EDAHABIA / CIB card.";
  const og: [string, string][] = [
    ["og:site_name", "ArtisanShop"],
    ["og:type", "website"],
    ["og:title", title],
    ["og:description", description],
    ...(site ? ([["og:url", `${site}/`]] as [string, string][]) : []),
    ["og:image", `${site}/og-image.png`],
    ["og:image:width", "1200"],
    ["og:image:height", "630"],
  ];
  return {
    name: "home-preview",
    transformIndexHtml: () => [
      ...og.map(([property, content]) => ({ tag: "meta", injectTo: "head" as const, attrs: { property, content } })),
      { tag: "meta", injectTo: "head" as const, attrs: { name: "twitter:card", content: "summary_large_image" } },
    ],
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker(), homePreview()],
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
