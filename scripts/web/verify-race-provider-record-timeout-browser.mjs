/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify mounted result and publication ownership despite mutation of retained presentation references.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-provider-record-timeout-"));
const output = path.resolve(root, "artifacts/race-provider-record-timeout");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root, "src/web/play/sharing/ReferralSharingCapability.tsx"))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root, "src/web/play/race/logic/racePresentation.ts"))};
const now=Date.now();
const view={runId:'recorded-run',role:'creator',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 correctCount:10,wallElapsedMs:60000,totalPenaltyMs:0,adjustedElapsedMs:60000,currentRiddle:null,
 events:[],serverNowMs:now,startsAtMs:now-60000};
const canonical=projectRaceOutcome(view,60000);
const preview={challengeId:'published',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,
 adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:now+60000};
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];window.writes=0;window.reads=[];window.writeReplies=[];
let providerNow=0,providerSequence=0;
const providerTimers=new Map();
window.providerClock={schedule:(callback,delay)=>{const id=++providerSequence;providerTimers.set(id,{callback,at:providerNow+delay});return id;},cancel:id=>providerTimers.delete(id)};
window.advanceProvider=elapsed=>{providerNow+=elapsed;for(const [id,timer]of [...providerTimers])if(timer.at<=providerNow){providerTimers.delete(id);timer.callback();}};
window.providerTimerCount=()=>providerTimers.size;
const stage=new URL(location.href).searchParams.get('stage');
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:view});
 if(message.type==='game:getRaceOutcome')reply(message,'raceOutcome',canonical);
 if(message.type==='game:listRaceCategories')reply(message,'raceCategories',{categories:[],rules:RACE_RULES});
 if(message.type==='game:listRaceInbox')reply(message,'raceInbox',{items:[]});}
const adapter={record:()=>{window.writes++;return new Promise((resolve,reject)=>window.writeReplies.push({resolve,reject}));},
 list:()=>new Promise(resolve=>window.reads.push(resolve))};
window.finishRead=(index,rank)=>window.reads[index]({tournamentId:'daily',contextId:'room',locale:'en',
 startsAtMs:now,endsAtMs:now+60000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,
 standings:[{rank,adjustedTimeMs:60000,isCurrentPlayer:true}]});
createRoot(document.getElementById('root')).render(<ReferralSharingProvider capability={{rewardCoins:25,shareResult:()=>{},shareInvite:()=>{},shareRace:async()=> 'cancelled'}}>
 <RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}
 tournaments={stage==='tournaments'?adapter:undefined} contextBoard={stage==='inbox'?adapter:undefined}/></ReferralSharingProvider>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if (id.endsWith("/scripts/fixtures/RetainedRaceHarness.tsx")) {
      const constructor="new RaceProviderViews({reportError: session.reportError})";
      assert(code.includes(constructor));
      return {code:code.replace(constructor,"new RaceProviderViews({reportError: session.reportError, clock: window.providerClock})"),map:null};
    }
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
  for (const viewport of [{width:1280,height:900}, {width:390,height:844}]) for (const stage of ["tournaments","inbox"]) for (const ending of ["success","failure"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?stage='+stage);
    await page.waitForFunction(()=>window.writes===1&&globalThis.testRaceSession.getSnapshot().pending===null);
    await page.evaluate(()=>{window.advanceProvider(29999);globalThis.testRaceSession.navigate('categories');});
    await page.getByRole('tab',{name:stage==='tournaments'?'Tournaments':'Activity',exact:true}).click();
    await page.waitForFunction(()=>window.reads.length===1);
    assert.equal(await page.evaluate(()=>window.writes),1);
    await page.evaluate(()=>{window.finishRead(0,9);window.advanceProvider(1);});
    await page.locator('li[aria-current="true"]').waitFor();
    await page.getByRole('tab',{name:'Play',exact:true}).click();
    await page.getByRole('tab',{name:stage==='tournaments'?'Tournaments':'Activity',exact:true}).click();
    await page.waitForFunction(()=>window.writes===2&&window.reads.length===2);
    await page.evaluate(ending=>{if(ending==='success')window.writeReplies[0].resolve({});else window.writeReplies[0].reject(new Error('late-offline'));},ending);
    assert.equal(await page.evaluate(()=>window.reads.length),2);
    await page.evaluate(()=>window.writeReplies[1].resolve({}));
    await page.waitForFunction(()=>window.reads.length===3);
    await page.evaluate(()=>window.finishRead(1,9));
    assert.equal(await page.locator('li[aria-current="true"]').count(),0);
    await page.evaluate(()=>window.finishRead(2,1));
    await page.locator('li[aria-current="true"]').waitFor();
    assert.equal(await page.locator('li[aria-current="true"] strong').textContent(),'#1');
    await page.getByRole('tab',{name:'Play',exact:true}).click();
    await page.getByRole('tab',{name:stage==='tournaments'?'Tournaments':'Activity',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.writes),2);
    await page.evaluate(()=>window.finishRead(3,1));
    await page.locator('li[aria-current="true"]').waitFor();
    assert.equal(await page.evaluate(()=>window.providerTimerCount()),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle','game:publishRace'].includes(command.type)).length),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:getRaceOutcome').length),1);
    assert.equal(await page.getByRole('alert').count(),0);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,stage+'-'+ending+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Provider record deadline UI passed: '+viewport.width+'px '+stage+' '+ending+'; no early retry, one deadline retry, late reply ignored, timers cleared, no repeated race mutation.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
