/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify real keyboard drafts survive creator and matched reloads only after canonical resume.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-draft-reload-"));
const output = path.resolve(root, "artifacts", process.env.RACE_DRAFT_OUTPUT_DIR || "race-draft-reload");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
const params=new URLSearchParams(location.search),role=params.get('role')||'creator',mode=params.get('mode')||'normal';
const now=Date.now(),deck=Array.from({length:RACE_RULES.deckSize},(_,position)=>({riddleId:'question-'+position,text:'Question '+(position+1),answerLength:5,position,evaluation:{answer:position===0?'piano':'clock',locale:'en'}}));
const saved=localStorage.getItem('fixture:serverRun');
let view=saved?JSON.parse(saved):{runId:'draft-reload-run',role:'creator',status:'active',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{...deck[0],guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 preloadedRiddles:deck,events:[],serverNowMs:now,startsAtMs:now-1000,
 ...(role==='challenger'?{role:'challenger',challengeId:'matched-challenge',opponent:{displayName:'Nova',adjustedFinishMs:60000,events:[]}}:{})};
if(mode==='scheduled'){if(!saved)view={...view,status:'scheduled',wallElapsedMs:0,adjustedElapsedMs:0,startsAtMs:now+3000};else if(now>=view.startsAtMs)view={...view,status:'active',serverNowMs:now,wallElapsedMs:now-view.startsAtMs,adjustedElapsedMs:now-view.startsAtMs};}
window.readDraft=Storage.prototype.getItem.bind(localStorage,'riddleQuest:raceDraft');
if(!saved&&mode==='write-confirmation'){let blocked=false,fail=true;const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(blocked&&key==='riddleQuest:raceDraft')throw new DOMException('Confirmation denied','SecurityError');return get.call(this,key);};Storage.prototype.setItem=function(key,value){set.call(this,key,value);if(fail&&key==='riddleQuest:raceDraft')blocked=true;};window.recoverDraftReads=()=>{blocked=false;fail=false;};}
if(!saved&&mode==='write-recovery'){const original=Storage.prototype.setItem;window.draftWritesAllowed=false;Storage.prototype.setItem=function(key,value){if(key==='riddleQuest:raceDraft'&&!window.draftWritesAllowed)throw new DOMException('Quota temporarily unavailable','QuotaExceededError');return original.call(this,key,value);};}
if(saved&&mode==='denied'){const original=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='riddleQuest:raceDraft')throw new DOMException('Read unavailable','SecurityError');return original.call(this,key);};}
localStorage.setItem('fixture:serverRun',JSON.stringify(view));
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:resumeRace'){window.resumeRequest=message;setTimeout(()=>reply(message,'raceResume',{run:view}),350);}}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if (process.env.RACE_DRAFT_CONFIRMATION_BASELINE === "1" && id.endsWith("/play/race/logic/raceDraftStorage.ts"))
      return readFile(path.resolve(root,"artifacts/race-draft-confirmation-recovery/prior-draft-storage.ts"),"utf8").then(code=>({code,map:null}));
    if (process.env.RACE_DRAFT_WRITE_BASELINE === "1" && id.endsWith("/play/race/logic/raceDraftStorage.ts"))
      return readFile(path.resolve(root,"artifacts/race-draft-write-recovery/prior-draft-storage.ts"),"utf8").then(code=>({code,map:null}));
    if (process.env.RACE_SCHEDULED_DRAFT_BASELINE === "1" && id.endsWith("/play/race/RaceSession.ts"))
      return readFile(path.resolve(root,"artifacts/race-scheduled-draft/prior-race-session.ts"),"utf8").then(code=>({code,map:null}));
    if (process.env.RACE_SCHEDULED_DRAFT_BASELINE === "1" && id.endsWith("/play/race/logic/raceDraftStorage.ts"))
      return readFile(path.resolve(root,"artifacts/race-scheduled-draft/prior-draft-storage.ts"),"utf8").then(code=>({code,map:null}));
    if (process.env.RACE_DRAFT_BASELINE === "1" && id.endsWith("/play/race/RaceSession.ts"))
      return readFile(path.join(output,"prior-race-session.ts"),"utf8").then(code=>({code,map:null}));
    if (process.env.RACE_DRAFT_READ_BASELINE === "1" && id.endsWith("/play/race/logic/raceDraftStorage.ts"))
      return readFile(path.resolve(root,"artifacts/race-draft-storage-failure/prior-draft-storage.ts"),"utf8").then(code=>({code,map:null}));
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
  for(const mode of process.env.RACE_DRAFT_MODE?[process.env.RACE_DRAFT_MODE]:['normal','denied','scheduled','write-recovery','write-confirmation'])for(const role of ['creator','challenger'])for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?role='+role+'&mode='+mode);
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    await page.keyboard.type('pi');await page.locator('.race-gameplay .guess-row .cell').nth(3).click();
    assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),['P','I','','','']);
    if(mode==='write-recovery'){
      assert.equal(await page.evaluate(()=>window.readDraft()),null,'Denied writes must not claim a persisted draft');
      await page.evaluate(()=>{window.draftWritesAllowed=true;window.recoveryStarted=performance.now();});
      await page.waitForFunction(()=>performance.now()-window.recoveryStarted>=1400);
      assert.deepEqual(await page.evaluate(()=>JSON.parse(window.readDraft())?.letters),['P','I','','',''],
        'An unchanged live draft must persist after write access recovers');
    }
    if(mode==='write-confirmation'){
      await page.evaluate(()=>{window.recoverDraftReads();window.recoveryStarted=performance.now();});
      await page.waitForFunction(()=>performance.now()-window.recoveryStarted>=1400);
      assert.deepEqual(await page.evaluate(()=>JSON.parse(window.readDraft())?.letters),['P','I','','',''],
        'A successful write with unavailable read-back must not freeze later input persistence');
    }
    const savedDraft=await page.evaluate(()=>window.readDraft());
    const identity=await page.evaluate(()=>({runId:globalThis.testRaceSession.getSnapshot().run.runId,startsAtMs:globalThis.testRaceSession.getSnapshot().run.startsAtMs}));
    await page.reload();
    await page.waitForFunction(()=>!!window.resumeRequest);
    assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),[],'Draft must remain hidden before server confirmation');
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    if(mode!=='denied'){
      assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),['P','I','','',''],'Unsent letters must survive a same-question authoritative reload');
      assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().activeSlotIndex),3);
    }else{
      assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),['','','','','']);
      await page.keyboard.type('cl');
      assert.deepEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().currentLetters),['C','L','','','']);
      assert.equal(await page.evaluate(()=>window.readDraft()),savedDraft,'Unreadable draft must never be overwritten by a blind write');
    }
    assert.deepEqual(await page.evaluate(()=>({runId:globalThis.testRaceSession.getSnapshot().run.runId,startsAtMs:globalThis.testRaceSession.getSnapshot().run.startsAtMs})),identity);
    assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle'].includes(command.type)).length),0);
    assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,mode+'-'+role+'-same-question-'+viewport.width+'.png'),fullPage:true});
    console.log('Draft reload UI passed: '+mode+' '+role+' '+viewport.width+'px; authoritative resume, bounded draft recovery or denied-read preservation, original run and schedule preserved, no mutation.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
