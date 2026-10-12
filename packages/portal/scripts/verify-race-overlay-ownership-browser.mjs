import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

// Verify multiplayer owns its dialog and restores pending guidance or achievements on close.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-overlay-ownership-"));
const output = path.resolve(root, "../../artifacts/race-overlay-ownership");
await mkdir(output, {recursive: true});
const source = `
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
import {RACE_RULES} from '@qwordly/core/race';
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,'src/play/race/logic/racePresentation.ts'))};
import {RetainedRaceHarness} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {GameFrameApp} from ${JSON.stringify(path.join(root,'src/play/GameFrameApp.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
const mode=new URL(location.href).searchParams.get('mode'),owner='overlay-owner';
applyPlayerPreferences({locale:'en',onboardingComplete:mode==='reward',muted:true,reducedMotion:true});
if(mode==='reward'){sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');}
const profile={username:'Player',coins:25,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:0};
const now=Date.now(),run={runId:'result-run',role:'creator',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:10,wallElapsedMs:10000,totalPenaltyMs:0,adjustedElapsedMs:10000,currentRiddle:null,serverNowMs:now,startsAtMs:now-10000,events:Array.from({length:10},(_,sequence)=>({sequence,type:'correct',riddlePosition:sequence,wallElapsedMs:(sequence+1)*1000,penaltyAddedMs:0,totalPenaltyMs:0,adjustedElapsedMs:(sequence+1)*1000,correctCount:sequence+1}))};
const outcome={...projectRaceOutcome(run),newlyUnlockedAchievementIds:['race_first_win'],achievementCoinsAwarded:0,newCoins:25};
if(mode==='reward')localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:owner,runId:run.runId}));
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
let initialized=false;window.commands=[];
window.addEventListener('riddle-quest:game-to-host',event=>{const message=event.detail;window.commands.push(message);
 if(message.type==='game:ready'&&!initialized){initialized=true;setTimeout(()=>{host({type:'host:init',payload:{protocolVersion:1,sessionId:'overlay-session',locale:'en',gameMode:'classic',user:{uid:owner,isAnonymous:false},profile,products:[]}});
 host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'solo-fixture',text:'A musical instrument',answerLength:5,evaluation:{answer:'piano',locale:'en'},sessionToken:'overlay-fixture-token-00000000001',gameMode:'classic',index:0,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}}});},50);}
 if(message.type==='game:resumeRace')setTimeout(()=>host({type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceResume',ok:true,data:{run}}}),250);
 if(message.type==='game:getRaceOutcome')host({type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceOutcome',ok:true,data:outcome}});
 if(message.type==='game:getRaceEntry')host({type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceEntry',ok:true,data:{status:'ready',serverNowMs:Date.now(),challenge:{challengeId:'challenge-1',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:Date.now()+60000}}}});
});
createRoot(document.getElementById('root')).render(<GameFrameApp raceSurface={RetainedRaceHarness} localBridge raceFeatureEnabled raceOwnerId={owner} initialRaceChallengeId={mode==='onboarding'?'challenge-1':undefined} initialRaceLobby={mode==='reward'}/>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server;
try {
  await build({plugins: [{name:"expose-injected-race-session", enforce:"pre", transform(code, id) {
    if (process.env.RACE_OVERLAY_BASELINE === "1" && id.endsWith('/play/GameFrameApp.tsx'))
      return readFile(path.join(output,'prior-game-frame.tsx'),'utf8').then(code=>({code:code.replace('const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);','const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession); window.frameState=state;'),map:null}));
    if (process.env.RACE_OVERLAY_BASELINE === "1" && id.endsWith('/play/guidance/GuidanceOverlay.tsx'))
      return readFile(path.join(output,'prior-guidance.tsx'),'utf8').then(code=>({code:code.replace(/(const guidanceActive =[^;]+;)/,'$1 window.guidancePending=onboardingStep!==null;'),map:null}));
    if(id.endsWith('/play/GameFrameApp.tsx'))return {code:code.replace('const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession);','const [state, dispatch] = useReducer(gameSessionReducer, undefined, createInitialGameSession); window.frameState=state;'),map:null};
    if(id.endsWith('/play/guidance/GuidanceOverlay.tsx'))return {code:code.replace(/(const guidanceActive =[^;]+;)/,'$1 window.guidancePending=onboardingStep!==null;'),map:null};
    if(id.endsWith('/play/SolarSystem.tsx'))return {code:'export function SolarSystem(){return null;}',map:null};
    return null;
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
  for(const mode of process.env.RACE_OVERLAY_MODE?[process.env.RACE_OVERLAY_MODE]:['onboarding','reward'])for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode);
    await page.waitForFunction(()=>window.frameState?.riddle&&document.querySelector('.race-screen'));
    if(mode==='onboarding')await page.waitForFunction(()=>window.guidancePending);
    else {await page.waitForFunction(()=>window.frameState.modal==='reward');await page.locator('.race-result').waitFor({state:'visible'});}
    assert.equal(await page.getByRole('dialog').count(),1,'Multiplayer must be the only presented dialog');
    assert.equal(await page.locator('.guidance-backdrop').count(),0,'Onboarding must wait behind multiplayer');
    assert.equal(await page.locator('.game-modal').count(),0,'Reward fanfare must wait behind multiplayer');
    await page.locator('.race-close').focus();await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.race-screen')),true);
    await page.locator('.race-close').click();await page.locator('.race-screen').waitFor({state:'detached'});
    if(mode==='onboarding')await page.locator('.onboarding-card').waitFor({state:'visible'});
    else await page.locator('.game-modal .achievement-unlock').waitFor({state:'visible'});
    assert.equal(await page.getByRole('dialog').count(),1,'Deferred overlay must resume alone after multiplayer closes');
    await page.waitForFunction(mode=>!!document.activeElement?.closest(mode==='onboarding'?'.onboarding-card':'.game-modal'),mode);
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(mode=>!!document.activeElement?.closest(mode==='onboarding'?'.onboarding-card':'.game-modal'),mode),true);
    assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>window.commands.filter(command=>['game:startRace','game:submitRaceGuess','game:abandonRace'].includes(command.type)).length),0);
    await page.screenshot({path:path.join(output,mode+'-'+viewport.width+'.png'),fullPage:true});
    console.log('Overlay ownership passed: '+mode+' at '+viewport.width+'px; one modal, race focus, deferred presentation restored.');await context.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive:true,force:true});
}
