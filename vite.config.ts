import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  return {
    plugins: [react()],
    // Serve at / for local dev; build with relative paths for portability
    base: command === "serve" ? "/" : "./",
    build: {
      sourcemap: true,
    },
  };
});

