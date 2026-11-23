/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify denied journal reads preserve another tab's selection during provider completion.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-search-journal-observation-"));
const output = path.resolve(root, "artifacts/race-search-journal-observation");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
import {RACE_RECOVERY_KEY} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/web/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const authority=createFakeRaceServices(),originalRead=Storage.prototype.getItem;
window.denied=false;Storage.prototype.getItem=function(key){if(window.denied&&key===RACE_RECOVERY_KEY)throw new Error('read denied');return originalRead.call(this,key);};
function postToHost(message){if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data}}})));}
const matchmaking={find:async()=>{
 const prior=JSON.parse(localStorage.getItem(RACE_RECOVERY_KEY));localStorage.setItem(RACE_RECOVERY_KEY,JSON.stringify({...prior,id:'other-tab-journal',intent:{kind:'challenge',challengeId:'newer-challenge'}}));window.denied=true;
 return {status:'success',value:{status:'matched',challenge:{challengeId:'older-result',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000}}};
 }};
window.runSearch=async()=>{try{await window.testRaceSession.findOpponent(matchmaking);}finally{window.denied=false;}};
window.readJournal=()=>JSON.parse(localStorage.getItem(RACE_RECOVERY_KEY));
createRoot(document.getElementById('root')).render(<RaceTo10Game matchmaking={matchmaking} locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
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
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    {
      const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().categories.length>0&&!globalThis.testRaceSession.getSnapshot().pending);
      await page.evaluate(()=>window.runSearch());
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().matchSearchStatus),'matched');
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().activeChallengeId),'older-result');
      assert.equal(await page.evaluate(()=>window.readJournal().id),'other-tab-journal');
      assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(output,'journal-'+viewport.width+'.png'),fullPage:true});
      console.log('Denied search journal observation passed at '+viewport.width+'px.');
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
