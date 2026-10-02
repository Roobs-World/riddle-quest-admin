import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify all paid deliveries own draft letters, history and selection regardless of projection availability.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-paid-draft-checkpoints-"));
const output = path.resolve(root, "../../artifacts/race-paid-draft-checkpoints");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
const params=new URLSearchParams(location.search),mode=params.get('mode'),scenario=params.get('scenario');
const key='riddleQuest:activeRaceRun',now=Date.now();
const deck=Array.from({length:RACE_RULES.deckSize},(_,position)=>({riddleId:'question-'+position,text:'Question '+(position+1),answerLength:5,position,
 evaluation:{answer:position===0?'piano':'clock',locale:'en'},hint:{index:0,letter:position===0?'p':'c'}}));
function prompt(position){const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:RACE_RULES.maxGuessesPerRiddle,hintAvailable:true,revealedLetters:[]};}
let view={runId:'startup-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],serverNowMs:now,startsAtMs:now-1000};
function wire(run){const copy=structuredClone(run);if(mode!=='modern')delete copy.preloadedRiddles;if(mode==='answer-free'&&copy.currentRiddle)delete copy.currentRiddle.evaluation;return copy;}
localStorage.setItem(key,JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];let pending;
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
window.deliver=()=>{const failed=scenario.endsWith('reject');if(!failed)view=pending.run;reply(pending.message,pending.operation,pending.data,!failed);};
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:wire(view)});
 if(message.type==='game:submitRaceGuess'){
  view={...view,currentRiddle:{...view.currentRiddle,guessesUsed:1,guessesRemaining:RACE_RULES.maxGuessesPerRiddle-1}};
  reply(message,'raceGuess',{run:wire(view),feedback:Array.from(message.payload.guess,letter=>({letter,status:'red'})),isCorrect:false,autoSkipped:false});
 }
 if(['game:requestRaceHint','game:skipRaceRiddle'].includes(message.type)){
  const hint=message.type==='game:requestRaceHint',penalty=hint?RACE_RULES.hintPenaltyMs:RACE_RULES.skipPenaltyMs;
  const run={...view,totalPenaltyMs:penalty,adjustedElapsedMs:1000+penalty,correctCount:hint?0:1,
   currentRiddle:hint?{...view.currentRiddle,revealedLetters:[{index:0,letter:'p'}]}:prompt(1),
   events:[{sequence:0,type:hint?'hint':'skip',riddlePosition:0,wallElapsedMs:1000,penaltyAddedMs:penalty,totalPenaltyMs:penalty,adjustedElapsedMs:1000+penalty,correctCount:hint?0:1}]};
  pending={message,run,operation:hint?'raceHint':'raceSkip',data:{run:wire(run),...(hint?{index:0,revealedLetter:'p'}:{penaltyAddedMs:penalty})}};
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
    for (const mode of ['modern','prompt-only','answer-free'])
    for (const scenario of ['hint-draft','hint-question','hint-reject','hint-normal','skip-reject','skip-normal']) {
    const context = await browser.newContext({viewport});const page = await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode+'&scenario='+scenario);
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();await page.keyboard.type('zzzzz');
    await page.locator('.race-actions .submit-action').click();
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null);
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').first().click();await page.keyboard.type('pi');
    await page.locator('.race-gameplay .guess-row .cell:not([disabled])').nth(3).click();
    const original=await page.evaluate(()=>{window.retained=globalThis.testRaceSession.getSnapshot();return {letters:window.retained.currentLetters,history:window.retained.raceGuesses,slot:window.retained.activeSlotIndex};});
    assert.equal(original.slot,3);
    const hint=scenario.startsWith('hint');await page.getByRole('button',{name:hint?/^Hint/:/^Skip/}).click();
    await page.waitForFunction(()=>['raceHint','raceSkip'].includes(globalThis.testRaceSession.getSnapshot().pending));
    if(scenario==='hint-draft'||scenario.endsWith('reject'))await page.evaluate(()=>{window.retained.currentLetters[1]='x';window.retained.raceGuesses[0].guess[0]='x';window.retained.raceGuesses[0].feedback[0]='green';globalThis.testRaceSession.getSnapshot().activeSlotIndex=4;});
    if(scenario==='hint-question')await page.evaluate(()=>{const prompt=globalThis.testRaceSession.getSnapshot().run.currentRiddle;prompt.riddleId='edited-question';prompt.position=1;});
    await page.evaluate(()=>window.deliver());
    const rejected=scenario.endsWith('reject');
    if(rejected){
      await page.getByRole('alert').waitFor({state:'visible'});
      assert.deepEqual(await page.evaluate(()=>{const s=globalThis.testRaceSession.getSnapshot();return {letters:s.currentLetters,history:s.raceGuesses,slot:s.activeSlotIndex};}),original);
      await page.getByRole('button',{name:'Retry',exact:true}).click();
    }
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null&&globalThis.testRaceSession.getSnapshot().error===null);
    const state=await page.evaluate(()=>{const s=globalThis.testRaceSession.getSnapshot();return {letters:s.currentLetters,history:s.raceGuesses,slot:s.activeSlotIndex,position:s.run.currentRiddle.position,riddleId:s.run.currentRiddle.riddleId};});
    assert.deepEqual(state.letters,rejected?original.letters:hint?['p','i','','','']:['','','','','']);
    assert.deepEqual(state.history,rejected||hint?original.history:[]);assert.equal(state.slot,rejected||hint?3:0);
    assert.equal(state.position,!rejected&&!hint?1:0);assert.equal(state.riddleId,'question-'+state.position);
    assert.equal(await page.evaluate(type=>window.commands.filter(command=>command.type===type).length,hint?'game:requestRaceHint':'game:skipRaceRiddle'),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),rejected?2:1);
    assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,scenario+'-'+mode+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Paid draft checkpoint UI passed: '+viewport.width+'px '+mode+' '+scenario+'; original draft/history ownership and no paid mutation replay.');await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
