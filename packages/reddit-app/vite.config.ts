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
    // The client is staged in dist/client, so the server build can and must
    // replace its own directory without retaining files from an older release.
    emptyOutDir: true,
    rolldownOptions: {
      output: {format: "cjs", entryFileNames: "index.cjs"},
    },
  },
});
