#!/usr/bin/env node
import {getReleaseDefinition} from "./release-registry.mjs";
import {createHtml5HandoffPreparation, loadPreparedHtml5Source} from "./html5-handoff-preparation.mjs";
import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {cp, mkdir, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {promisify} from "node:util";
import {fileURLToPath} from "node:url";
import path from "node:path";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../..", import.meta.url));
const staging = path.join(repository, "packages/portal/dist-microsoft-pwa");
const artifact = path.join(repository, getReleaseDefinition("microsoft-pwa").artifact);

/** Builds an installable PWA review package without Store identity or commerce credentials. */
export async function packageMicrosoftPwa({run = execute, source} = {}) {
  const prepared = source ?? (process.env.HTML5_SOURCE_PREPARED === "1"
    ? await loadPreparedHtml5Source({run}) : await createHtml5HandoffPreparation({run}).prepare());
  await rm(staging, {recursive: true, force: true});
  await run("unzip", ["-q", path.join(repository, prepared.artifact), "-d", staging], {cwd: repository});
  await mkdir(path.join(staging, "icons"), {recursive: true});
  await cp(path.join(repository, "assets/images/icon.png"), path.join(staging, "icons/riddle-quest.png"));

  const manifest = {
    id: "/",
    name: "Riddle Quest",
    short_name: "Riddle Quest",
    description: "Solve colourful word riddles, build streaks and complete daily challenges.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070b1d",
    theme_color: "#070b1d",
    categories: ["games", "puzzle"],
    icons: [{src: "icons/riddle-quest.png", sizes: "1254x1254", type: "image/png", purpose: "any maskable"}],
  };
  await writeFile(path.join(staging, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);

  const indexPath = path.join(staging, "index.html");
  const index = await readFile(indexPath, "utf8");
  const head = `<link rel="manifest" href="./manifest.webmanifest"><meta name="theme-color" content="#070b1d"><link rel="icon" href="./icons/riddle-quest.png">`;
  const registration = `<script>if("serviceWorker" in navigator){addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));}</script>`;
  await writeFile(indexPath, index.replace("</head>", `${head}</head>`).replace("</body>", `${registration}</body>`));

  // Precache the complete game, including lazy content, before promising offline readiness.
  const files = (await readdir(staging, {recursive: true, withFileTypes: true}))
    .filter(entry => entry.isFile())
    .map(entry => path.relative(staging, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
  const cacheDigest = createHash("sha256");
  for (const file of files) cacheDigest.update(file).update(await readFile(path.join(staging, file)));
  const cacheName = `riddle-quest-pwa-${cacheDigest.digest("hex").slice(0, 16)}`;
  await writeFile(path.join(staging, "service-worker.js"), `const CACHE=${JSON.stringify(cacheName)};
const FILES=${JSON.stringify(["./", ...files.map(file => `./${file}`)])};
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("riddle-quest-pwa-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
});\n`);

  await rm(artifact, {force: true});
  await run("zip", ["-q", "-r", artifact, "."], {cwd: staging});
  const digest = createHash("sha256").update(await readFile(artifact)).digest("hex");
  const receipt = {
    schemaVersion: 1,
    platform: "microsoft-pwa",
    artifact: path.basename(artifact),
    sha256: digest,
    sourceArtifact: "build-html5.zip",
    sourceRevision: prepared.revision,
    sourceSha256: prepared.sha256,
    releaseBoundary: getReleaseDefinition("microsoft-pwa").releaseGate,
  };
  await writeFile(`${artifact}.manifest.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Prepared Microsoft Store PWA handoff ${path.basename(artifact)} (${digest}).`);
  return receipt;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  packageMicrosoftPwa().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
