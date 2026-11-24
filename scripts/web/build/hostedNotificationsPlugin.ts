import {fileURLToPath} from "node:url";
import ts from "typescript";
import type {Plugin} from "vite";
import {HOSTED_PUSH_API_BASE, HOSTED_PUSH_WORKER_PATH} from "../../../src/notifications/contracts/hostedPush.ts";
import {notificationDeliveryForPlatform} from "../../../src/notifications/contracts/notificationPolicy.ts";

const apiModule = "/src/notifications/browser/hostedPush/api.ts";
const workerSource = fileURLToPath(new URL("../../../src/notifications/browser/hosted-notifications-worker.js", import.meta.url));
const networkNames = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"]);

/** Allows the configured hosted notification client without opening unrelated network paths. */
function assertHostedNetworkBoundary(code: string, id: string): void {
  if (!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/u.test(code)) return;
  const source = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression;
      const name = ts.isIdentifier(expression) ? expression.text :
        ts.isPropertyAccessExpression(expression) ? expression.name.text :
          ts.isElementAccessExpression(expression) && expression.argumentExpression && ts.isStringLiteral(expression.argumentExpression)
            ? expression.argumentExpression.text : undefined;
      if (name && networkNames.has(name) && !(name === "fetch" && id.split("?")[0].replaceAll("\\", "/").endsWith(apiModule))) {
        throw new Error(`Hosted notifications permit network requests only through their configured API client: ${id}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

/** Emits only the admitted target's notification worker and installation manifest. */
export function hostedNotificationsPlugin(target: string): Plugin | null {
  if (notificationDeliveryForPlatform(target) !== "hosted") return null;
  let building = false;
  return {
    name: "riddle-quest-hosted-notifications",
    enforce: "post",
    configResolved(config) {building = config.command === "build";},
    transform(code, id) {
      assertHostedNetworkBoundary(code, id);
      return null;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== HOSTED_PUSH_WORKER_PATH) {next(); return;}
        response.setHeader("Content-Type", "application/javascript");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Service-Worker-Allowed", "/");
        response.end(`import ${JSON.stringify(`/@fs/${workerSource}`)};`);
      });
    },
    buildStart() {
      if (!building) return;
      this.emitFile({type: "chunk", id: workerSource, fileName: HOSTED_PUSH_WORKER_PATH.slice(1)});
    },
    transformIndexHtml() {
      return [{tag: "link", attrs: {rel: "manifest", href: "./manifest.webmanifest"}, injectTo: "head"}];
    },
    generateBundle() {
      this.emitFile({type: "asset", fileName: "hosted-notifications-manifest.json", source: JSON.stringify({
        version: 1, target, apiBase: HOSTED_PUSH_API_BASE, workerPath: HOSTED_PUSH_WORKER_PATH,
      })});
      this.emitFile({type: "asset", fileName: "manifest.webmanifest", source: JSON.stringify({
        id: "/", name: "Riddle Quest", short_name: "Riddle Quest", start_url: "/", scope: "/", display: "standalone",
        background_color: "#15130f", theme_color: "#15130f",
      })});
    },
  };
}
