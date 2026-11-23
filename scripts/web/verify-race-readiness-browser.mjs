/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Render the real multiplayer UI with a controlled unacknowledged readiness and explicit recovery.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-readiness-"));
const output = path.resolve(root, "artifacts/race-readiness");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES, RaceRunResponseSchema} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/web/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/races/testing/browser/fakeRaceServices.ts"))};
const catalog = createFakeRaceServices();
const deck = Array.from({length:15}, (_, position) => ({riddleId:'q-'+position, text:'Question '+(position+1),
 answerLength:5, position, evaluation:{answer:'piano',locale:'en'}, hint:{index:0,letter:'p'}}));
const prompt = position => {const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
let view = {runId:'readiness-run',role:'creator',status:'prepared',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:0,totalPenaltyMs:0,adjustedElapsedMs:0,currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],serverNowMs:Date.now(),preparationExpiresAtMs:Date.now()+30000};
window.commands=[];window.failure=new URLSearchParams(location.search).get('failure');
window.allowReady=window.failure==='confirmed-throw';
function reply(message, operation, data){
 window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,
  payload:{operation,ok:true,data}}}));
}
function postToHost(message) {
 window.commands.push(message);
 if(message.type==='game:listRaceCategories'){
  void catalog.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));return;
 }
 if(message.type==='game:startRace'){
  reply(message,'raceStart',{run:view});
  if(window.failure==='confirmed-throw') throw new Error('adapter-failed-after-confirmation');
  return;
 }
 if(message.type!=='game:readyRace') return;
 if(!window.allowReady){
  if(window.failure==='throw') throw new Error('bridge-unavailable');
  // Cap a broken client's automatic echo loop so the verifier fails without hanging.
  if(window.commands.filter(command=>command.type==='game:readyRace').length>3) return;
  reply(message,'raceReady',RaceRunResponseSchema.parse({run:view}));
 } else {
  const now=Date.now();view={...view,status:'scheduled',startsAtMs:now+3000,serverNowMs:now};reply(message,'raceReady',{run:view});
 }
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="readiness-browser"
 postToHost={postToHost} onClose={()=>{}}/>);
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
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const failure of ["echo", "throw", "confirmed-throw"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?failure=${failure}`);
    await page.locator(".race-category-grid button").first().click();
    if (failure !== "confirmed-throw") {
      await page.getByRole("alert").waitFor({state:"visible"});
      assert.equal(await page.locator(".race-gameplay .guess-board").count(), 0);
      assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:readyRace').length), 1);
      assert.equal(await page.getByRole("alert").getByRole("button").isEnabled(), true);
      await page.screenshot({path:path.join(output, `${failure}-rejected-${viewport.width}.png`),fullPage:true});
      await page.evaluate(() => {window.allowReady=true;});
      await page.getByRole("alert").getByRole("button").click();
    }
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible",timeout:15000});
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(), "Question 1");
    assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:readyRace').length), failure === "confirmed-throw" ? 1 : 2);
    assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:startRace').length), 1);
    assert.deepEqual(errors, []);
    await page.screenshot({path:path.join(output, `${failure}-recovered-${viewport.width}.png`),fullPage:true});
    console.log(`Readiness UI passed: ${viewport.width}px, ${failure}; owned run retained, no automatic repeat or browser exception.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
