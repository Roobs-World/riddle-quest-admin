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
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-outcome-isolation-"));
const output = path.resolve(root, "artifacts/race-outcome-isolation");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root, "scripts/fixtures/RetainedRaceHarness.tsx"))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root, "src/sharing/components/ReferralSharingCapability.tsx"))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root, "src/races/presentation/racePresentation.ts"))};
const now=Date.now();
const view={runId:'recorded-run',role:'creator',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 correctCount:10,wallElapsedMs:60000,totalPenaltyMs:0,adjustedElapsedMs:60000,currentRiddle:null,
 events:[],serverNowMs:now,startsAtMs:now-60000};
const canonical=projectRaceOutcome(view,60000);
const preview={challengeId:'published',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,
 adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:now+60000};
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];window.candidate='canonical';window.shareCalls=0;window.publications=[];
window.addEventListener('riddle-quest:race-challenge-published',event=>window.publications.push(event.detail));
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:view});
 if(message.type==='game:getRaceOutcome')reply(message,'raceOutcome',window.candidate==='canonical'?canonical:{...canonical,wallFinishMs:60001,adjustedFinishMs:60001});
 if(message.type==='game:publishRace')reply(message,'racePublish',{challengeId:'published',preview:{...preview,adjustedTimeToBeatMs:window.candidate==='canonical'?60000:60001}});}
window.mutateVisible=()=>{const outcome=globalThis.testRaceSession.getSnapshot().outcome;outcome.wallFinishMs+=1;outcome.adjustedFinishMs+=1;};
createRoot(document.getElementById('root')).render(<ReferralSharingProvider capability={{rewardCoins:25,shareResult:()=>{},shareInvite:()=>{},shareRace:async()=>{window.shareCalls++;return 'cancelled';}}}>
 <RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/></ReferralSharingProvider>);
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
    for (const operation of ["outcome","publication"]) for (const candidate of ["canonical","matching-public-edit"]) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().outcome?.result==='recorded'&&globalThis.testRaceSession.getSnapshot().pending===null);
    await page.evaluate(kind=>{window.mutateVisible();window.candidate=kind;},candidate);
    if(operation==='outcome')await page.evaluate(()=>globalThis.testRaceSession.retry());
    else await page.locator('.race-result .race-primary').click();
    if(candidate==='matching-public-edit'){
      await page.getByRole('alert').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>window.shareCalls),0);
      assert.equal(await page.evaluate(()=>window.publications.length),0);
      await page.evaluate(()=>{window.candidate='canonical';});
      await page.locator('.race-error button').click();
    }
    await page.waitForFunction(()=>globalThis.testRaceSession.getSnapshot().pending===null&&globalThis.testRaceSession.getSnapshot().error===null);
    if(operation==='outcome'){
      assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().outcome.adjustedFinishMs),60000);
      assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().run.adjustedElapsedMs),60000);
    }else{
      assert.equal(await page.evaluate(()=>window.publications.length),1);
      assert.equal(await page.evaluate(()=>window.shareCalls),1);
      assert.equal(await page.evaluate(()=>window.publications[0].preview.adjustedTimeToBeatMs),60000);
      const receipts=await page.evaluate(()=>window.commands.filter(command=>command.type==='game:publishRace').map(command=>command.requestId));
      assert.equal(receipts.length,candidate==='canonical'?1:2);
      assert(receipts.every(id=>id===receipts[0]));
    }
    assert.equal(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().outcome.adjustedFinishMs),60000);
    assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle'].includes(command.type)).length),0);
    await page.screenshot({path:path.join(output,operation+'-'+candidate+'-'+viewport.width+'.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('Private outcome UI passed: '+viewport.width+'px '+operation+' '+candidate+'; confirmed clock retained, malformed change rejected, one canonical publication/share.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
