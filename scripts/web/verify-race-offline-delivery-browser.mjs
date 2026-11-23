/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify actual offline fetch rejection restores input and reconnect uses a canonical read.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-offline-delivery-recovery-"));
const output = path.resolve(root, "artifacts/race-offline-delivery-recovery");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/app/styles/game.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/fixtures/RetainedRaceHarness.tsx"))};
const now=Date.now(),view={runId:'keyboard-run',role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'A clue',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[],serverNowMs:now,startsAtMs:now-1000};
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
await fetch('/fixture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(view)});
window.commands=[];
async function postToHost(message){window.commands.push(message);
 const response=await fetch('/bridge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(message)});
 if(!response.ok)throw new Error('host delivery failed');
 const data=await response.json();window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok:true,data}}}));
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server, fixture;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if(process.env.RACE_OFFLINE_BASELINE==='1'&&id.endsWith('/races/controllers/RacePlay.ts'))
      return readFile(path.resolve(output,'../race-async-delivery/prior-play.ts'),'utf8').then(code=>({code,map:null}));
    if (!id.endsWith("/races/hooks/useRaceSession.ts")) return null;
    assert(code.includes("const session = sessionRef.current;"));
    return {code: code.replace("const session = sessionRef.current;", "const session = sessionRef.current; globalThis.testRaceSession = session;"), map: null};
  }}], root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist",target:"esnext"}});
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if(url.pathname==='/fixture'||url.pathname==='/bridge'){
        let raw='';for await(const chunk of request)raw+=chunk;
        const payload=JSON.parse(raw);
        if(url.pathname==='/fixture'){fixture=payload;response.end('{}');return;}
        assert.equal(payload.type,'game:resumeRace');
        const now=Date.now(),elapsed=now-fixture.startsAtMs;
        response.setHeader('Content-Type','application/json');
        response.end(JSON.stringify({run:{...fixture,serverNowMs:now,wallElapsedMs:elapsed,adjustedElapsedMs:elapsed}}));return;
      }
      const file = path.join(scratch, "dist", url.pathname === "/" ? "index.html" : url.pathname);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    for(const action of ['submit','hint','skip']){
      const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='racing');
      await page.evaluate(()=>window.testRaceSession.input('text','APPLE'));
      const before=await page.evaluate(()=>window.testRaceSession.getSnapshot());
      await context.setOffline(true);await page.evaluate(action=>window.testRaceSession[action](),action);
      await page.waitForFunction(()=>window.testRaceSession.getSnapshot().pending===null&&window.testRaceSession.getSnapshot().error!==null,{},{timeout:1500});
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().currentLetters.join('')),'APPLE');
      const sent=await page.evaluate(()=>window.commands.length);
      assert.equal(await page.locator('.race-actions button:disabled').count(),3);
      await page.evaluate(()=>{window.testRaceSession.submit();window.testRaceSession.hint();window.testRaceSession.skip();});
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>window.commands.length),sent);
      await context.setOffline(false);await page.locator('.race-error button').click();
      await page.waitForFunction(()=>window.testRaceSession.getSnapshot().pending===null&&window.testRaceSession.getSnapshot().error===null);
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().currentLetters.join('')),'APPLE');
      assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().requiresRunRefresh),false);
      const mutationType={submit:'game:submitRaceGuess',hint:'game:requestRaceHint',skip:'game:skipRaceRiddle'}[action];
      assert.equal(await page.evaluate(type=>window.commands.filter(command=>command.type===type).length,mutationType),1);
      const after=await page.evaluate(()=>window.testRaceSession.getSnapshot());
      assert.equal(after.run.currentRiddle.riddleId,before.run.currentRiddle.riddleId);
      assert.equal(after.run.totalPenaltyMs,before.run.totalPenaltyMs);
      assert.deepEqual(after.raceGuesses,before.raceGuesses);
      assert.equal(after.activeSlotIndex,before.activeSlotIndex);
      assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),2);
      assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
      await page.screenshot({path:path.join(output,'offline-'+action+'-'+viewport.width+'.png'),fullPage:true});
      console.log('Offline '+action+' delivery recovery passed at '+viewport.width+'px: immediate rollback, retained input, canonical read, no repeated mutation.');
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
