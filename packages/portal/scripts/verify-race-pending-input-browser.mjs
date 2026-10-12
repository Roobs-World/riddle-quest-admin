/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify actual keyboard input typed during a pending wrong guess survives canonical same-question recovery.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-pending-input-"));
const output = path.resolve(root, "../../artifacts/race-pending-input");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
const now=Date.now(),deck=Array.from({length:RACE_RULES.deckSize},(_,position)=>({riddleId:'question-'+position,text:'Question '+(position+1),answerLength:5,position,evaluation:{answer:position===0?'piano':'clock',locale:'en'}}));
let view={runId:'pending-input-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{...deck[0],guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 preloadedRiddles:deck,events:[],serverNowMs:now,startsAtMs:now-1000};
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:view});
 if(message.type==='game:submitRaceGuess')window.pendingGuess=message;}
window.failGuess=mode=>{
 if(mode==='applied'||mode==='emptied')view={...view,currentRiddle:{...view.currentRiddle,guessesUsed:1,guessesRemaining:4}};
 if(mode==='advanced')view={...view,correctCount:1,currentRiddle:{...deck[1],guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[{sequence:0,type:'correct',riddlePosition:0,wallElapsedMs:1000,penaltyAddedMs:0,totalPenaltyMs:0,adjustedElapsedMs:1000,correctCount:1}]};
 reply(window.pendingGuess,'raceGuess',undefined,false);};
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const mode of ["applied","unapplied","emptied","advanced"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();
    await page.keyboard.type('zzzzz');
    await page.locator('.race-actions .submit-action').click();
    await page.waitForFunction(()=>!!window.pendingGuess);
    await page.evaluate(()=>{const session=globalThis.testRaceSession,index=session.getSnapshot().activeSlotIndex;
      for(const invalid of [-1,1.5,NaN,Infinity,99])session.input('slot',invalid);
      if(session.getSnapshot().activeSlotIndex!==index)throw new Error('Invalid slot changed pending selection');});
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();
    await page.keyboard.type(mode==='emptied'?'p':'pi');
    if(mode==='emptied')await page.keyboard.press('Backspace');
    assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),mode==='emptied'?['','','','','']:['p','i','','','']);
    await page.evaluate(mode=>window.failGuess(mode),mode);
    await page.getByRole('alert').waitFor({state:'visible'});
    assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),['z','z','z','z','z']);
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null&&globalThis.testRaceSession.getSnapshot().error===null);
    const expected=mode==='advanced'||mode==='emptied'?['','','','','']:['p','i','','',''];
    assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),expected);
    assert.equal((await page.locator('.race-gameplay .guess-row .cell').allTextContents()).join(''),expected.join(''));
    // Applied attempts reserve an unknown row; uncommitted or successor attempts have no old rows.
    assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().raceGuesses),['applied','emptied'].includes(mode)?[{guess:[],feedback:[]}]:[]);
    assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().run.currentRiddle.position),mode==='advanced'?1:0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:submitRaceGuess').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),2);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:requestRaceHint','game:skipRaceRiddle'].includes(command.type)).length),0);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,mode+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Pending draft UI passed: '+viewport.width+'px '+mode+'; original submission rolls back, deliberate input restored only for its question, one guess and read recovery.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
