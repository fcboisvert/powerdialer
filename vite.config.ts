// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use ESM import.meta.url for cross-platform path resolving
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
