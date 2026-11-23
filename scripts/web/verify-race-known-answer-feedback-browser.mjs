/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify exact scoring retains privately confirmed answers across wire omissions and public edits.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-known-answer-feedback-"));
const output = path.resolve(root, "artifacts/race-known-answer-feedback");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
const params=new URLSearchParams(location.search),mode=params.get('mode'),candidate=params.get('candidate');
const key='riddleQuest:activeRaceRun',now=Date.now();
const deck=Array.from({length:RACE_RULES.deckSize},(_,position)=>({riddleId:'question-'+position,text:'Question '+(position+1),answerLength:5,
 position,evaluation:{answer:'piano',locale:'en'},hint:{index:0,letter:'p'}}));
const {hint,...content}=deck[0];
let view={runId:'startup-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},preloadedRiddles:deck,
 events:[],serverNowMs:now,startsAtMs:now-1000};
if(mode==='prompt')delete view.preloadedRiddles;
if(mode==='deck')delete view.currentRiddle.evaluation;
function answerFree(run){const copy=structuredClone(run);delete copy.preloadedRiddles;delete copy.currentRiddle.evaluation;return copy;}
if(mode==='legacy')view=answerFree(view);
localStorage.setItem(key,JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];let resumes=0;
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:resumes++===0?structuredClone(view):answerFree(view)});
 if(message.type==='game:submitRaceGuess'){
  view={...view,currentRiddle:{...view.currentRiddle,guessesUsed:1,guessesRemaining:4}};
  const feedback=Array.from(message.payload.guess,letter=>({letter,status:'red'}));
  if(candidate==='changed')feedback[0].status=mode==='public-edit'?'green':'yellow';
  reply(message,'raceGuess',{run:answerFree(view),feedback,isCorrect:false,autoSkipped:false});
 }
}
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
    for (const mode of ['both','prompt','deck','public-edit','legacy'])
    for (const candidate of ['canonical','changed']) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode+'&candidate='+candidate);
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    if(mode==='public-edit')await page.evaluate(()=>{globalThis.testRaceSession.getSnapshot().run.currentRiddle.evaluation.answer='ziano';});
    else await page.evaluate(()=>globalThis.testRaceSession.retry());
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null);
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();
    await page.keyboard.type('zzzzz');
    await page.locator('.race-actions .submit-action').click();
    const rejected=candidate==='changed'&&mode!=='legacy';
    if(rejected){
      await page.getByRole('alert').waitFor({state:'visible'});
      assert.equal((await page.locator('.race-gameplay .guess-row .cell').allTextContents()).join(''),'zzzzz');
      await page.getByRole('button',{name:'Retry',exact:true}).click();
    }
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null&&globalThis.testRaceSession.getSnapshot().error===null);
    const state=await page.evaluate(()=>{const snapshot=globalThis.testRaceSession.getSnapshot();return {attempts:snapshot.run.currentRiddle.guessesUsed,history:snapshot.raceGuesses.map(row=>row.feedback)};});
    assert.equal(state.attempts,1);
    // Recovery reserves the applied attempt without trusting its rejected colors.
    assert.deepEqual(state.history,rejected?[[]]:[[mode==='legacy'&&candidate==='changed'?'yellow':'red','red','red','red','red']]);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:submitRaceGuess').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),(mode==='public-edit'?1:2)+(rejected?1:0));
    assert.equal(await page.getByRole('alert').count(),0);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,mode+'-'+candidate+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Known answer feedback UI passed: '+viewport.width+'px '+mode+' '+candidate+'; '+(rejected?'rejected and recovered with one guess mutation':'accepted compatible confirmation')+'.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
