/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Render the real multiplayer UI with a controlled contradictory clock and recovery responses.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-clock-"));
const output = path.resolve(root, "artifacts/race-clock");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES, SubmitRaceGuessResponseSchema} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/web/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/races/testing/browser/fakeRaceServices.ts"))};
const catalog = createFakeRaceServices();
const deck = Array.from({length:15}, (_, position) => ({riddleId:'q-'+position, text:'Question '+(position+1),
 answerLength:5, position, evaluation:{answer:'piano',locale:'en'}, hint:{index:0,letter:'p'}}));
const prompt = position => {const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
let view = {runId:'clock-run',role:'creator',status:'prepared',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:0,totalPenaltyMs:0,adjustedElapsedMs:0,currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],serverNowMs:Date.now(),preparationExpiresAtMs:Date.now()+30000};
window.commands=[]; window.recovered=false;
async function postToHost(message) {
 window.commands.push(message);
 let operation, data;
 if(message.type==='game:listRaceCategories'){operation='raceCategories';data=await catalog.listRaceCategories('en');}
 else if(message.type==='game:startRace'){operation='raceStart';data={run:view};}
 else if(message.type==='game:readyRace'){
  const now=Date.now(); operation='raceReady';
  view={...view,status:'active',startsAtMs:now-1000,serverNowMs:now,wallElapsedMs:1000,adjustedElapsedMs:1000};data={run:view};
 } else if(message.type==='game:submitRaceGuess'){
  operation='raceGuess';const now=Date.now(), wall=now-view.startsAtMs;
  view={...view,serverNowMs:now,wallElapsedMs:wall,adjustedElapsedMs:wall,
   currentRiddle:{...view.currentRiddle,guessesUsed:1,guessesRemaining:4}};
  const accepted=SubmitRaceGuessResponseSchema.parse({run:view,
   feedback:Array.from(message.payload.guess,letter=>({letter,status:'red'})),isCorrect:false,autoSkipped:false});
  data={...accepted,run:{...accepted.run,wallElapsedMs:wall+10000,adjustedElapsedMs:wall+10000}};
 } else if(message.type==='game:resumeRace'){
  operation='raceResume';const now=Date.now(), wall=now-view.startsAtMs;
  view={...view,serverNowMs:now,wallElapsedMs:wall,adjustedElapsedMs:wall};data={run:view};window.recovered=true;
 } else return;
 window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,
  payload:{operation,ok:true,data}}}));
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="clock-browser"
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
    await page.keyboard.type("zzzzz");
    await page.locator(".race-actions .submit-action").click();
    await page.getByRole("alert").waitFor({state:"visible"});
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(), "Question 1");
    assert.equal((await page.locator(".race-gameplay .guess-row .cell").allTextContents()).join(""), "zzzzz");
    await page.screenshot({path:path.join(output, `rejected-${viewport.width}.png`),fullPage:true});
    await page.getByRole("alert").getByRole("button").click();
    await page.waitForFunction(() => window.recovered);
    await page.getByRole("alert").waitFor({state:"hidden"});
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(), "Question 1");
    assert.equal((await page.locator(".race-gameplay .guess-row .cell").allTextContents()).join(""), "zzzzz");
    assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:submitRaceGuess').length), 1);
    assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:requestRaceHint').length), 0);
    assert.deepEqual(errors, []);
    await page.screenshot({path:path.join(output, `recovered-${viewport.width}.png`),fullPage:true});
    console.log(`Clock UI passed: ${viewport.width}px; contradictory guess receipt rejected, input restored, valid recovery without resubmission.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
