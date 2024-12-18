import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Polyfill global
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
});