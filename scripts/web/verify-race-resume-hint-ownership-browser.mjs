import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify retained resume, terminal cleanup and failed-startup reset preserve newer-tab hints.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-resume-hint-ownership-"));
const output = path.resolve(root, "artifacts/race-resume-hint-ownership");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/fixtures/RetainedRaceHarness.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/web/play/race/testing/fakeRaceServices.ts"))};
const scenario=new URLSearchParams(location.search).get("case"),catalog=createFakeRaceServices();
const now=Date.now(),view={runId:'keyboard-run',role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'A clue',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[],serverNowMs:now,startsAtMs:now-1000};
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];
function reply(message,operation,payload){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,...payload}}}));}
function postToHost(message){
 window.commands.push(message);
 if(message.type==='game:listRaceCategories'){void catalog.listRaceCategories('en').then(data=>reply(message,'raceCategories',{ok:true,data}));return;}
 if(message.type!=='game:resumeRace')return;
 localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:'newer-tab-run'}));
 if(scenario==='failed'){reply(message,'raceResume',{ok:false,error:'RaceTo10.ERROR_GENERIC'});return;}
 reply(message,'raceResume',{ok:true,data:{run:scenario==='terminal'?{...view,status:'abandoned',currentRiddle:null}:view}});
}
createRoot(document.getElementById('root')).render(<RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if(process.env.RACE_UNSCOPED_HINT_BASELINE==='1' && id.endsWith('/play/race/logic/activeRaceStorage.ts')) {
      const original='(runId === undefined || savedRunId === runId)';
      assert(code.includes(original));
      return {code:code.replace(original,'true'),map:null};
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
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]) for(const scenario of ["resume","terminal","failed"]){
    {
      const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+scenario);
      await page.waitForFunction(()=>window.commands.some(command=>command.type==='game:resumeRace'));
      if(scenario==='resume'){
        await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='racing');
        assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.runId),'keyboard-run');
      }else{
        await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='categories');
        if(scenario==='failed'){
          await page.getByRole('alert').waitFor({state:'visible'});
          await page.getByRole('tab',{name:'Play',exact:true}).click();
          await page.locator('.race-category-grid button').first().waitFor({state:'visible'});
        }
        assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run),null);
      }
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:activeRaceRun'))),{ownerId:'owner-1',runId:'newer-tab-run'});
      assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
      assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:resumeRace').length),1);
      await page.screenshot({path:path.join(output,scenario+'-'+viewport.width+'.png'),fullPage:true});
      console.log('Retained resume hint ownership passed: '+scenario+' at '+viewport.width+'px; newer same-account pointer preserved.');
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
