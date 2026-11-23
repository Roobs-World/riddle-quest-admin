/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify real multiplayer initial live progress validation and original-start recovery.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-live-progress-"));
const output = path.resolve(root, "../../artifacts/race-live-progress");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES, RaceRunResponseSchema} from '@riddle-quest/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
const catalog = createFakeRaceServices();
const deck = Array.from({length:15}, (_, position) => ({riddleId:'q-'+position, text:'Question '+(position+1),
 answerLength:5, position, evaluation:{answer:'piano',locale:'en'}, hint:{index:0,letter:'p'}}));
const prompt = position => {const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
let view = {runId:'readiness-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],serverNowMs:Date.now(),startsAtMs:Date.now()-1000};
window.commands=[];window.failure=new URLSearchParams(location.search).get('failure');
window.recovered=false;
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
  const valid=RaceRunResponseSchema.parse({run:view});
  const run=window.failure==='ahead'?{...view,correctCount:1}:{...view,correctCount:10,currentRiddle:prompt(10)};
  reply(message,'raceStart',window.recovered?valid:{run});return;
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const failure of ["ahead", "target"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?failure=${failure}`);
    await page.locator(".race-category-grid button").first().click();
    await page.getByRole("alert").waitFor({state:"visible"});
    assert.equal(await page.locator(".race-gameplay .guess-board").count(), 0);
    assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:readyRace').length), 0);
    assert.equal(await page.getByRole("alert").getByRole("button").isEnabled(), true);
    await page.screenshot({path:path.join(output, `${failure}-rejected-${viewport.width}.png`),fullPage:true});
    await page.evaluate(() => {window.recovered=true;});
    await page.getByRole("alert").getByRole("button").click();
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible",timeout:15000});
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.equal(await page.locator(".race-riddle-surface h2").innerText(), "Question 1");
    assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:readyRace').length), 0);
    assert.equal(await page.evaluate(() => window.commands.filter(command=>command.type==='game:startRace').length), 2);
    assert.deepEqual(errors, []);
    await page.screenshot({path:path.join(output, `${failure}-recovered-${viewport.width}.png`),fullPage:true});
    console.log(`Live progress UI passed: ${viewport.width}px, ${failure}; impossible active progress rejected, original question recovered without browser exception.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
