import {defineConfig} from "vite";
import {createWebTargetViteConfig} from "./webTargetViteConfig.ts";

export default defineConfig(({command, mode}) =>
  createWebTargetViteConfig({command, mode, environment: process.env})
);
