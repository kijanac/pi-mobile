import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwind from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [solid(), tailwind()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // expose to LAN so Capacitor live-reload works on a real device
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
