/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify terminal entry recovery restores a usable catalog before a deliberate new selection.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-draft-cleanup-recovery-"));
const output = path.resolve(root, "../../artifacts/race-draft-cleanup-recovery");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/play/race/testing/fakeRaceServices.ts"))};
const authority=createFakeRaceServices(),fault=new URL(location.href).searchParams.get('fault');
const active=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'initial',includeEvaluation:true})).run;
let abandoned;
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:active.runId}));
window.commands=[];window.removals=0;window.blockRemoval=true;window.blockRead=false;
window.readDraft=Storage.prototype.getItem.bind(localStorage,'riddleQuest:raceDraft');
const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){set.call(this,key,value);if(key==='riddleQuest:raceDraft'&&window.failConfirmation)window.blockRead=true;};
const get=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='riddleQuest:raceDraft'&&window.blockRead)throw new DOMException('Read denied','SecurityError');return get.call(this,key);};
const remove=Storage.prototype.removeItem;
Storage.prototype.removeItem=function(key){if(key==='riddleQuest:raceDraft'){window.removals++;if(window.blockRemoval){if(fault==='throw')throw new DOMException('Delete denied','SecurityError');return;}}return remove.call(this,key);};
window.retire=async()=>{window.blockRead=window.blockRead||fault==='read';abandoned=(await authority.abandonRace({runId:active.runId,requestId:'abandon-in-other-tab'})).run;window.testRaceSession.retry();};
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:abandoned||active});
 if(message.type==='game:listRaceCategories')setTimeout(async()=>reply(message,'raceCategories',await authority.listRaceCategories('en')),250);
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if (process.env.RACE_DRAFT_CONFIRMATION_BASELINE === "1" && id.endsWith("/play/race/logic/raceDraftStorage.ts"))
      return readFile(path.resolve(root,"../../artifacts/race-draft-confirmation-recovery/prior-draft-storage.ts"),"utf8").then(code=>({code,map:null}));
    if (process.env.RACE_DRAFT_CLEANUP_BASELINE === "1" && id.endsWith("/play/race/RaceSession.ts"))
      return readFile(path.join(output,"prior-race-session.ts"),"utf8").then(code=>({code,map:null}));
    if (process.env.RACE_DRAFT_CLEANUP_BASELINE === "1" && id.endsWith("/play/race/logic/raceDraftStorage.ts"))
      return readFile(path.join(output,"prior-draft-storage.ts"),"utf8").then(code=>({code,map:null}));
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
  for(const fault of ['throw','silent','read','confirmation'])for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?fault='+fault);
    await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'});
    await page.keyboard.type('pi');
    assert.deepEqual(await page.evaluate(()=>JSON.parse(window.readDraft()).letters),['P','I','','','']);
    if(fault==='confirmation'){await page.evaluate(()=>{window.failConfirmation=true;});await page.keyboard.type('a');}
    await page.evaluate(()=>window.retire());
    await page.waitForFunction(()=>window.testRaceSession.getSnapshot().stage==='categories'&&window.testRaceSession.getSnapshot().categories.length===6);
    assert.notEqual(await page.evaluate(()=>window.readDraft()),null);
    await page.evaluate(()=>{window.blockRemoval=false;window.blockRead=false;window.recoveryStarted=performance.now();});
    await page.waitForFunction(()=>performance.now()-window.recoveryStarted>=1400);
    assert.equal(await page.evaluate(()=>window.readDraft()),null,'Terminal cleanup must retry after deletion access recovers');
    assert.equal(await page.evaluate(()=>localStorage.getItem('riddleQuest:activeRaceRun')),null);
    assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),2);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle','game:abandonRace'].includes(command.type)).length),0);
    await page.screenshot({path:path.join(output,fault+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Terminal draft cleanup passed: '+fault+' at '+viewport.width+'px; canonical abandonment, retry in live hub, no mutation or alert.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
