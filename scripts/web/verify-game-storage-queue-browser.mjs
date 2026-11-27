import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.STORAGE_REACT_MODE??'development',baseline=process.env.STORAGE_BASELINE_DIR;
const output=path.resolve(process.env.STORAGE_REPORT_DIR??path.join(root,'builds/test-evidence/game-storage-queue-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/game-storage-'));
const source=`
import {PlayerProjectionPersistence} from ${JSON.stringify(path.join(root,"src/accounts/browser/playerState/PlayerProjectionPersistence.ts"))};
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,"src/app/components/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,"src/platform/bridge/browser/localBridge.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={saves:[],guesses:0,completions:0,errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();const services={...service,submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};
window.storageProbe={writes:[],flushes:0,acknowledged:0,failures:[],clears:0};let release;
const storage={readPreferences:async()=>({}),writePreferences:async()=>{},readPlayerData:async()=>null,
writePlayerData:async value=>{window.storageProbe.writes.push(structuredClone(value));if(window.storageProbe.writes.length===1)await new Promise(r=>release=r);},
flush:async()=>{window.storageProbe.flushes++;},clear:async()=>{window.storageProbe.clears++;window.storageProbe.writes=[];}};
const owner=new PlayerProjectionPersistence(storage,null);
window.releaseStorage=()=>release?.();window.flushStorage=()=>owner.flush();window.closeStorage=()=>owner.closeAndFlush();window.clearStorage=()=>owner.clear();window.retiredUpdate=()=>owner.update({activeGame:null}).then(()=>false,()=>true);
window.writeUpdate=update=>{window.probe.saves.push(update);void owner.update(update).then(()=>window.storageProbe.acknowledged++,error=>window.storageProbe.failures.push(String(error)));};
window.mergeProfile=()=>window.writeUpdate({profile:{username:'Ada',coins:777,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});
const hosted=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,onPlayerDataChange:window.writeUpdate});
window.pause=value=>dispatchLocalBridge(HOST_TO_GAME_EVENT,{type:value?'host:pause':'host:resume',payload:{}});
function App(){const [mounted,setMounted]=React.useState(true);window.retire=()=>setMounted(false);return mounted?<PlayHostApp session={hosted}/>:<p data-testid='retired'>Retired fixture</p>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
window.background=()=>{const previous=Object.getOwnPropertyDescriptor(document,'visibilityState');Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});try{document.dispatchEvent(new Event('visibilitychange'));}finally{if(previous)Object.defineProperty(document,'visibilityState',previous);else delete document.visibilityState;}};
window.latestCheckpoint=()=>window.probe.saves.filter(x=>'activeGame' in x).at(-1)?.activeGame;
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-storage-queue',async load(id){if(baseline&&id.endsWith('/PlayerProjectionPersistence.ts'))return readFile(path.join(baseline,'PlayerProjectionPersistence.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.STORAGE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});

 for(const width of [390,1280])for(const scenario of ['latest','deletion']) {
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.waitForFunction(()=>window.storageProbe.writes.length===1);await waitForAnswerInputReady(page);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');
  for(let i=0;i<40;i++){await page.keyboard.press('Backspace');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIA');await page.keyboard.type('n');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');}
  await page.evaluate(()=>window.mergeProfile());
  metric('answer remains responsive while provider write is held',await page.evaluate(()=>window.draft()),'PIAN');
  metric('84 physical answer edits reach checkpoint adapter',await page.evaluate(()=>window.probe.saves.filter(x=>'activeGame' in x).length),84);
  metric('held provider write stays the sole in-flight write',await page.evaluate(()=>window.storageProbe.writes.length),1);
  metric('no checkpoint is acknowledged while provider is held',await page.evaluate(()=>window.storageProbe.acknowledged),0);
  metric('in-flight snapshot cannot acquire later answer fields',await page.evaluate(()=>window.storageProbe.writes[0].activeGame??null),null);
  if(scenario==='deletion') {
   await page.evaluate(()=>{window.deletionDrain=window.closeStorage();});
   metric('deletion prevents new checkpoint acceptance',await page.evaluate(()=>window.retiredUpdate()),true);
   await page.evaluate(async()=>{window.releaseStorage();await window.deletionDrain;await window.clearStorage();});
   metric('deletion clears storage after drain',await page.evaluate(()=>window.storageProbe.clears),1);
   metric('deletion does not resurrect old player data',await page.evaluate(()=>window.storageProbe.writes),[]);
   metric('deletion leaves no save failure',await page.evaluate(()=>window.storageProbe.failures),[]);
  } else {
   await page.evaluate(async()=>{window.releaseStorage();await window.flushStorage();});
   metric('84 waiting edits and profile update need one newest write',await page.evaluate(()=>window.storageProbe.writes.length),2);
   metric('newest stored draft is PIAN',await page.evaluate(()=>window.storageProbe.writes.at(-1).activeGame.currentLetters.join('')),'PIAN');
   metric('newest profile merges with the draft',await page.evaluate(()=>window.storageProbe.writes.at(-1).profile.coins),777);
   metric('all accepted checkpoints acknowledge newest durable snapshot',await page.evaluate(()=>window.storageProbe.acknowledged===window.probe.saves.length),true);
   await page.keyboard.type('o');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIANO');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1&&window.latestCheckpoint()===null);
   await page.evaluate(()=>window.flushStorage());
   metric('later ordinary submission reaches authority once',await page.evaluate(()=>window.probe.guesses),1);
   metric('completion clear reaches durable storage',await page.evaluate(()=>window.storageProbe.writes.at(-1).activeGame),null);
   metric('normal gameplay has no save failure',await page.evaluate(()=>window.storageProbe.failures),[]);
  }
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline)await page.screenshot({path:path.join(output,`${scenario}-${width}.png`)});await context.close();

 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
