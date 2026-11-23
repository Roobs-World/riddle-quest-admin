import {defineConfig} from "vite";
import {createWebTargetViteConfig} from "./scripts/web/build/webTargetViteConfig.ts";

export default defineConfig(({command, mode}) =>
  createWebTargetViteConfig({command, mode, environment: process.env})
);
