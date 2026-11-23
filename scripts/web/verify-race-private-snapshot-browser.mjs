/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify real multiplayer paid-action rejection and resume recovery after shared nested public snapshot mutations.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-private-snapshot-"));
const output = path.resolve(root, "artifacts/race-private-snapshot");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {RACE_RULES, SubmitRaceGuessResponseSchema} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RaceSession} from ${JSON.stringify(path.join(root, "src/races/browser/controllers/RaceSession.ts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/races/testing/browser/fakeRaceServices.ts"))};
const catalog=createFakeRaceServices();
for(const method of ['getItem','setItem','removeItem']) Storage.prototype[method]=()=>{throw new DOMException('Storage denied','SecurityError');};
const deck=Array.from({length:15},(_,position)=>({riddleId:'q-'+position,text:'Question '+(position+1),answerLength:5,
 position,evaluation:{answer:'piano',locale:'en'},hint:{index:0,letter:'p'}}));
const prompt=position=>{const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
const activeView=runId=>{const now=Date.now();return {runId,role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:15000,adjustedElapsedMs:16000,
 currentRiddle:{...prompt(0),revealedLetters:[{index:0,letter:'p'}]},preloadedRiddles:deck,
 events:[{sequence:0,type:'hint',riddlePosition:0,wallElapsedMs:1000,penaltyAddedMs:15000,totalPenaltyMs:15000,adjustedElapsedMs:16000,correctCount:0}],
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
   currentRiddle:hint?{...prompt(0),revealedLetters:[{index:0,letter:'p'},{index:1,letter:'i'}]}:prompt(1),
   events:[...view.events,{sequence:1,type:hint?'hint':'skip',riddlePosition:0,wallElapsedMs:wall,penaltyAddedMs:fee,totalPenaltyMs:total,adjustedElapsedMs:wall+total,correctCount:hint?0:1}]};
  const bad=structuredClone(view);bad.events[0].riddlePosition=1;
  reply(message,hint?'raceHint':'raceSkip',{run:bad,...(hint?{index:1,revealedLetter:'i'}:{penaltyAddedMs:RACE_RULES.skipPenaltyMs})});return;
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
  await build({plugins: [{name:"expose-injected-race-session", transform(code, id) {
    if (!id.endsWith("/races/hooks/useRaceSession.ts")) return null;
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const corruption of ["rules","deck-answer","prompt-answer","event","reveal"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?corruption=${corruption}`);
    await page.locator(".race-category-grid button").first().waitFor({state:"visible"});
    await page.locator(".race-category-grid button").first().click();
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible"});
    await page.locator(".race-gameplay .guess-row .cell:not([disabled])").first().click();
    await page.keyboard.type("i");
    const result=await page.evaluate(kind=>{
      const session=globalThis.testRaceSession,original=structuredClone(session.getSnapshot().run),run=session.getSnapshot().run;
      if(kind==='rules')run.rules.maxHintsPerRiddle=1;
      if(kind==='deck-answer')run.preloadedRiddles[1].evaluation.answer='clocx';
      if(kind==='prompt-answer')run.currentRiddle.evaluation.answer='ziano';
      if(kind==='event')run.events[0].riddlePosition=1;
      if(kind==='reveal')run.currentRiddle.revealedLetters[0].letter='x';
      session.retry();
      const recovered=session.getSnapshot();
      return {error:recovered.error,letters:recovered.currentLetters,original,recovered:recovered.run};
    },corruption);
    assert.equal(result.error,null);assert.deepEqual(result.letters,['p','i','','','']);assert.deepEqual(result.recovered,result.original);
    await page.getByText("Question 1",{exact:true}).waitFor({state:"visible"});
    assert.equal(await page.getByRole("alert").count(),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:requestRaceHint','game:skipRaceRiddle','game:submitRaceGuess'].includes(command.type)).length),0);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,`${corruption}-${viewport.width}.png`),fullPage:true});
    console.log(`Private snapshot UI passed: ${viewport.width}px ${corruption}; canonical nested authority restored, draft retained, one resume and no mutations.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
