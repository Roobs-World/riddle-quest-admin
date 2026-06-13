import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/riddle-quest/admin/",
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
