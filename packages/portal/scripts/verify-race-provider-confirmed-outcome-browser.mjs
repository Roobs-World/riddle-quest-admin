import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify optional provider catch-up records only a privately confirmed outcome.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-provider-confirmed-outcome-"));
const output = path.resolve(root, "../../artifacts/race-provider-confirmed-outcome");
await mkdir(output, {recursive: true});
const source = `
import React,{useState,useEffect} from 'react';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,"src/play/race/RaceTo10Game.tsx"))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,"src/play/race/logic/racePresentation.ts"))};
const now=Date.now(),view={runId:'unconfirmed-run',role:'challenger',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,
 challengeId:'recorded-challenge',correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,
 currentRiddle:{riddleId:'question-0',text:'A clue',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[]},
 events:[],serverNowMs:now,startsAtMs:now-1000,opponent:{displayName:'Nova',adjustedFinishMs:1300,events:[]}};
const canonical=projectRaceOutcome(view,1301);
localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:view.runId}));
window.commands=[];window.writes=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:resumeRace')reply(message,'raceResume',{run:view});}
window.confirm=()=>reply(window.commands.find(command=>command.type==='game:getRaceOutcome'),'raceOutcome',canonical);
const adapter={record:async(runId)=>{window.writes.push(runId);return {};},list:async()=>({locale:'en',standings:[]})};
function App(){const [enabled,setEnabled]=useState(false);window.enableProvider=()=>setEnabled(true);
 useEffect(()=>{window.providerInstalled=enabled;},[enabled]);
 return <RaceTo10Game locale="en" coins={100} ownerId="owner-1" postToHost={postToHost} onClose={()=>{}} tournaments={enabled?adapter:undefined}/>;}
createRoot(document.getElementById('root')).render(<App/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if (process.env.RACE_PROVIDER_OUTCOME_BASELINE === "1" && id.endsWith("/play/race/RaceTo10Game.tsx"))
      return readFile(path.join(output,"prior-race-game.tsx"),"utf8").then(code=>({code,map:null}));
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
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>globalThis.testRaceSession?.getSnapshot().stage==='result'&&globalThis.testRaceSession.getSnapshot().pending==='raceOutcome');
    assert.equal(await page.evaluate(()=>window.writes.length),0);
    await page.evaluate(()=>window.enableProvider());await page.waitForFunction(()=>window.providerInstalled);
    assert.equal(await page.evaluate(()=>window.writes.length),0,'Provider must not record a provisional result during adapter catch-up');
    await page.evaluate(()=>window.confirm());await page.waitForFunction(()=>window.writes.length===1);
    assert.deepEqual(await page.evaluate(()=>window.writes),['unconfirmed-run']);
    assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>command.type==='game:getRaceOutcome').length),1);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:abandonRace','game:publishRace'].includes(command.type)).length),0);
    await page.screenshot({path:path.join(output,'confirmed-'+viewport.width+'.png'),fullPage:true});
    console.log('Provider catch-up passed at '+viewport.width+'px: no provisional write; exactly one record after canonical outcome; no gameplay mutation.');
    await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
