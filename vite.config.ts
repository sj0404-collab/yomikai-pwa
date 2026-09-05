import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base './' — сборка живёт и на GitHub Pages (подкаталог), и на любом домене.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
