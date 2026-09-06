import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// MPA: семь независимых PWA — по одной на вкладку. Каждая собирается в свою
// директорию dist/<tab>/ со своим manifest и (после сборки) своим sw.js.
// base './' — работает и на GitHub Pages (подкаталог), и на любом домене.
const TABS = ["library", "browse", "history", "reader", "web", "ai", "more"];

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: Object.fromEntries(TABS.map((t) => [t, `${t}/index.html`])),
    },
  },
});
