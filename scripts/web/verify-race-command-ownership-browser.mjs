/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify active-run command and response ownership despite retained rendering identity edits.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-command-ownership-"));
const output = path.resolve(root, "artifacts/race-command-ownership");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
const key='riddleQuest:activeRaceRun',now=Date.now();
const view={runId:'startup-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'Question 1',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[],serverNowMs:now,startsAtMs:now-1000};
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];window.candidate='canonical';window.field='role';
function mutate(run,field){
 if(field==='runId')run.runId='another-run';if(field==='role')run.role='challenger';if(field==='categoryId')run.categoryId='mixed';
 if(field==='locale')run.locale='fr';if(field==='challengeId')run.challengeId='another-challenge';if(field==='rivalryChallengeId')run.rivalryChallengeId='another-rivalry';}
function reply(message,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace'){const response=structuredClone(view);if(window.candidate!=='canonical')mutate(response,window.field);reply(message,{run:response});}}
window.editPublic=field=>{window.field=field;mutate(globalThis.testRaceSession.getSnapshot().run,field);};
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}])
    for (const candidate of ["canonical","matching-public-edit"])
    for (const field of candidate==='canonical'?["runId","role","categoryId","locale","challengeId","rivalryChallengeId"]:["role","categoryId","challengeId","rivalryChallengeId"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    await page.evaluate(({field,candidate})=>{window.editPublic(field);window.candidate=candidate;globalThis.testRaceSession.retry();},{field,candidate});
    assert.deepEqual(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').map(command=>command.payload.runId)),['startup-run','startup-run']);
    if(candidate==='matching-public-edit'){
      await page.getByRole('alert').waitFor({state:'visible'});
      await page.evaluate(()=>{window.candidate='canonical';});
      await page.locator('.race-error button').click();
    }
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null&&globalThis.testRaceSession.getSnapshot().error===null);
    assert.deepEqual(await page.evaluate(()=>{const run=globalThis.testRaceSession.getSnapshot().run;return {runId:run.runId,role:run.role,categoryId:run.categoryId,locale:run.locale,challengeId:run.challengeId??null,rivalryChallengeId:run.rivalryChallengeId??null};}),
      {runId:'startup-run',role:'creator',categoryId:'history',locale:'en',challengeId:null,rivalryChallengeId:null});
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle'].includes(command.type)).length),0);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:activeRaceRun'))),{ownerId:'owner-1',runId:'startup-run'});
    assert.equal(await page.getByRole('alert').count(),0);
    await page.screenshot({path:path.join(output,field+'-'+candidate+'-'+viewport.width+'.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Private command ownership UI passed: '+viewport.width+'px '+field+' '+candidate+'; original run selected, canonical identity restored, no gameplay mutation.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
