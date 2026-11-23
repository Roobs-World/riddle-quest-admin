import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Supplementary component regression: this is not hosted Jest E2E evidence.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.resolve(process.env.LIVE_RACE_REPORT_DIR ?? path.join(root, "artifacts/live-result-balance"));
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-result-balance-"));
const source = `
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/web/styles.css"))};
import ${JSON.stringify(path.join(root, "src/web/styles.race-lobby.css"))};
import ${JSON.stringify(path.join(root, "src/web/styles.race-gameplay.css"))};
import {PlayHostApp} from ${JSON.stringify(path.join(root, "src/web/play/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root, "src/web/play/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root, "src/web/play/fakeServices.ts"))};
import {LiveRaceGame} from ${JSON.stringify(path.join(root, "src/web/play/race/LiveRaceGame.tsx"))};
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
localStorage.setItem('riddleQuest:onboarding:jest-guest','seen');
const base=createFakeHostServices({dailyCompleted:true});
let profile; base.auth.subscribe(snapshot=>{profile=snapshot.profile;});
window.profileReads=0;window.completedEvents=0;
window.addEventListener('riddle-quest:live-race-completed',()=>window.completedEvents++);
const mode=new URLSearchParams(location.search).get('case')??'fresh';
const services={...base,loadProfile:async uid=>{window.profileReads++;if(mode==='failed')throw new Error('fixture profile unavailable');if(mode==='delayed')await new Promise(resolve=>window.releaseProfile=resolve);return {...profile,coins:350};}};
const startsAtMs=Date.now()-10000;
const run={runId:'fixture-finish',role:'creator',status:'completed',serverNowMs:Date.now(),startsAtMs,categoryId:'science',locale:'en',rules:RACE_RULES,correctCount:10,wallElapsedMs:10000,totalPenaltyMs:0,adjustedElapsedMs:10000,events:[],currentRiddle:null,opponent:{displayName:'Idle rival',avatarUrl:null,adjustedFinishMs:300000,events:[]}};
const terminal={ticketId:'a'.repeat(64),phase:'result',serverNowMs:Date.now(),searchEndsAtMs:startsAtMs-1000,startsAtMs,player:{displayName:'Fixture player',avatarUrl:null,bot:false,correctCount:10},opponent:{displayName:'Idle rival',avatarUrl:null,bot:false,correctCount:0},run,result:'win',rewardCoins:50,newCoins:350};
const transport={join:async()=>terminal,update:async()=>terminal};
function Surface(props){const [started,setStarted]=React.useState(false);return started?<LiveRaceGame transport={transport} locale='en' categoryId='science' ownerId={props.ownerId} coins={props.coins} onCompleted={props.onLiveResult} onClose={()=>setStarted(false)}/>:<section role='dialog'><output data-testid='lobby-coins'>{props.coins}</output><button onClick={()=>setStarted(true)}>Fixture Start</button><button onClick={props.onClose}>Fixture Exit</button></section>;}
const session=createHostedPlaySession({hostServices:services,raceAvailable:true,initialRaceLobby:true});
createRoot(document.getElementById('root')).render(<React.StrictMode><PlayHostApp session={session} raceSurface={Surface} onPlayable={()=>window.playable=true}/></React.StrictMode>);
`;

await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
const report = [];
try {
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", define:{"import.meta.env.VITE_RACE_TO_10_ENABLED":"\"1\""}, build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const file = path.join(scratch, "dist", url.pathname === "/" ? "index.html" : url.pathname);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".svg") ? "image/svg+xml" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const viewport of [{width:390,height:844},{width:1280,height:900}]) for (const mode of ['fresh','failed','delayed']) {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/?case=${mode}`);
    await page.waitForFunction(()=>window.playable===true);
    await page.getByRole('button',{name:'Fixture Start',exact:true}).waitFor();
    await page.getByTestId('lobby-coins').filter({hasText:/^300$/}).waitFor();
    await page.getByRole('button',{name:'Fixture Start',exact:true}).click();
    await page.locator('.live-race-victory').waitFor();
    await page.locator('.race-result .race-primary').click();
    await page.getByRole('button',{name:'Fixture Start',exact:true}).waitFor();
    await page.waitForTimeout(100);
    const balance=await page.getByTestId('lobby-coins').innerText();
    const diagnostics=await page.evaluate(()=>({reads:window.profileReads,events:window.completedEvents}));
    console.log(JSON.stringify({mode,viewport,balance,...diagnostics}));
    assert.equal(balance,'350','Closing a confirmed win must preserve its authoritative balance');
    if(mode==='delayed'){await page.evaluate(()=>window.releaseProfile());}
    await page.getByRole('button',{name:'Fixture Exit',exact:true}).click();
    await page.locator('.coin-pill').waitFor();
    assert.match(await page.locator('.coin-pill').innerText(),/350/);
    await page.screenshot({path:path.join(output,`return-${mode}-${viewport.width}.png`),fullPage:true});
    report.push({mode,viewport,pass:true});await context.close();
  }

  await writeFile(path.join(output, "report.json"), JSON.stringify({scope: "Supplementary real-component harness; not hosted Jest E2E", report}, null, 2));
  console.log(`PASS: ${report.length} live-result balance return cases`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
