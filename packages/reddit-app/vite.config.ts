import {defineConfig} from "vite";

export default defineConfig({
  ssr: {
    // Devvit executes the uploaded CJS file without a project node_modules
    // directory. Bundle every non-Node dependency into that single artifact.
    noExternal: true,
  },
  build: {
    ssr: "src/server/index.ts",
    outDir: "dist/server",
    emptyOutDir: false,
    rolldownOptions: {
      output: {format: "cjs", entryFileNames: "index.cjs"},
    },
  },
});
