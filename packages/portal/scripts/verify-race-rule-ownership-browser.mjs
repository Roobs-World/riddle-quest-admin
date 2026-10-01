import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify real multiplayer paid-action rejection and resume recovery after replacement of owned rules.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-rule-ownership-"));
const output = path.resolve(root, "../../artifacts/race-rule-ownership");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {RACE_RULES, RaceRunViewSchema} from '@qwordly/core/race';
import {RaceSession} from ${JSON.stringify(path.join(root, "src/play/race/RaceSession.ts"))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
const catalog=createFakeRaceServices();
for(const method of ['getItem','setItem','removeItem']) Storage.prototype[method]=()=>{throw new DOMException('Storage denied','SecurityError');};
const deck=Array.from({length:15},(_,position)=>({riddleId:'q-'+position,text:'Question '+(position+1),answerLength:5,
 position,evaluation:{answer:'piano',locale:'en'},hint:{index:0,letter:'p'}}));
const prompt=position=>{const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
const activeView=runId=>{const now=Date.now();return {runId,role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[{sequence:0,type:'hint',riddlePosition:0,wallElapsedMs:1000,penaltyAddedMs:15000,totalPenaltyMs:0,adjustedElapsedMs:1000,correctCount:0}],
 serverNowMs:now,startsAtMs:now-1000};};
let view=activeView('old-owner-run'),owner='owner-1';window.commands=[];window.closeCount=0;
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
function postToHost(message){
 window.commands.push({...message,observedOwner:owner});
 if(message.type==='game:analytics') return;
 if(message.type==='game:listRaceCategories'){
  void catalog.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));return;
 }
 if(message.type==='game:startRace'){reply(message,'raceStart',{run:view});return;}
 if(message.type==='game:requestRaceHint'||message.type==='game:skipRaceRiddle'){
  const hint=message.type==='game:requestRaceHint',now=Date.now(),wall=now-view.startsAtMs,fee=hint?RACE_RULES.hintPenaltyMs:RACE_RULES.skipPenaltyMs;
  const total=view.totalPenaltyMs+fee;
  view={...view,correctCount:hint?0:1,serverNowMs:now,wallElapsedMs:wall,totalPenaltyMs:total,adjustedElapsedMs:wall+total,
   currentRiddle:hint?{...prompt(0),revealedLetters:[{index:0,letter:'p'}]}:prompt(1),
   events:[...view.events,{sequence:0,type:hint?'hint':'skip',riddlePosition:0,wallElapsedMs:wall,penaltyAddedMs:fee,totalPenaltyMs:total,adjustedElapsedMs:wall+total,correctCount:hint?0:1}]};
  const bad=structuredClone(view);bad.rules.maxHintsPerRiddle=1;if(hint)bad.currentRiddle.hintAvailable=false;RaceRunViewSchema.parse(bad);
  reply(message,hint?'raceHint':'raceSkip',{run:bad,...(hint?{index:0,revealedLetter:'p'}:{penaltyAddedMs:RACE_RULES.skipPenaltyMs})});return;
 }
 if(message.type==='game:resumeRace'){reply(message,'raceResume',{run:view});return;}
 if(message.type==='game:readyRace'){
  const now=Date.now();view={...view,status:'active',startsAtMs:now-1000,serverNowMs:now,wallElapsedMs:1000,adjustedElapsedMs:1000};
  reply(message,'raceReady',{run:view});
 }
}
const app=createRoot(document.getElementById('root'));
const render=ownerId=>app.render(<RaceTo10Game locale="en" coins={100} ownerId={ownerId} postToHost={postToHost} onClose={()=>{window.closeCount++;owner='owner-2';view=activeView('new-owner-run');flushSync(()=>render(owner));}}/>);
render(owner);
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const [operation,corruption] of [["hint","changed-rules"],["skip","changed-rules"]]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?corruption=${corruption}`);
    await page.locator(".race-category-grid button").first().waitFor({state:"visible"});
    await page.locator(".race-category-grid button").first().click();
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible"});
    await page.getByRole("button",{name:operation==='hint'?/^Hint/:/^Skip/}).click();
    await page.getByRole("alert").waitFor({state:"visible"});
    await page.getByText("Question 1",{exact:true}).waitFor({state:"visible"});
    await page.getByRole("button",{name:"Retry",exact:true}).click();
    await page.waitForFunction(()=>window.commands.some(command=>command.type==='game:resumeRace'));
    await page.getByText(operation==='hint'?"Question 1":"Question 2",{exact:true}).waitFor({state:"visible"});
    assert.equal(await page.getByRole("alert").count(),0);
    assert.equal(await page.evaluate(type=>window.commands.filter(command=>command.type===type).length,operation==='hint'?'game:requestRaceHint':'game:skipRaceRiddle'),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),1);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,`${operation}-${corruption}-${viewport.width}.png`),fullPage:true});
    console.log(`Rule ownership UI passed: ${viewport.width}px ${operation} ${corruption}; changed rules roll back, one resume recovers without resending the paid action.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
