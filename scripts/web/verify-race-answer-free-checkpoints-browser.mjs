/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify answer-free submissions retain private input and history independently of public arrays.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-answer-free-checkpoints-"));
const output = path.resolve(root, "artifacts/race-answer-free-checkpoints");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {computeFeedback} from ${JSON.stringify(path.join(root, 'src/core/game'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
const params=new URLSearchParams(location.search),known=params.get('known')==='true',scenario=params.get('scenario');
const key='riddleQuest:activeRaceRun',now=Date.now();
let view={runId:'startup-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'Question 1',answerLength:5,position:0,evaluation:{answer:'piano',locale:'en'},
 guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},events:[],serverNowMs:now,startsAtMs:now-1000};
function answerFree(run){const copy=structuredClone(run);delete copy.preloadedRiddles;delete copy.currentRiddle.evaluation;return copy;}
localStorage.setItem(key,JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];let resumes=0,pending;
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
window.deliver=()=>{const data=structuredClone(pending.data);if(scenario==='changed-echo')data.feedback[0].letter='x';reply(pending.message,'raceGuess',data,scenario!=='transport');};
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:known&&resumes++===0?structuredClone(view):answerFree(view)});
 if(message.type==='game:submitRaceGuess'){
  const used=view.currentRiddle.guessesUsed+1;view={...view,currentRiddle:{...view.currentRiddle,guessesUsed:used,guessesRemaining:RACE_RULES.maxGuessesPerRiddle-used}};
  const colors=computeFeedback(message.payload.guess,'piano','en');
  const data={run:answerFree(view),feedback:Array.from(message.payload.guess,(letter,index)=>({letter,status:colors[index]})),isCorrect:false,autoSkipped:false};
  if(scenario==='history'&&used===1)reply(message,'raceGuess',data);else pending={message,data};
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
    for (const known of [true,false])
    for (const scenario of ['canonical','changed-echo','transport','history','normal']) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?known='+known+'&scenario='+scenario);
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    if(known)await page.evaluate(()=>globalThis.testRaceSession.retry());
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null);
    let history=[];
    if(scenario==='history'){
      await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();await page.keyboard.type('aaaaa');
      await page.locator('.race-actions .submit-action').click();
      await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null);
      history=await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().raceGuesses);
    }
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();await page.keyboard.type('zzzzz');
    await page.locator('.race-actions .submit-action').click();
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending==='raceGuess');
    assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().allowTypingWhilePending),false);
    await page.keyboard.type('x');
    assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),[...'zzzzz']);
    if(scenario==='history')await page.evaluate(()=>{const row=globalThis.testRaceSession.getSnapshot().raceGuesses[0];row.guess[0]='x';row.feedback[0]='green';});
    else if(scenario!=='normal')await page.evaluate(()=>{globalThis.testRaceSession.getSnapshot().currentLetters[0]='x';});
    await page.evaluate(()=>window.deliver());
    const rejected=['changed-echo','transport'].includes(scenario);
    if(rejected){
      await page.getByRole('alert').waitFor({state:'visible'});
      assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),[...'zzzzz']);
      await page.getByRole('button',{name:'Retry',exact:true}).click();
    }
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null&&globalThis.testRaceSession.getSnapshot().error===null);
    const state=await page.evaluate(()=>{const snapshot=globalThis.testRaceSession.getSnapshot();return {letters:snapshot.currentLetters,history:snapshot.raceGuesses,attempts:snapshot.run.currentRiddle.guessesUsed};});
    assert.deepEqual(state.letters,rejected?[...'zzzzz']:['','','','','']);
    assert.deepEqual(state.history,rejected?[{guess:[],feedback:[]}]:[...history,{guess:[...'zzzzz'],feedback:['red','red','red','red','red']}]);
    assert.equal(state.attempts,scenario==='history'?2:1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:submitRaceGuess').length),scenario==='history'?2:1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),(known?2:1)+(rejected?1:0));
    assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,scenario+'-'+known+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Answer-free checkpoint UI passed: '+viewport.width+'px known='+known+' '+scenario+'; immutable submitted letters/history and no mutation replay.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
