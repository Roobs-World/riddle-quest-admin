import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath, URL} from "node:url";

export default defineConfig({
  base: process.env.JEST_BUILD === "1" ? "./" : "/riddle-quest/",
  envPrefix: "VITE_",
  plugins: [react()],
  resolve: {
    alias: {
      "@qwordly/core/bridge/constants": fileURLToPath(new URL("../core/src/bridge/constants.ts", import.meta.url)),
      "@qwordly/core/bridge": fileURLToPath(new URL("../core/src/bridge/index.ts", import.meta.url)),
      "@qwordly/core/pricing/catalog": fileURLToPath(new URL("../core/src/pricing/catalog.ts", import.meta.url)),
      "@qwordly/core/race": fileURLToPath(new URL("../core/src/race/index.ts", import.meta.url)),
      "@qwordly/core/validation": fileURLToPath(new URL("../core/src/validation/index.ts", import.meta.url)),
      "@qwordly/core/game": fileURLToPath(new URL("../core/src/game/index.ts", import.meta.url)),
      "@qwordly/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.PORTAL_SOURCEMAPS === "1",
    chunkSizeWarningLimit: 450,
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-three",
              test: /node_modules[\\/]three[\\/]src[\\/]/,
              maxSize: 280 * 1024,
              priority: 25,
            },
            {
              name: "vendor-firebase",
              test: /node_modules[\\/](?:@firebase|firebase)[\\/]/,
              priority: 20,
            },
            {name: "vendor-zod", test: /node_modules[\\/]zod[\\/]/, priority: 20},
            {name: "app-i18n", test: /[\\/]src[\\/]i18n[\\/]/, priority: 15},
            {
              name: "core-bridge-constants",
              test: /[\\/]packages[\\/]core[\\/]src[\\/]bridge[\\/]constants\.ts$/,
              priority: 15,
            },
            {name: "core-bridge", test: /[\\/]packages[\\/]core[\\/]src[\\/]bridge[\\/]/, priority: 10},
            {name: "core-validation", test: /[\\/]packages[\\/]core[\\/]src[\\/]validation[\\/]/, priority: 10},
            {name: "core-game", test: /[\\/]packages[\\/]core[\\/]src[\\/]game[\\/]/, priority: 10},
            {name: "core-pricing", test: /[\\/]packages[\\/]core[\\/]src[\\/]pricing[\\/]/, priority: 10},
          ],
        },
      },
    },
  },
});
