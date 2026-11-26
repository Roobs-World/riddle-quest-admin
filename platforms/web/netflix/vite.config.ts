import {defineConfig} from "vite";
import {createWebTargetViteConfig} from "../../../scripts/web/build/webTargetViteConfig.ts";

export default defineConfig(({command}) =>
  createWebTargetViteConfig({command, mode: "netflix", environment: process.env}),
);
