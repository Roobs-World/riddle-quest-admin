import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Supplementary component regression: this is not hosted Jest E2E evidence.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.resolve(process.env.LIVE_RACE_REPORT_DIR ?? path.join(root, "artifacts/live-cancellation"));
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-cancellation-"));
const source = `
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import ${JSON.stringify(path.join(root, "src/races/styles/lobby.css"))};
import ${JSON.stringify(path.join(root, "src/races/styles/gameplay.css"))};
import {LiveRaceGame} from ${JSON.stringify(path.join(root, "src/races/components/live/LiveRaceGame.tsx"))};
const params=new URLSearchParams(location.search), expired=params.has('expired'), privateLobby=!params.has('public'), rejected=params.has('rejected');
const terminal={ticketId:'a'.repeat(64),phase:'cancelled',serverNowMs:expired?900001:1000,searchEndsAtMs:900000,
 startsAtMs:null,player:{displayName:'Fixture player',avatarUrl:null,bot:false,correctCount:0},
 opponent:null,run:null,result:null,rewardCoins:0,...(privateLobby?{challengeId:'live_'+'a'.repeat(64)}:{})};
window.closeCalls=0;window.transportCalls=[];
const transport={join:async()=>{window.transportCalls.push('join');if(rejected)throw Object.assign(new Error('Challenge expired or cancelled.'),{code:'functions/failed-precondition'});return {...terminal,phase:'searching',serverNowMs:0};},
 challenge:async input=>{window.transportCalls.push('challenge');const value={challengeId:input.challengeId,locale:'en',categoryId:'science',creator:terminal.player,expiresAtMs:900000,status:'unavailable'};if(params.has('late-preview'))return new Promise(resolve=>{window.resolvePreview=()=>resolve(value);});return value;},
 update:async input=>{window.transportCalls.push(input.action);return terminal;}};
function App(){const [closed,setClosed]=React.useState(false);return closed?<><p>Back to multiplayer</p><button onClick={()=>window.resolvePreview?.()}>Complete prior invitation read</button></>:<LiveRaceGame
 transport={transport} locale='en' categoryId='science' coins={100} ownerId='fixture'
 resumeTicketId={params.has('resume')?terminal.ticketId:undefined}
 challengeId={rejected?terminal.challengeId:undefined}
 onClose={()=>{window.closeCalls++;setClosed(true);}}/>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
const report = [];
try {
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const file = path.join(scratch, "dist", url.pathname === "/" ? "index.html" : url.pathname);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const viewport of [{width: 1280, height: 900}, {width: 390, height: 844}]) {
    const context = await browser.newContext({viewport});
    for (const scenario of [
      {name: "rejected-private-acceptance", query: "rejected", message: "This invitation has expired.", screen: "invitation_unavailable"},
      {name: "expired-private-poll", query: "expired", message: "This invitation has expired."},
      {name: "expired-private-resume", query: "expired&resume", message: "This invitation has expired."},
      {name: "cancelled-private", query: "resume", message: "This invitation has expired."},
      {name: "cancelled-public", query: "public&resume", message: "Opponent search is unavailable for this account."},
    ].filter(scenario => process.env.LIVE_RACE_INVITATION_ONLY !== "true" || scenario.screen === "invitation_unavailable")) {
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?${scenario.query}`);
      await page.locator(`[data-analytics-screen="multiplayer_live_${scenario.screen ?? "cancelled"}"]`).waitFor({timeout: 6000});
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
      const text = await page.getByRole("dialog").innerText();
      await page.screenshot({path: path.join(output, `${scenario.name}-${viewport.width}.png`), fullPage: true});
      assert.ok(text.includes(scenario.message), `Cancelled lobby must explain its terminal state; observed ${JSON.stringify(text)}`);
      assert.equal(await page.getByRole("status").innerText(), scenario.message);
      assert.equal(await page.locator('.friend-lobby:not([data-state="expired"]),.race-error,.race-gameplay').count(), 0);
      if (scenario.screen === "invitation_unavailable") {
        await page.waitForTimeout(9500);
        assert.deepEqual(await page.evaluate(() => window.transportCalls), ["join", "challenge"], "Definitively unavailable invitation must stop automatic joins without creating or leaving a seat");
      }
      const panelSelector = await page.locator(".friend-lobby").count() ? ".friend-lobby" : ".race-panel";
      const panel = await page.locator(panelSelector).boundingBox();
      assert.ok(panel.x > 0 && panel.x + panel.width <= viewport.width, "Styled terminal panel must fit the viewport");
      assert.ok(await page.locator(panelSelector).evaluate(element => parseFloat(getComputedStyle(element).borderRadius) > 0), "Terminal panel keeps rounded corners");
      await page.locator(panelSelector).getByRole("button", {name: "Close Race to 10", exact: true}).click();
      await page.getByText("Back to multiplayer", {exact: true}).waitFor();
      assert.equal(await page.evaluate(() => window.closeCalls), 1);
      assert.equal(await page.evaluate(() => window.transportCalls.includes("leave")), false, "A retired seat must not be left again");
      assert.deepEqual(errors, []);
      report.push({scenario: scenario.name, viewport, pass: true});
      await page.close();
    }
    {
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?rejected&late-preview`);
      await page.waitForFunction(() => window.transportCalls.includes("challenge"));
      await page.locator(".race-close").click();
      await page.getByText("Back to multiplayer", {exact: true}).waitFor();
      await page.getByRole("button", {name: "Complete prior invitation read", exact: true}).click();
      await page.waitForTimeout(1000);
      assert.equal(await page.getByRole("dialog").count(), 0, "Late confirmation cannot revive a closed invitation journey");
      assert.deepEqual(await page.evaluate(() => window.transportCalls), ["join", "challenge"]);
      assert.deepEqual(errors, []);
      report.push({scenario: "close-before-unavailable-confirmation", viewport, pass: true});
      await page.close();
    }
    await context.close();
  }
  await writeFile(path.join(output, "report.json"), JSON.stringify({scope: "Supplementary real-component harness; not hosted Jest E2E", report}, null, 2));
  console.log(`PASS: ${report.length} cancelled-lobby rendering and return cases`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
