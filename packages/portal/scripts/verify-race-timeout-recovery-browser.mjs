/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify real multiplayer timeout ownership through actual browser reload and result acknowledgement.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-timeout-recovery-"));
const output = path.resolve(root, "../../artifacts/race-timeout-recovery");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root, "src/play/race/logic/racePresentation.ts"))};
const key='riddleQuest:activeRaceRun',canonicalKey='test:timeout-canonical';
const now=Date.now(),saved=localStorage.getItem(canonicalKey);
let view=saved?JSON.parse(saved):{runId:'timeout-run',role:'challenger',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'Question 1',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[],opponent:{displayName:'Nova',adjustedFinishMs:360000,events:[]},serverNowMs:now,startsAtMs:now-1000};
if(!saved){localStorage.setItem(key,JSON.stringify({ownerId:'owner-1',runId:view.runId}));localStorage.setItem(canonicalKey,JSON.stringify(view));}
window.commands=[];window.closeCount=0;
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
function postToHost(message){
 window.commands.push(message);
 if(message.type==='game:resumeRace'){reply(message,'raceResume',{run:view});return;}
 if(message.type==='game:getRaceOutcome'){window.outcomeMessage=message;return;}
}
window.expireRace=()=>{view={...view,status:'timed_out',currentRiddle:null,wallElapsedMs:300000,adjustedElapsedMs:300000,serverNowMs:view.startsAtMs+300000};
 localStorage.setItem(canonicalKey,JSON.stringify(view));globalThis.testRaceSession.retry();};
window.failOutcome=kind=>{if(kind==='pending')return;
 if(kind==='rejected')reply(window.outcomeMessage,'raceOutcome',undefined,false);
 else reply(window.outcomeMessage,'raceOutcome',{...projectRaceOutcome(view,300000),runId:'another-run'});};
window.confirmOutcome=()=>reply(window.outcomeMessage,'raceOutcome',projectRaceOutcome(view,300000));
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{window.closeCount++;}}/>);
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const delivery of ["pending","rejected","malformed"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    await page.evaluate(()=>window.expireRace());
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending==='raceOutcome');
    await page.evaluate(kind=>window.failOutcome(kind),delivery);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:activeRaceRun'))),{ownerId:'owner-1',runId:'timeout-run'});
    await page.reload();
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending==='raceOutcome');
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:getRaceOutcome').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle'].includes(command.type)).length),0);
    await page.evaluate(()=>window.confirmOutcome());
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null);
    await page.locator('.race-result').waitFor({state:'visible'});
    assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().outcome.result),'timed_out');
    await page.screenshot({path:path.join(output,delivery+'-'+viewport.width+'.png'),fullPage:true});
    await page.locator('.race-result > button').last().click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('riddleQuest:activeRaceRun')),null);
    assert.equal(await page.evaluate(()=>window.closeCount),1);
    assert.deepEqual(errors,[]);
    console.log('Timeout reload UI passed: '+viewport.width+'px '+delivery+'; retained result hint survives reload, one resume/read, acknowledgement clears it.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
