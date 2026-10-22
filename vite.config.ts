import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// KAPITAL_TARGET=artifact builds one self-contained bundle (no service worker,
// relative paths) that can be inlined into a single HTML page.
const artifact = process.env.KAPITAL_TARGET === "artifact";

export default defineConfig({
  base: artifact ? "./" : "/",
  plugins: [
    react(),
    VitePWA({
      disable: artifact,
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/mark.svg"],
      manifest: {
        name: "Капитал — личные финансы",
        short_name: "Капитал",
        description: "Личные финансы: кошельки, операции, аналитика, цели, бюджеты и планы",
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
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"]
      }
    })
  ],
  build: {
    target: "es2021",
    chunkSizeWarningLimit: 700,
    outDir: artifact ? "dist-artifact" : "dist",
    rollupOptions: {
      output: artifact
        ? { inlineDynamicImports: true }
        : {
            // Libraries change rarely — keep them in their own long-cached chunks.
            manualChunks: { react: ["react", "react-dom"], motion: ["framer-motion"], state: ["zustand"] }
          }
    }
  },
  server: { host: true, port: 5173 }
});
