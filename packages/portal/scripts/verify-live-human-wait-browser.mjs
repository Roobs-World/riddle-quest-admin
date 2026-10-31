import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(process.env.LIVE_HUMAN_WAIT_REPORT_DIR ?? path.join(root, "../../artifacts/live-human-wait"));
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-human-wait-"));
const observations = [];
const copy = "Waiting for another player. Close to stop searching.";
let server, browser;
try {
  await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
  await writeFile(path.join(scratch, "index.html"), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, "main.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {LiveRaceGame} from ${JSON.stringify(path.join(root, "src/play/race/LiveRaceGame.tsx"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, "src/play/playerPreferences.ts"))};
import {LiveRaceViewSchema} from '@qwordly/core/race';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import ${JSON.stringify(path.join(root, "src/styles.race-lobby.css"))};
import ${JSON.stringify(path.join(root, "src/styles.race-gameplay.css"))};
applyPlayerPreferences({locale:'en', muted:true, reducedMotion:true, onboardingComplete:true});
const scenario = new URLSearchParams(location.search).get('scenario');
const challengeId = 'live_' + 'b'.repeat(64);
window.probe = {joins:[], retirements:[], closes:0, queued:false, errors:[]};
window.addEventListener('error', event => window.probe.errors.push(String(event.error ?? event.message)));
window.addEventListener('unhandledrejection', event => window.probe.errors.push(String(event.reason)));
window.phase = 'searching';
function snapshot() {
  const now = Date.now();
  return LiveRaceViewSchema.parse({ticketId:'a'.repeat(64), phase:window.phase,
    serverNowMs:now, searchEndsAtMs:now+900000, startsAtMs:window.phase==='countdown'?now+60000:null,
    player:{displayName:'Owner', avatarUrl:null, bot:false, correctCount:0},
    opponent:null, run:null, result:null, rewardCoins:0,
    ...(scenario==='private'?{challengeId}:scenario==='legacy'?{}:{waitForPlayer:true})});
}
const transport = {
  async join(input) {
    window.probe.joins.push(input);
    if (scenario==='pending') await new Promise(resolve => window.releaseJoin=resolve);
    window.probe.queued=true;
    return snapshot();
  },
  async update() {
    if (window.failPoll) throw new Error('Controlled transport outage');
    return snapshot();
  },
  async retireJoin(input) {
    window.probe.retirements.push(input);
    window.probe.queued=false;
    return {status:'retired'};
  },
  observe(ticket, refresh, connected) {
    window.refresh=refresh;
    connected(true);
    return () => {window.refresh=undefined;};
  },
};
function App() {
  const [closed,setClosed]=React.useState(false);
  return closed?<p>Search closed</p>:<LiveRaceGame transport={transport} locale='en' categoryId='mixed'
    coins={100} ownerId='wait-owner' {...(scenario==='private'?{challengeId}:{})}
    onClose={()=>{window.probe.closes++;setClosed(true);}}/>;
}
createRoot(document.querySelector('#root')).render(<App/>);
`);
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const file = path.join(scratch, "dist", pathname === "/" ? "index.html" : pathname);
      response.setHeader("content-type", ({".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2"})[path.extname(file)] ?? "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true});
  for (const [width, height] of [[320, 568], [390, 844], [1280, 844]]) {
    for (const scenario of ["pending", "public", "private", "legacy"]) {
      const context = await browser.newContext({viewport: {width, height}});
      const page = await context.newPage();
      await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}/?scenario=${scenario}`);
      const hint = page.getByText(copy, {exact: true});
      await page.waitForFunction(() => window.probe.joins.length > 0);
      if (scenario === "pending") {
        await page.waitForFunction(() => Boolean(window.releaseJoin));
        assert.equal(await hint.count(), 0, "Unacknowledged joins do not claim to be waiting for a human");
        observations.push({width, height, scenario, check: "pending join has no human-wait copy", passed: true});
        await page.evaluate(() => window.releaseJoin());
      }
      await page.getByText("Owner", {exact: true}).waitFor();
      if (scenario === "private" || scenario === "legacy") {
        assert.equal(await hint.count(), 0, "Private and legacy seats retain their own waiting presentation");
        observations.push({width, height, scenario, check: "human-wait copy absent", passed: true});
      } else {
        await hint.waitFor();
        const bounds = await hint.boundingBox();
        await page.screenshot({path: path.join(output, `waiting-${scenario}-${width}.png`)});
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height,
          `The human-wait explanation stays readable within the viewport: ${JSON.stringify({width, height, bounds})}`);
        observations.push({width, height, scenario, check: "acknowledged human seat has readable explanation", passed: true});
      }
      if (scenario === "public") {
        await page.waitForFunction(() => typeof window.refresh === "function");
        await page.evaluate(() => {window.failPoll=true;window.refresh();});
        await page.getByRole("alert").waitFor();
        assert.equal(await hint.count(), 0, "Transport errors replace the waiting explanation with retry guidance");
        observations.push({width, height, scenario, check: "error hides human-wait copy", passed: true});
        await page.evaluate(() => {window.failPoll=false;});
        await page.getByRole("button", {name: "Retry", exact: true}).click();
        await hint.waitFor();
        await page.evaluate(() => {window.phase='countdown';window.refresh();});
        await page.locator('.live-race-search-wheel[data-phase="countdown"]').waitFor();
        assert.equal(await hint.count(), 0, "Matched countdown does not retain human-wait guidance");
        observations.push({width, height, scenario, check: "recovery restores copy and countdown removes it", passed: true});
      }
      await page.locator(".race-close").click();
      await page.getByText("Search closed", {exact: true}).waitFor();
      const probe = await page.evaluate(() => window.probe);
      assert.equal(probe.closes, 1);
      assert.equal(probe.queued, false, "Close cancels the owned matchmaking intent");
      assert.equal(probe.retirements.length, 1);
      assert.equal(probe.retirements[0].requestId, probe.joins[0].requestId);
      assert.equal(probe.retirements[0].expectedOwnerId, "wait-owner");
      assert.deepEqual(probe.errors, []);
      observations.push({width, height, scenario, check: "Close releases live race and cancels original owned intent", passed: true});
      await context.close();
    }
  }
  console.log(JSON.stringify({scenarios: 12, checks: observations.length, failures: []}, null, 2));
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(output, "observations.json"), JSON.stringify(observations, null, 2) + "\n");
}
