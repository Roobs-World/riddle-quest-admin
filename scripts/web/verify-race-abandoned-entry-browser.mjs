/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify terminal entry recovery restores a usable catalog before a deliberate new selection.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-abandoned-entry-"));
const output = path.resolve(root, "artifacts/race-abandoned-entry");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/web/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const authority=createFakeRaceServices();
const path=new URL(location.href).searchParams.get('path')||'resume';
const prepared=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'initial',prepare:true,includeEvaluation:true})).run;
const abandoned=(await authority.abandonRace({runId:prepared.runId,requestId:'abandon-in-other-tab'})).run;
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:prepared.runId}));
window.commands=[];window.closeCount=0;
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:path==='ready'?prepared:abandoned});
 if(message.type==='game:readyRace'){if(message.payload.runId===prepared.runId)reply(message,'raceReady',{run:abandoned});else void authority.readyRace({...message.payload,requestId:message.requestId}).then(data=>reply(message,'raceReady',data));}
 if(message.type==='game:listRaceCategories')setTimeout(async()=>reply(message,'raceCategories',await authority.listRaceCategories('en')),250);
 if(message.type==='game:startRace')void authority.startRace({...message.payload,requestId:message.requestId}).then(data=>reply(message,'raceStart',data));
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{window.closeCount++;}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if (process.env.RACE_ABANDONED_ENTRY_BASELINE === "1" && id.endsWith("/races/controllers/RaceSession.ts"))
      return readFile(path.join(output,"prior-race-session.ts"),"utf8").then(code=>({code,map:null}));
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
  for(const entryPath of ['resume','ready'])for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?path='+entryPath);
    await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='categories'&&window.commands.some(command=>command.type==='game:resumeRace'));
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:listRaceCategories').length),1,'Abandoned entry must load a missing catalog');
    const choices=page.locator('.race-category-grid button');await choices.first().waitFor({state:'visible'});
    assert.equal(await choices.count(),6);assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('riddleQuest:activeRaceRun')),null);
    assert.equal(await page.evaluate(()=>window.closeCount),0);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:abandonRace','game:submitRaceGuess'].includes(command.type)).length),0);
    await page.screenshot({path:path.join(output,entryPath+'-catalog-'+viewport.width+'.png'),fullPage:true});
    await choices.first().click();await page.waitForFunction(()=>window.commands.some(command=>command.type==='game:startRace'));
    const start=await page.evaluate(()=>window.commands.find(command=>command.type==='game:startRace'));
    assert.equal(start.payload.challengeId,undefined);assert.equal(start.payload.rivalryChallengeId,undefined);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:startRace').length),1);
    await page.locator(".race-gameplay .guess-board").waitFor({state:"visible"});
    assert.equal(await page.getByRole("alert").count(),0);
    assert.notEqual(await page.evaluate(()=>globalThis.testRaceSession.getSnapshot().run.runId),await page.evaluate(()=>window.commands.find(command=>command.type==="game:resumeRace").payload.runId));
    assert.deepEqual(errors,[]);
    console.log('Abandoned '+entryPath+' entry passed at '+viewport.width+'px: six categories loaded, old run hint cleared, no automatic mutation, fresh selection starts once without old challenge.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
