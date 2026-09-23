import { cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const configFile = resolve(repositoryRoot, "vite.config.ts");
const outputDirectory = resolve(repositoryRoot, "dist");

process.chdir(repositoryRoot);

await build({ configFile, mode: "background" });
await build({ configFile, mode: "content" });
await cp(resolve(repositoryRoot, "manifest.json"), resolve(outputDirectory, "manifest.json"));
await cp(resolve(repositoryRoot, "resources"), resolve(outputDirectory, "resources"), {
  recursive: true
});
