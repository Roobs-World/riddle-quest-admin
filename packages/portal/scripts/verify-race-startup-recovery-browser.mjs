/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify initial saved-run failures recover through the actual Retry button and browser reload.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-startup-recovery-"));
const output = path.resolve(root, "../../artifacts/race-startup-recovery");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
const key='riddleQuest:activeRaceRun',now=Date.now();
const view={runId:'startup-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'Question 1',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[],serverNowMs:now,startsAtMs:now-1000};
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];window.recover=false;
function reply(message,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace'){window.resumeMessage=message;if(window.recover)reply(message,{run:view});}}
window.failInitial=kind=>{if(kind==='rejected')reply(window.resumeMessage,undefined,false);
 else reply(window.resumeMessage,{run:kind==='wrong-run'?{...view,runId:'another-run'}:{runId:view.runId}});};
window.confirmResume=()=>reply(window.resumeMessage,{run:view});
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}])
    for (const delivery of ["rejected","malformed","wrong-run"]) for (const recovery of ["retry","reload"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>!!window.resumeMessage);
    await page.evaluate(kind=>window.failInitial(kind),delivery);
    await page.getByRole('alert').waitFor({state:'visible'});
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:activeRaceRun'))),{ownerId:'owner-1',runId:'startup-run'});
    assert.equal(await page.evaluate(()=>window.commands.length),1);
    if(recovery==='retry'){
      await page.evaluate(()=>{window.recover=true;});
      await page.locator('.race-error button').click();
    }else{
      await page.reload();
      await page.waitForFunction(()=>!!window.resumeMessage);
      await page.evaluate(()=>window.confirmResume());
    }
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),recovery==='retry'?2:1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type!=='game:resumeRace').length),0);
    assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().run.runId),'startup-run');
    await page.screenshot({path:path.join(output,delivery+'-'+recovery+'-'+viewport.width+'.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Startup resume UI passed: '+viewport.width+'px '+delivery+' '+recovery+'; original run retained, canonical read heals, no new mutation.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
