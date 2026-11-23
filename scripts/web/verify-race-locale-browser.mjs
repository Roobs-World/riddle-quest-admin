/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Render the real multiplayer UI with a controlled delayed authority response.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-locale-"));
const output = path.resolve(root, "artifacts/race-locale");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/web/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/races/testing/browser/fakeRaceServices.ts"))};
const catalog = createFakeRaceServices();
const deck = Array.from({length:15}, (_, position) => ({riddleId:'q-'+position, text:'Question '+(position+1),
 answerLength:1, position, evaluation:{answer:'ı',locale:'tr'}, hint:{index:0,letter:'ı'}}));
const prompt = position => {const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
let view = {runId:'locale-run',role:'creator',status:'prepared',categoryId:'history',locale:'tr',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:0,totalPenaltyMs:0,adjustedElapsedMs:0,currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],serverNowMs:Date.now(),preparationExpiresAtMs:Date.now()+30000};
window.commands=[]; window.confirmed=false; window.awaiting=false;
async function postToHost(message) {
 window.commands.push(message);
 let operation, data;
 if(message.type==='game:listRaceCategories'){operation='raceCategories';data=await catalog.listRaceCategories('tr');}
 else if(message.type==='game:startRace'){operation='raceStart';data={run:view};}
 else if(message.type==='game:readyRace'){operation='raceReady';const now=Date.now();view={...view,status:'active',startsAtMs:now-1000,serverNowMs:now,wallElapsedMs:1000,adjustedElapsedMs:1000};data={run:view};}
 else if(message.type==='game:submitRaceGuess'){
  operation='raceGuess';
  if(message.payload.guess!=='I') throw new Error('Unexpected locale guess');
  const now=Date.now(), wall=now-view.startsAtMs;
  view={...view,correctCount:1,currentRiddle:prompt(1),serverNowMs:now,wallElapsedMs:wall,adjustedElapsedMs:wall,
   events:[{sequence:0,type:'correct',riddlePosition:0,correctCount:1,wallElapsedMs:wall,totalPenaltyMs:0,adjustedElapsedMs:wall,penaltyAddedMs:0}]};
  data={run:view,feedback:[{letter:'I',status:'green'}],isCorrect:true,autoSkipped:false};
  window.awaiting=true;await new Promise(resolve=>{window.releaseGuess=resolve;});window.confirmed=true;
 } else if(message.type==='game:resumeRace'){operation='raceResume';data={run:view};}
 else return;
 window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,
  payload:{operation,ok:true,data}}}));
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="tr" coins={100} ownerId="locale-browser"
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator(".race-category-grid button").first().click();
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible",timeout:15000}).catch(async error => {
      console.error(await page.locator("body").innerText(), await page.evaluate(() => window.commands), errors);
      await page.screenshot({path:path.join(output, `failed-${viewport.width}.png`),fullPage:true});
      throw error;
    });
    await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    await page.keyboard.type("I");
    await page.locator(".race-actions .submit-action").click();
    await page.waitForFunction(() => window.awaiting);
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(), "Question 2");
    assert.equal(await page.evaluate(() => window.confirmed), false);
    await page.screenshot({path:path.join(output, `projected-${viewport.width}.png`),fullPage:true});
    await page.evaluate(() => window.releaseGuess());
    await page.waitForFunction(() => window.confirmed);
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(), "Question 2");
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.deepEqual(errors, []);
    console.log(`Locale UI passed: ${viewport.width}px; Turkish I advances before delayed authority and stays on its confirmed successor.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
