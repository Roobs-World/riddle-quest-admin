import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
import lighthouse from "lighthouse";
import {launch} from "chrome-launcher";

const root = path.resolve(import.meta.dirname, "..");
const clientRoot = path.join(root, "dist/client");
const port = 4183;
const contentTypes = new Map([
  [".css", "text/css"], [".html", "text/html"], [".js", "text/javascript"],
  [".json", "application/json"], [".svg", "image/svg+xml"], [".webp", "image/webp"],
  [".woff2", "font/woff2"], [".webm", "video/webm"],
]);

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (requestUrl.pathname === "/api/session") {
    response.writeHead(200, {"content-type": "application/json", "cache-control": "no-store"});
    response.end(JSON.stringify({ok: true, authenticated: false}));
    return;
  }
  const relative = requestUrl.pathname === "/" ? "splash.html" : requestUrl.pathname.replace(/^\//u, "");
  const file = path.resolve(clientRoot, relative);
  if (!file.startsWith(`${clientRoot}${path.sep}`)) { response.writeHead(404).end(); return; }
  try {
    let body = await readFile(file);
    if (relative === "splash.html") {
      body = Buffer.from(body.toString("utf8").replace("<head>", `<head><script>
globalThis.devvit={context:{},entrypoints:{game:"http://127.0.0.1:${port}/game.html"},token:"lighthouse",webViewMode:1};
</script>`));
    }
    response.writeHead(200, {
      "content-type": contentTypes.get(path.extname(file)) ?? "application/octet-stream",
      "cache-control": relative.endsWith(".html") ? "no-store" : "public, max-age=31536000, immutable",
    });
    response.end(body);
  } catch { response.writeHead(404).end(); }
});

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const chrome = await launch({chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"]});
try {
  const result = await lighthouse(`http://127.0.0.1:${port}/`, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance"],
    throttlingMethod: "provided",
  });
  if (!result) throw new Error("Lighthouse returned no result");
  const score = Math.round((result.lhr.categories.performance.score ?? 0) * 100);
  const firstContentfulPaintMs = result.lhr.audits["first-contentful-paint"]?.numericValue;
  const diagnostics = ["largest-contentful-paint", "total-blocking-time", "speed-index"]
    .map((id) => `${id}=${Math.round(result.lhr.audits[id]?.numericValue ?? -1)}ms`).join(", ");
  if (score < 80) throw new Error(`Reddit inline Lighthouse performance score ${score} is below 80 (${diagnostics})`);
  if (typeof firstContentfulPaintMs !== "number" || firstContentfulPaintMs > 1_000) {
    throw new Error(`Reddit inline first contentful paint ${firstContentfulPaintMs ?? "missing"}ms exceeds 1000ms`);
  }
  console.log(`Reddit inline Lighthouse passed: performance ${score}, first contentful paint ${Math.round(firstContentfulPaintMs)}ms`);
} finally {
  await chrome.kill();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
