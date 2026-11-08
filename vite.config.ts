import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

// KAPITAL_TARGET=artifact builds one self-contained bundle (no service worker,
// relative paths) that can be inlined into a single HTML page.
const artifact = process.env.KAPITAL_TARGET === "artifact";

export default defineConfig({
  // one version number for the app, taken from package.json
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  base: artifact ? "./" : "/",
  plugins: [
    react(),
    VitePWA({
      disable: artifact,
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/mark.svg"],
      manifest: {
        name: "Ardessa — деньги и дела",
        short_name: "Ardessa",
        description: "Деньги и дела в одном приложении: кошельки, аналитика, цели, задачи, заметки",
        lang: "ru",
        theme_color: "#070708",
        background_color: "#070708",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest,woff2}"]
      }
    })
  ],
  build: {
    target: "es2021",
    chunkSizeWarningLimit: 700,
    outDir: artifact ? "dist-artifact" : "dist",
    // The single-file page can't load anything beside it — inline the fonts too.
    assetsInlineLimit: artifact ? 1_000_000 : 4096,
    rollupOptions: {
      output: artifact
        ? { inlineDynamicImports: true }
        : {
            // Libraries change rarely — keep them in their own long-cached chunks.
            // Icons go in one chunk too, instead of dozens of tiny files.
            manualChunks(id) {
              // icon path data changes rarely too
              if (id.includes("/src/ui/glyphData")) return "icons";
              if (!id.includes("node_modules")) return;
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
              if (id.includes("node_modules/framer-motion") || id.includes("node_modules/motion-")) return "motion";
              if (id.includes("node_modules/zustand")) return "state";
              if (id.includes("node_modules/@phosphor-icons")) return "icons";
            }
          }
    }
  },
  server: { host: true, port: 5173 }
});
