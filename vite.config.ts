import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  return {
    // Serve at / for local dev; build with relative paths for portability
    // (Vercel, GitHub Pages subpaths, itch.io zip, Cloudflare Pages).
    base: command === "serve" ? "/" : "./",
    build: {
      sourcemap: true,
    },
  };
});

