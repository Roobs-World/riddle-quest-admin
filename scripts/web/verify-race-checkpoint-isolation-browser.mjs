/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify real multiplayer paid-action rejection and resume recovery after shared pending checkpoint mutations.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-checkpoint-isolation-"));
const output = path.resolve(root, "artifacts/race-checkpoint-isolation");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {RACE_RULES, SubmitRaceGuessResponseSchema} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RaceSession} from ${JSON.stringify(path.join(root, "src/web/play/race/RaceSession.ts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/web/play/race/testing/fakeRaceServices.ts"))};
const catalog=createFakeRaceServices();
for(const method of ['getItem','setItem','removeItem']) Storage.prototype[method]=()=>{throw new DOMException('Storage denied','SecurityError');};
const deck=Array.from({length:15},(_,position)=>({riddleId:'q-'+position,text:'Question '+(position+1),answerLength:5,
 position,evaluation:{answer:'piano',locale:'en'},hint:{index:0,letter:'p'}}));
const prompt=position=>{const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
const activeView=runId=>{const now=Date.now();return {runId,role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],
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
 if(message.type==='game:submitRaceGuess'&&message.payload.guess==='zzzzz'){
  const now=Date.now(),wall=now-view.startsAtMs;
  view={...view,serverNowMs:now,wallElapsedMs:wall,adjustedElapsedMs:wall,currentRiddle:{...prompt(0),guessesUsed:1,guessesRemaining:4}};
  reply(message,'raceGuess',{run:view,isCorrect:false,autoSkipped:false,feedback:Array.from('zzzzz',letter=>({letter,status:'red'}))});return;
 }
 if(['game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle'].includes(message.type)){window.pendingAction=message;return;}
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
  await build({plugins: [{name:"expose-injected-race-session", transform(code, id) {
    if (!id.endsWith("/play/race/hooks/useRaceSession.ts")) return null;
    assert(code.includes("const session = sessionRef.current;"));
    return {code: code.replace("const session = sessionRef.current;", "const session = sessionRef.current; globalThis.testRaceSession = session;"), map: null};
  }}], root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const corruption of ["guess-run","guess-history","hint-run","hint-history","skip-run","skip-history"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?corruption=${corruption}`);
    await page.locator(".race-category-grid button").first().waitFor({state:"visible"});
    await page.locator(".race-category-grid button").first().click();
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible"});
    await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    await page.keyboard.type("zzzzz");await page.locator(".race-actions .submit-action").click();
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().run.currentRiddle.guessesUsed===1);
    await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    await page.keyboard.type(corruption.startsWith('guess')?'piano':'pi');
    const original=await page.evaluate(()=>{window.captured=globalThis.testRaceSession.getSnapshot();return structuredClone(window.captured);});
    await page.getByRole("button",{name:corruption.startsWith('guess')?'Submit':corruption.startsWith('hint')?/^Hint/:/^Skip/}).click();
    await page.evaluate(kind=>{
      if(kind.endsWith('run'))window.captured.run.preloadedRiddles[1].text='A mutated public clue';
      else {window.captured.raceGuesses[0].guess[0]='x';window.captured.raceGuesses[0].feedback[0]='green';}
      const message=window.pendingAction,operation=message.type==='game:submitRaceGuess'?'raceGuess':message.type==='game:requestRaceHint'?'raceHint':'raceSkip';
      window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:false,error:'RaceTo10.ERROR_GENERIC'}}}));
    },corruption);
    await page.getByRole('alert').waitFor({state:'visible'});
    const restored=await page.evaluate(()=>{const state=globalThis.testRaceSession.getSnapshot();return {run:state.run,letters:state.currentLetters,history:state.raceGuesses};});
    assert.deepEqual(restored,{run:original.run,letters:original.currentLetters,history:original.raceGuesses});
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null);
    assert.equal(await page.getByRole("alert").count(),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:requestRaceHint','game:skipRaceRiddle','game:submitRaceGuess'].includes(command.type)).length),2);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,`${corruption}-${viewport.width}.png`),fullPage:true});
    console.log(`Checkpoint UI passed: ${viewport.width}px ${corruption}; captured run/history/draft restored, one resume, no repeated mutation.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
