import {defineConfig} from "vite";
import {createWebTargetViteConfig} from "../../../packages/web-game/webTargetViteConfig.ts";

export default defineConfig(({command}) =>
  createWebTargetViteConfig({command, mode: "jest", environment: process.env}),
);
