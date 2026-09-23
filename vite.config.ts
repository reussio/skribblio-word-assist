import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  plugins: [react()],
  publicDir: false,
  build: {
    cssCodeSplit: false,
    emptyOutDir: true,
    lib: {
      cssFileName: "content",
      entry: `${sourceRoot}/content/main.tsx`,
      fileName: () => "content.js",
      formats: ["iife"],
      name: "SkribblioContent"
    },
    minify: "oxc",
    outDir: "dist",
    target: "chrome114"
  }
});
