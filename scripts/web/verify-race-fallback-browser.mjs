/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Inject the provider/authority seams while rendering the actual multiplayer component.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-fallback-"));
const output = path.resolve(root, "artifacts/race-fallback");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/web/play/race/testing/fakeRaceServices.ts"))};
const services = createFakeRaceServices();
const opponent = {displayName: 'Nova', adjustedFinishMs: 120000, events: Array.from({length:10}, (_, i) => ({
 sequence:i, type:'correct', riddlePosition:i, wallElapsedMs: i === 0 ? 2000 : (i + 1) * 12000,
 penaltyAddedMs:0, totalPenaltyMs:0, adjustedElapsedMs:i === 0 ? 2000 : (i + 1) * 12000, correctCount:i + 1}))};
window.commands = []; window.views = []; window.searches = 0;
const methods = {'game:listRaceCategories':'listRaceCategories','game:startRace':'startRace',
 'game:readyRace':'readyRace','game:submitRaceGuess':'submitRaceGuess','game:resumeRace':'resumeRace',
 'game:getRaceOutcome':'getRaceOutcome','game:abandonRace':'abandonRace'};
const operations = {'game:listRaceCategories':'raceCategories','game:startRace':'raceStart',
 'game:readyRace':'raceReady','game:submitRaceGuess':'raceGuess','game:resumeRace':'raceResume',
 'game:getRaceOutcome':'raceOutcome','game:abandonRace':'raceAbandon'};
async function postToHost(message) {
 if (!methods[message.type]) return;
 window.commands.push(message);
 let data = await services[methods[message.type]](['game:getRaceOutcome','game:resumeRace'].includes(message.type) ? message.payload.runId : message.payload);
 if (data.run) {data = {...data, run:{...data.run, role:'challenger', opponent}}; window.views.push(data.run);}
 if (message.type === 'game:getRaceOutcome') data = {...data, result:'player_win', publishable:false, rematchEligible:true, opponentAdjustedFinishMs:120000};
 window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game', {detail:{type:'host:operationResult',
 requestId:message.requestId, payload:{operation:operations[message.type],ok:true,data}}}));
}
const matchmaking = {find:async () => {window.searches++; return {status:'success', value:{status:'empty',locale:'en',
 fallback:{offerId:'a'.repeat(64),categoryId:'history'}}};}};
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="fallback-browser"
 postToHost={postToHost} onClose={() => {}} matchmaking={matchmaking}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const file = path.join(scratch, "dist", url.pathname === "/" ? "index.html" : url.pathname);
      const body = await readFile(file);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      response.end(body);
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", {name: "Find opponent", exact: true}).click();
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible",timeout:15000});
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.ok((await page.locator(".race-scoreboard").innerText()).includes("Nova"));
    assert.ok(!/\bbot\b|no races/i.test(await page.locator("body").innerText()));
    assert.equal(await page.evaluate(() => window.commands.find(command => command.type === "game:startRace").payload.fallbackOfferId), "a".repeat(64));
    await page.screenshot({path:path.join(output, `fallback-${viewport.width}.png`),fullPage:true});
    await page.waitForFunction(() => /1\s*\/\s*10/.test(document.querySelector('.race-scoreboard')?.textContent));
    for (let index = 0; index < 10; index++) {
      const answer = await page.evaluate(() => window.views.at(-1).currentRiddle.evaluation.answer);
      await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
      await page.keyboard.type(answer);
      await page.locator(".race-actions .submit-action").click();
      await page.waitForFunction(count => window.views.at(-1).correctCount === count, index + 1);
    }
    await page.locator(".race-result").waitFor({state:"visible",timeout:10000});
    assert.ok(!/\bbot\b/i.test(await page.locator("body").innerText()));
    assert.equal(await page.getByRole("alert").count(), 0);
    await page.screenshot({path:path.join(output, `result-${viewport.width}.png`),fullPage:true});
    assert.deepEqual(errors, []);
    console.log(`Fallback UI passed: ${viewport.width}px; ordinary rival, moving ghost, ten answers, verified result.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
