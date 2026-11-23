/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify answer-free hint and resume receipts cannot replace privately confirmed answer letters.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-known-answer-reveals-"));
const output = path.resolve(root, "artifacts/race-known-answer-reveals");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/web/fixtures/RetainedRaceHarness.tsx"))};
const params=new URLSearchParams(location.search),operation=params.get('operation'),candidate=params.get('candidate');
const key='riddleQuest:activeRaceRun',now=Date.now();
let view={runId:'startup-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'Question 1',answerLength:5,position:0,evaluation:{answer:'piano',locale:'en'},
 guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},events:[],serverNowMs:now,startsAtMs:now-1000};
if(candidate==='legacy')delete view.currentRiddle.evaluation;
function answerFree(run){const copy=structuredClone(run);delete copy.preloadedRiddles;delete copy.currentRiddle.evaluation;return copy;}
function chargeHint(){
 if(candidate==='successor')view={...view,correctCount:1,currentRiddle:{...view.currentRiddle,riddleId:'question-1',text:'Question 2',position:1,evaluation:{answer:'clock',locale:'en'}},
 events:[{sequence:0,type:'correct',riddlePosition:0,wallElapsedMs:1000,penaltyAddedMs:0,totalPenaltyMs:0,adjustedElapsedMs:1000,correctCount:1}]};
 view={...view,totalPenaltyMs:RACE_RULES.hintPenaltyMs,adjustedElapsedMs:1000+RACE_RULES.hintPenaltyMs,
 currentRiddle:{...view.currentRiddle,revealedLetters:[{index:0,letter:candidate==='successor'?'c':'p'}]},
 events:[...view.events,{sequence:view.events.length,type:'hint',riddlePosition:view.currentRiddle.position,wallElapsedMs:1000,
 penaltyAddedMs:RACE_RULES.hintPenaltyMs,totalPenaltyMs:RACE_RULES.hintPenaltyMs,adjustedElapsedMs:1000+RACE_RULES.hintPenaltyMs,correctCount:view.correctCount}]};
}
localStorage.setItem(key,JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];let resumes=0,delivered=false;
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function delivery(){const wire=answerFree(view);if(!delivered&&['changed','edited','legacy'].includes(candidate))wire.currentRiddle.revealedLetters[0].letter='z';delivered=true;return wire;}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace'){
  if(resumes++===0){reply(message,'raceResume',{run:structuredClone(view)});return;}
  if(!delivered&&operation==='resume')chargeHint();
  reply(message,'raceResume',{run:delivery()});
 }
 if(message.type==='game:requestRaceHint'){chargeHint();const run=delivery();reply(message,'raceHint',{run,index:0,revealedLetter:run.currentRiddle.revealedLetters[0].letter});}
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
    for (const operation of ['resume','hint'])
    for (const candidate of operation==='resume'?['canonical','changed','edited','legacy','successor']:['canonical','changed','edited']) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?operation='+operation+'&candidate='+candidate);
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();
    await page.keyboard.type('ia');
    if(candidate==='edited')await page.evaluate(()=>{globalThis.testRaceSession.getSnapshot().run.currentRiddle.evaluation.answer='ziano';});
    if(operation==='hint')await page.getByRole('button',{name:/^Hint/}).click();
    else await page.evaluate(()=>globalThis.testRaceSession.retry());
    const rejected=['changed','edited'].includes(candidate);
    if(rejected){await page.getByRole('alert').waitFor({state:'visible'});await page.getByRole('button',{name:'Retry',exact:true}).click();}
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null&&globalThis.testRaceSession.getSnapshot().error===null);
    const state=await page.evaluate(()=>{const snapshot=globalThis.testRaceSession.getSnapshot();return {letters:snapshot.currentLetters,revealed:snapshot.run.currentRiddle.revealedLetters,position:snapshot.run.currentRiddle.position};});
    const letter=candidate==='successor'?'c':candidate==='legacy'?'z':'p';
    assert.deepEqual(state.revealed,[{index:0,letter}]);
    assert.deepEqual(state.letters,[letter,candidate==='successor'?'':'a','','','']);
    assert.equal(state.position,candidate==='successor'?1:0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:requestRaceHint').length),operation==='hint'?1:0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),(operation==='hint'?1:2)+(rejected?1:0));
    assert.equal(await page.getByRole('alert').count(),0);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,operation+'-'+candidate+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Known answer reveal UI passed: '+viewport.width+'px '+operation+' '+candidate+'; '+(rejected?'rejected changed hint and recovered without replay':'accepted compatible reveal')+'.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
