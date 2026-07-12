import {chromium} from "@playwright/test";
import {spawnSync} from "node:child_process";
import {createServer} from "node:http";
import {mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const distDir = path.join(packageRoot, "dist");
const publicSnapshotPath = path.join(packageRoot, "public/performance/latest.json");
const distSnapshotPath = path.join(distDir, "performance/latest.json");

const args = new Set(process.argv.slice(2));
const runCountArg = process.argv.find((arg) => arg.startsWith("--runs="));
const runCount = runCountArg ? Number(runCountArg.split("=")[1]) : 3;
const skipBuild = args.has("--skip-build");

const budgets = {
  dclMs: 800,
  fcpMs: 1800,
  initialBytes: 500_000,
  requests: 20,
};

const routes = [
  {
    id: "admin",
    label: "Admin portal",
    path: "/riddle-quest/admin/",
    waitFor: async (page) => {
      await page.waitForFunction(() => document.body.innerText.trim().length > 0, undefined, {timeout: 5000});
    },
  },
  {
    id: "play-host",
    label: "Playable host",
    path: "/riddle-quest/play/?harness=jest",
    waitFor: async (page) => {
      await page.getByRole("button", {name: /guest/i}).waitFor({timeout: 5000});
    },
  },
  {
    id: "game-frame",
    label: "Game iframe",
    path: "/riddle-quest/play/game/?harness=jest",
    waitFor: async (page) => {
      await page.getByText(/Waiting for the host wrapper/i).waitFor({timeout: 5000});
    },
  },
  {
    id: "performance",
    label: "Performance dashboard",
    path: "/riddle-quest/performance/",
    waitFor: async (page) => {
      await page.getByText(/Riddle Quest Web Vitals|Snapshot unavailable/i).waitFor({timeout: 5000});
    },
  },
];

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const runCommand = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? packageRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    process.stderr.write(output);
    throw new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${result.status}.`);
  }
  return output;
};

const sortNumbers = (values) => [...values].sort((left, right) => left - right);
const median = (values) => {
  const filtered = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (filtered.length === 0) return null;
  return sortNumbers(filtered)[Math.floor(filtered.length / 2)];
};

const getCommit = () => {
  try {
    return runCommand("git", ["rev-parse", "--short", "HEAD"], {cwd: repoRoot}).trim();
  } catch {
    return null;
  }
};

const listTopAssets = async () => {
  const assetsDir = path.join(distDir, "assets");
  const names = await readdir(assetsDir);
  const assets = await Promise.all(
    names.map(async (name) => {
      const details = await stat(path.join(assetsDir, name));
      return {name, bytes: details.size};
    }),
  );
  return assets.sort((left, right) => right.bytes - left.bytes).slice(0, 20);
};

const countSourcemaps = async () => {
  const assetsDir = path.join(distDir, "assets");
  const names = await readdir(assetsDir);
  return names.filter((name) => name.endsWith(".map")).length;
};

const createStaticServer = () => {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname.startsWith("/_vercel/")) {
      response.writeHead(204, {"Content-Type": "text/javascript; charset=utf-8"});
      response.end("");
      return;
    }

    const pathname = requestUrl.pathname.replace(/^\/riddle-quest\//u, "/");
    const candidate = path.join(distDir, pathname === "/" ? "index.html" : pathname);
    const filePath = path.extname(candidate) ? candidate : path.join(distDir, "index.html");

    try {
      await stat(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      });
      response.end(await readFile(filePath));
    } catch {
      if (path.extname(candidate)) {
        response.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      });
      response.end(await readFile(path.join(distDir, "index.html")));
    }
  });
};

const measureRoutes = async () => {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({headless: true});
  const issues = [];

  try {
    const routeMetrics = [];

    for (const route of routes) {
      const runs = [];
      let initialAssets = [];

      for (let run = 1; run <= runCount; run += 1) {
        const context = await browser.newContext({viewport: {width: 1280, height: 900}, bypassCSP: true});
        const page = await context.newPage();
        const assets = [];
        let bytes = 0;
        let requests = 0;

        page.on("response", async (response) => {
          requests += 1;
          const responseUrl = response.url();
          if (responseUrl.includes("/assets/")) {
            assets.push(path.basename(new URL(responseUrl).pathname));
          }
          try {
            const body = await response.body();
            bytes += body.byteLength;
          } catch {
            // Opaque browser-internal responses are ignored.
          }
        });
        page.on("console", (message) => {
          if (message.type() === "error") {
            issues.push(`${route.id} console: ${message.text()}`);
          }
        });
        page.on("pageerror", (error) => issues.push(`${route.id} pageerror: ${error.message}`));
        page.on("requestfailed", (request) => {
          issues.push(`${route.id} failed request: ${request.url()} ${request.failure()?.errorText ?? ""}`);
        });

        const started = Date.now();
        await page.goto(`${baseUrl}${route.path}`, {waitUntil: "load"});
        await route.waitFor(page);
        await page.waitForTimeout(50);
        const timing = await page.evaluate(() => {
          const navigation = performance.getEntriesByType("navigation")[0];
          const fcp = performance.getEntriesByName("first-contentful-paint")[0];
          return {
            dclMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
            loadMs: navigation ? Math.round(navigation.loadEventEnd) : null,
            fcpMs: fcp ? Math.round(fcp.startTime) : null,
          };
        });

        runs.push({
          run,
          ...timing,
          elapsedMs: Date.now() - started,
          requests,
          bytes,
        });

        if (run === 1) {
          initialAssets = assets;
        }

        await context.close();
      }

      routeMetrics.push({
        id: route.id,
        label: route.label,
        path: route.path,
        bytes: median(runs.map((run) => run.bytes)) ?? 0,
        requests: median(runs.map((run) => run.requests)) ?? 0,
        dclMs: median(runs.map((run) => run.dclMs)),
        loadMs: median(runs.map((run) => run.loadMs)),
        fcpMs: median(runs.map((run) => run.fcpMs)),
        elapsedMs: median(runs.map((run) => run.elapsedMs)) ?? 0,
        initialAssets,
        runs,
      });
    }

    if (issues.length > 0) {
      throw new Error(`Performance crawl found browser issues:\n${issues.join("\n")}`);
    }

    return {browserVersion: browser.version(), routes: routeMetrics};
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
};

if (!skipBuild) {
  process.stdout.write("Building portal before measurement...\n");
}

const buildOutput = skipBuild ? "" : runCommand("pnpm", ["build"]);
const viteChunkWarning = /Some chunks are larger than|chunk size limit/i.test(buildOutput);
const measurement = await measureRoutes();

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: `Playwright Chromium ${measurement.browserVersion}`,
  commit: getCommit(),
  budgets,
  build: {
    command: "pnpm --filter @qwordly/portal build",
    viteChunkWarning,
    sourcemapCount: await countSourcemaps(),
    topAssets: await listTopAssets(),
  },
  routes: measurement.routes,
};

const body = `${JSON.stringify(snapshot, null, 2)}\n`;
await mkdir(path.dirname(publicSnapshotPath), {recursive: true});
await writeFile(publicSnapshotPath, body);

try {
  await mkdir(path.dirname(distSnapshotPath), {recursive: true});
  await writeFile(distSnapshotPath, body);
} catch {
  // The source snapshot is the durable output; dist may not exist in skipped-build workflows.
}

process.stdout.write(`Wrote ${path.relative(repoRoot, publicSnapshotPath)}\n`);
console.table(
  snapshot.routes.map((route) => ({
    route: route.id,
    fcp: route.fcpMs,
    dcl: route.dclMs,
    bytes: route.bytes,
    requests: route.requests,
  })),
);
