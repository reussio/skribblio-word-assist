import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ mode }) => {
  const isBackgroundBuild = mode === "background";
  if (!isBackgroundBuild && mode !== "content") {
    throw new Error(`Unknown build mode: ${mode}`);
  }

  const entryName = isBackgroundBuild ? "background" : "content";

  return {
    define: {
      "process.env.NODE_ENV": JSON.stringify("production")
    },
    plugins: isBackgroundBuild ? [] : [react()],
    publicDir: false,
    build: {
      cssCodeSplit: false,
      emptyOutDir: isBackgroundBuild,
      lib: {
        cssFileName: "content",
        entry: `${sourceRoot}/${entryName === "background" ? "background.ts" : "content/main.tsx"}`,
        fileName: () => `${entryName}.js`,
        formats: ["iife"],
        name: isBackgroundBuild ? "SkribblioBackground" : "SkribblioContent"
      },
      minify: "oxc",
      outDir: "dist",
      target: "chrome114"
    }
  };
});
