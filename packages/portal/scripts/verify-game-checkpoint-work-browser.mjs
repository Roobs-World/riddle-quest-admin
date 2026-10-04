import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.CHECKPOINT_REACT_MODE??'development',baseline=process.env.CHECKPOINT_BASELINE_DIR;
const output=path.resolve(process.env.CHECKPOINT_REPORT_DIR??path.join(root,'../../artifacts/game-checkpoint-work-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/game-checkpoint-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.checkpointWork={updates:0,projections:0,fingerprints:0};window.probe={saves:[],guesses:0,completions:0,errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();const services={...service,submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};
const hosted=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,onPlayerDataChange:update=>window.probe.saves.push(update)});
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
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'observe-checkpoint-work',enforce:'pre',async load(id){
  if(!id.endsWith('/GameSessionCheckpoints.ts'))return;
  let code=await readFile(baseline?path.join(baseline,'GameSessionCheckpoints.before.txt'):id,'utf8');
  code=code.replace('if (state.pendingGuessState)', 'window.checkpointWork.projections++;if (state.pendingGuessState)');
  code=code.replace('if (state.riddle && this.observedRiddle', 'window.checkpointWork.updates++;if (state.riddle && this.observedRiddle');
  code=code.replace('const signature = JSON.stringify', 'window.checkpointWork.fingerprints++;const signature = JSON.stringify');return code;
 }}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.CHECKPOINT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const width of [390,1280]) {
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');
  metric('physical typing durably checkpoints latest draft',await page.evaluate(()=>window.latestCheckpoint().currentLetters.join('')),'PIAN');
  const before=await page.evaluate(()=>({...window.checkpointWork,saves:window.probe.saves.length}));
  for(let i=0;i<10;i++){await page.evaluate(()=>window.pause(true));await page.waitForTimeout(30);await page.evaluate(()=>window.pause(false));await page.waitForTimeout(30);}
  for(let i=0;i<5;i++){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});}
  const after=await page.evaluate(()=>({...window.checkpointWork,saves:window.probe.saves.length}));
  metric('presentation changes reach the actual checkpoint owner',after.updates-before.updates>=30,true);
  metric('presentation changes create no saved-game copies',after.projections-before.projections,0);
  metric('presentation changes serialize no fingerprint',after.fingerprints-before.fingerprints,0);
  metric('presentation changes do not write adapter',after.saves-before.saves,0);
  metric('presentation changes preserve draft',await page.evaluate(()=>window.draft()),'PIAN');
  await page.evaluate(()=>window.background());
  metric('background checkpoint creates fresh projection',await page.evaluate(()=>window.checkpointWork.projections),after.projections+1);
  metric('background checkpoint writes adapter',await page.evaluate(()=>window.probe.saves.length),after.saves+1);
  await page.evaluate(()=>window.latestCheckpoint().currentLetters[0]='X');await page.evaluate(()=>window.background());
  metric('background checkpoint isolates adapter mutations',await page.evaluate(()=>window.latestCheckpoint().currentLetters.join('')),'PIAN');
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(75);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Backspace');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIA');
  metric('ordinary deletion remains durable',await page.evaluate(()=>window.latestCheckpoint().currentLetters.join('')),'PIA');
  await page.keyboard.type('no');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIANO');
  metric('next edits remain durable',await page.evaluate(()=>window.latestCheckpoint().currentLetters.join('')),'PIANO');
  await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1&&window.latestCheckpoint()===null);
  metric('ordinary submit reaches authority once',await page.evaluate(()=>window.probe.guesses),1);
  metric('acknowledged completion clears draft',await page.evaluate(()=>window.latestCheckpoint()),null);
  metric('pending completion was checkpointed before clear',await page.evaluate(()=>window.probe.saves.some(x=>x.activeGame?.pendingOutcome?.kind==='win')),true);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline)await page.screenshot({path:path.join(output,`solo-${width}.png`)});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
