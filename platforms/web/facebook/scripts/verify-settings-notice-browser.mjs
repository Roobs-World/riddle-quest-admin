import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import react, {reactCompilerPreset} from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import {chromium} from "@playwright/test";

// Exercises the real component/capability seam with controlled browser scheduling.
// This is a local regression, not evidence about a native Facebook host's scheduler.
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), "riddle-quest-settings-notice-"));
const warning = "Progress isn't saved yet. Keep the game open.";
const startedAt = performance.now();
let server, browser;
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {PlayerSettingsActions, PlayerSettingsActionsProvider} from ${JSON.stringify(path.join(repository, "src/settings/components/PlayerSettingsActions"))};
import {createFacebookPlayerSettingsActions} from ${JSON.stringify(path.join(repository, "platforms/web/facebook/src/engagement/FacebookPlayerSettingsActions"))};
const control = window.__settingsNotice;
const root = createRoot(document.getElementById("root"));
const owners = new Map();
control.render = id => {
  const state = {runs: 0, flushes: 0, quits: 0, aborts: 0, outcomes: []};
  let releaseSave;
  const saved = new Promise(resolve => {releaseSave = resolve;});
  const sdk = {getSupportedAPIs: () => ["quit"], quit: () => {state.quits++;}};
  const capability = createFacebookPlayerSettingsActions({sdk, isActive: () => true,
    flushBeforeQuit: async () => {state.flushes++; await saved;}});
  const run = capability.run;
  capability.run = async (action, signal) => {
    state.runs++;
    signal?.addEventListener("abort", () => {state.aborts++;}, {once: true});
    const outcome = await run(action, signal);
    state.outcomes.push(outcome);
    return outcome;
  };
  owners.set(id, {state, capability, releaseSave});
  flushSync(() => root.render(<PlayerSettingsActionsProvider capability={capability}><PlayerSettingsActions /></PlayerSettingsActionsProvider>));
};
control.read = id => {
  const {state, capability} = owners.get(id);
  return {...state, outcomes: [...state.outcomes], pending: capability.getSnapshot().pendingAction};
};
control.releaseSave = id => owners.get(id).releaseSave();
control.unmount = () => flushSync(() => root.unmount());
control.render("first");
`;

async function openPage(hold) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route("**/*", route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const realNow = Date.now.bind(Date);
    let offset = 0;
    const control = window.__settingsNotice = {hold: false, queued: [],
      advance: milliseconds => {offset += milliseconds;},
      release: () => {control.hold = false; for (const post of control.queued.splice(0)) post();},
    };
    Date.now = () => realNow() + offset;
    const NativeMessageChannel = window.MessageChannel;
    window.MessageChannel = class extends NativeMessageChannel {
      constructor() {
        super();
        const post = this.port2.postMessage.bind(this.port2);
        this.port2.postMessage = (...args) => {
          if (control.hold) control.queued.push(() => post(...args));
          else post(...args);
        };
      }
    };
  });
  await page.goto(origin);
  await page.getByRole("button", {name: "Quit game"}).waitFor();
  await frames(page);
  await page.evaluate(hold => {window.__settingsNotice.hold = hold;}, hold);
  return {page, errors};
}

const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const observe = (page, owner = "first") => page.evaluate(owner => ({
  ...window.__settingsNotice.read(owner),
  disabled: document.querySelector("button")?.disabled ?? null,
  notices: [...document.querySelectorAll('[role="status"]')].map(element => element.textContent),
  queuedSchedulerMessages: window.__settingsNotice.queued.length,
}), owner);
const quit = page => page.getByRole("button", {name: "Quit game"}).click();
const expire = async (page, count = 1) => {
  await page.evaluate(() => window.__settingsNotice.advance(15_001));
  await page.waitForFunction(count => window.__settingsNotice.read("first").outcomes.length === count, count, {polling: "raf", timeout: 3_000});
  await frames(page);
};

try {
  await symlink(path.join(repository, "node_modules"), path.join(temporary, "node_modules"), "dir");
  await writeFile(path.join(temporary, "index.html"), '<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Settings notice regression</title></head><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
  await writeFile(path.join(temporary, "entry.tsx"), entry);
  await build({root: temporary, configFile: false, envFile: false, plugins: [react(), babel({presets: [reactCompilerPreset()]})],
    logLevel: "error", build: {outDir: "dist", emptyOutDir: true}});
  const output = path.join(temporary, "dist");
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const file = path.resolve(output, pathname === "/" ? "index.html" : pathname.slice(1));
      if (!file.startsWith(`${output}${path.sep}`)) {response.writeHead(404).end(); return;}
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".html") ? "text/html" : "application/octet-stream");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true});

  for (const hold of [false, true]) {
    const {page, errors} = await openPage(hold);
    try {
      await quit(page);
      await page.waitForFunction(() => window.__settingsNotice.read("first").flushes === 1);
      await expire(page);
      const first = await observe(page);
      console.log(JSON.stringify({scenario: hold ? "held-scheduler" : "normal-scheduler", ...first}));
      assert.equal(first.disabled, false);
      assert.equal(first.pending, null);
      assert.deepEqual(first.outcomes, ["unsaved"]);
      assert.equal(first.aborts, 0);
      assert.equal(first.quits, 0);
      assert.deepEqual(first.notices, [warning], "Unsaved warning must render when Quit controls re-enable");

      await quit(page);
      const retry = await observe(page);
      assert.equal(retry.disabled, true);
      assert.equal(retry.pending, "quit");
      assert.deepEqual(retry.notices, [], "A deliberate retry clears the previous warning");
      await expire(page, 2);
      const second = await observe(page);
      assert.deepEqual(second.outcomes, ["unsaved", "unsaved"]);
      assert.deepEqual(second.notices, [warning]);
      assert.equal(second.flushes, 1, "Retry must preserve the still-pending preparation");
      assert.equal(second.quits, 0);
      await page.evaluate(() => window.__settingsNotice.release());
      await frames(page);
      assert.deepEqual((await observe(page)).notices, [warning]);
      assert.deepEqual(errors, []);
      console.log(`PASS ${hold ? "held" : "normal"} scheduler: warning, retry and save protection`);
    } finally {await page.close();}
  }

  for (const retirement of ["replacement", "unmount"]) {
    const {page, errors} = await openPage(true);
    try {
      await quit(page);
      await page.waitForFunction(() => window.__settingsNotice.read("first").flushes === 1);
      await page.evaluate(retirement => retirement === "replacement" ? window.__settingsNotice.render("second") : window.__settingsNotice.unmount(), retirement);
      await page.waitForFunction(() => window.__settingsNotice.read("first").outcomes[0] === "cancelled", null, {polling: "raf", timeout: 3_000});
      await page.evaluate(() => {window.__settingsNotice.releaseSave("first"); window.__settingsNotice.advance(15_001); window.__settingsNotice.release();});
      await frames(page);
      const retired = await observe(page);
      assert.equal(retired.aborts, 1);
      assert.equal(retired.quits, 0);
      assert.deepEqual(retired.notices, []);
      if (retirement === "replacement") {
        const replacement = await observe(page, "second");
        assert.equal(replacement.disabled, false);
        assert.equal(replacement.runs, 0);
      } else assert.equal(await page.getByRole("button").count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS ${retirement}: cancelled owner cannot publish a stale warning or quit`);
    } finally {await page.close();}
  }
  console.log(`Facebook Settings notice browser regression passed: 4 scenarios in ${((performance.now() - startedAt) / 1_000).toFixed(3)}s.`);
} finally {
  await browser?.close();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await rm(temporary, {recursive: true, force: true});
}
