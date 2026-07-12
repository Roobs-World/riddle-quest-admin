import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath, URL} from "node:url";

export default defineConfig({
  base: "/riddle-quest/",
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react()],
  resolve: {
    alias: {
      "@qwordly/core/bridge/constants": fileURLToPath(new URL("../core/src/bridge/constants.ts", import.meta.url)),
      "@qwordly/core/bridge": fileURLToPath(new URL("../core/src/bridge/index.ts", import.meta.url)),
      "@qwordly/core/pricing/catalog": fileURLToPath(new URL("../core/src/pricing/catalog.ts", import.meta.url)),
      "@qwordly/core/validation": fileURLToPath(new URL("../core/src/validation/index.ts", import.meta.url)),
      "@qwordly/core/game": fileURLToPath(new URL("../core/src/game/index.ts", import.meta.url)),
      "@qwordly/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.PORTAL_SOURCEMAPS === "1",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            const normalizedId = id.replaceAll("\\", "/");
            if (
              normalizedId.includes("/node_modules/react/") ||
              normalizedId.includes("/node_modules/react-dom/") ||
              normalizedId.includes("/node_modules/scheduler/")
            ) {
              return "vendor-react";
            }
            if (normalizedId.includes("/node_modules/@clerk/")) {
              return "vendor-clerk";
            }
            if (id.includes("/zod/")) {
              return "vendor-zod";
            }
          }

          if (id.includes("/src/i18n/")) {
            return "app-i18n";
          }
          if (id.includes("/packages/core/src/bridge/constants.ts")) {
            return "core-bridge-constants";
          }
          if (id.includes("/packages/core/src/bridge/")) {
            return "core-bridge";
          }
          if (id.includes("/packages/core/src/validation/")) {
            return "core-validation";
          }
          if (id.includes("/packages/core/src/game/")) {
            return "core-game";
          }
          if (id.includes("/packages/core/src/pricing/")) {
            return "core-pricing";
          }
        },
      },
    },
  },
});
