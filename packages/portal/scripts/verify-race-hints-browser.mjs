import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Render the real multiplayer UI with a restored hint validation and replacement snapshots through real multiplayer UI.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-hints-"));
const output = path.resolve(root, "../../artifacts/race-hints");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {RACE_RULES, SubmitRaceGuessResponseSchema} from '@qwordly/core/race';
import {RaceSession} from ${JSON.stringify(path.join(root, "src/play/race/RaceSession.ts"))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
const catalog=createFakeRaceServices();
const deck=Array.from({length:15},(_,position)=>({riddleId:'q-'+position,text:'Question '+(position+1),answerLength:5,
 position,evaluation:{answer:'piano',locale:'en'},hint:{index:0,letter:'p'}}));
const prompt=position=>{const {hint,...content}=deck[position];return {...content,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]};};
const prepared=runId=>({runId,role:'creator',status:'prepared',categoryId:'history',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:0,totalPenaltyMs:0,adjustedElapsedMs:0,currentRiddle:prompt(0),preloadedRiddles:deck,
 events:[],serverNowMs:Date.now(),preparationExpiresAtMs:Date.now()+30000});
let view=prepared('old-owner-run'),owner='owner-1';window.commands=[];window.closeCount=0;
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
function postToHost(message){
 window.commands.push({...message,observedOwner:owner});
 if(message.type==='game:analytics') return;
 if(message.type==='game:listRaceCategories'){
  void catalog.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));return;
 }
 if(message.type==='game:startRace'){reply(message,'raceStart',{run:view});return;}
 if(message.type==='game:resumeRace'){reply(message,'raceResume',{run:view});return;}
 if(message.type==='game:readyRace'){
  const now=Date.now();view={...view,status:'active',startsAtMs:now-1000,serverNowMs:now,wallElapsedMs:1000,adjustedElapsedMs:1000};
  reply(message,'raceReady',{run:view});
 }
}
const app=createRoot(document.getElementById('root'));
const render=ownerId=>app.render(<RaceTo10Game locale="en" coins={100} ownerId={ownerId} postToHost={postToHost} onClose={()=>{window.closeCount++;owner='owner-2';view=prepared('new-owner-run');flushSync(()=>render(owner));}}/>);
window.mode=new URLSearchParams(location.search).get('mode');
const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
if(window.mode==='padded') localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:'  old-owner-run  '}));
if(window.mode==='cleanup'){
 localStorage.setItem('riddleQuest:activeRaceRun','old-malformed-value');let swapped=false;
 Storage.prototype.getItem=function(key){const snapshot=get.call(this,key);
  if(!swapped&&key==='riddleQuest:activeRaceRun'){swapped=true;set.call(this,key,JSON.stringify({ownerId:'other-owner',runId:'replacement-run'}));}
  return snapshot;
 };
}
window.probeHints=()=>{
 const commands=[],now=Date.now();
 const session=new RaceSession({locale:'en',ownerId:'probe-owner'},{postToHost:message=>commands.push(message),
  persistence:{read:()=>42,save:()=>{},clear:()=>{}},recovery:{read:()=>({version:1,id:'hint-probe',ownerId:'other-owner',locale:'en',savedAtMs:now,
   expiresAtMs:now+30000,intent:{kind:'start',request:{locale:'en',categoryId:'history',requestId:'foreign-original',prepare:true}}}),save:()=>{},clear:()=>{}}});
 session.enter();const result={type:commands.at(-1)?.type,pending:session.getSnapshot().pending,error:session.getSnapshot().error};
 session.dispose();return result;
};
render(owner);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const mode of ["padded", "cleanup"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
    const probe=await page.evaluate(()=>window.probeHints());
    assert.deepEqual(probe,{type:'game:listRaceCategories',pending:'raceCategories',error:null});
    if(mode==='padded'){
      await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>window.commands.find(command=>command.type==='game:resumeRace')?.payload.runId),'old-owner-run');
      assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:startRace').length),0);
    }else{
      await page.locator('.race-category-grid button').first().waitFor({state:'visible'});
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:activeRaceRun'))),{ownerId:'other-owner',runId:'replacement-run'});
      assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),0);
    }
    assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,`${mode}-${viewport.width}.png`),fullPage:true});
    console.log(`Hint UI passed: ${viewport.width}px, ${mode}; invalid adapter hints ignored, canonical resume/replacement hint preserved.`);
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
