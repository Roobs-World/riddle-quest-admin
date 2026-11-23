import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.SAVE_RECOVERY_REACT_MODE??'development',baseline=process.env.SAVE_RECOVERY_BASELINE_DIR;
const output=path.resolve(process.env.SAVE_RECOVERY_REPORT_DIR??path.join(root,'../../builds/test-evidence/game-save-recovery-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/save-recovery-'));
const source=`
import {useJestPlayerStateWrites} from ${JSON.stringify(path.join(root,'../../platforms/web/jest/src/useJestPlayerStateWrites.ts'))};
import {commitJestStartupSession} from ${JSON.stringify(path.join(root,'../../platforms/web/jest/src/commitJestStartupSession.ts'))};
import {JestSdkPlatform} from ${JSON.stringify(path.join(root,'../../platforms/web/jest/src/JestSdkPlatform.ts'))};
import {createNotificationOperationGate} from ${JSON.stringify(path.join(root,'../../platforms/web/jest/src/notifications/operationGate.ts'))};
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {applyPlayerPreferences,setPlayerHighContrast,setPlayerReducedMotion} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={saves:[],guesses:0,completions:0,hostedIdentities:[],errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();let freshProfile=null;const services={...service,auth:{subscribe:listener=>service.auth.subscribe(snapshot=>{const user=snapshot.user?{...snapshot.user,uid:player.playerId==='jest-player'?snapshot.user.uid:'firebase-'+player.playerId}:null;window.probe.hostedIdentities.push({playerId:player.playerId,uid:user?.uid??null});listener({...snapshot,user,...(freshProfile?{profile:freshProfile}:{})});})},loadProfile:async()=>freshProfile??await service.loadProfile(),submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};

window.storageProbe={writes:[],preferenceWrites:[],flushes:0,failures:[],initializations:0,failDraft:0,failPreferences:0,failClear:0};let release,released=false,lastOperation,releaseNext;const heldFlush=new Promise(r=>release=r);let holdNext=false;
let player={playerId:'jest-player',registered:new URL(location.href).searchParams.has('registered')};const stores=new Map(),durable=new Map();
const getStore=()=>{if(!stores.has(player.playerId))stores.set(player.playerId,{});return stores.get(player.playerId);};
window.durableData=()=>structuredClone(durable.get(player.playerId)??{});window.seedSdkPreference=(key,value)=>{getStore()[key]=value;durable.set(player.playerId,{...(durable.get(player.playerId)??{}),[key]:value});};window.holdNextDraft=()=>holdNext=true;window.releaseNextDraft=()=>releaseNext?.();
const sdk={init:async()=>{window.storageProbe.initializations++;},getPlayer:()=>player,data:{
set:(key,value)=>{const kind=typeof key==='string'?'state':'preferences',data=structuredClone(typeof key==='string'?value:key);if(kind==='state')getStore()[key]=data;else Object.assign(getStore(),data);lastOperation={kind,playerId:player.playerId,value:data,ack:false};window.storageProbe[kind==='state'?'writes':'preferenceWrites'].push(lastOperation);},
getAll:()=>structuredClone(getStore()),delete:key=>delete getStore()[key],flush:async()=>{window.storageProbe.flushes++;const entry=lastOperation;if(!released)await heldFlush;const draft=entry.kind==='state'&&entry.value.activeGame?.currentLetters.join('')==='PIAN';const clear=entry.kind==='state'&&entry.value.activeGame===null;
if((draft&&window.storageProbe.failDraft>0)||(clear&&window.storageProbe.failClear>0)||(entry.kind==='preferences'&&entry.value.highContrast===true&&window.storageProbe.failPreferences>0)){if(draft)window.storageProbe.failDraft--;else if(clear)window.storageProbe.failClear--;else window.storageProbe.failPreferences--;entry.failed=true;throw new Error('injected SDK flush failure');}
if(holdNext&&entry.kind==='state'&&entry.value.activeGame){holdNext=false;await new Promise(r=>releaseNext=r);}const prior=durable.get(entry.playerId)??{};durable.set(entry.playerId,entry.kind==='state'?{...prior,riddleQuestPlayerState:entry.value}:{...prior,...entry.value});entry.ack=true;}}};
const platform=new JestSdkPlatform(sdk),gate=createNotificationOperationGate({crossContextLock:null,deletionEpoch:()=>null,deletionPending:()=>false,requireCrossContextLock:false});
window.releaseStorage=()=>{released=true;release();};
const baseSession=()=>({player:{...player},profile:null,entryIntent:{},preferences:{locale:'en',muted:true,reducedMotion:true,onboardingComplete:true},playerData:null,firebaseAuthenticated:true});
function App(){const [current,setCurrent]=React.useState(baseSession),[epoch,setEpoch]=React.useState(0),[ready,setReady]=React.useState(false);const sessionRef=React.useRef(current);window.sessionRef=sessionRef;
const setSession=change=>{const next=typeof change==='function'?change(sessionRef.current):change;sessionRef.current=next;setCurrent(next);};
const writes=useJestPlayerStateWrites({platform,gate,sessionRef,setSession:React.useCallback(setSession,[]),setEngagementProgress:React.useCallback(()=>{},[]),trackFailure:React.useCallback(name=>window.storageProbe.failures.push(name),[])});window.writes=writes;
React.useEffect(()=>{let active=true;void platform.init().then(()=>{if(!active)return;writes.enable(null,player.playerId);writes.savePlayerData({profile:{username:"Initial authority",coins:300,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});setReady(true);});return()=>{active=false;writes.disable();};},[writes]);
window.writeUpdate=update=>{window.probe.saves.push(update);writes.savePlayerData(update);};
window.changePreferences=()=>{setPlayerHighContrast(true);setPlayerReducedMotion(false);};
window.mergeProfile=()=>window.writeUpdate({profile:{username:'Ada',coins:777,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});
window.restart=async other=>{writes.disable();player={playerId:other?'other-player':'jest-player',registered:true};const incoming=await platform.readPlayerData();const session={...baseSession(),playerData:{...incoming,schemaVersion:1,updatedAt:Date.now(),profile:{username:'Fresh authority',coins:80,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}}};
freshProfile=session.playerData.profile;await commitJestStartupSession({gate,isActive:()=>true,session,enablePlayerStateWrites:writes.enable,setEngagementProgress:()=>{},setSession:next=>{setSession(next);window.committed=next;setEpoch(x=>x+1);},trackFunnel:()=>{}});};
const hosted=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:current.playerData,onPlayerDataChange:window.writeUpdate});
return <div data-host-epoch={epoch}>{ready?<PlayHostApp key={epoch} session={hosted}/>:<p>Initializing fixture SDK</p>}</div>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
window.latestCheckpoint=()=>window.probe.saves.filter(x=>'activeGame' in x).at(-1)?.activeGame;
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'observe-jest-state-queue',async load(id){
if(!['/useJestPlayerStateWrites.ts'].some(name=>id.endsWith(name)))return;
let code=await readFile(baseline?path.join(baseline,path.basename(id).replace('.ts','.before.txt')):id,'utf8');
if(id.endsWith('/useJestPlayerStateWrites.ts'))code=code.replace('return useMemo(', 'window.awaitQueue=()=>Promise.all([playerDataWriteQueueRef.current.catch(()=>undefined),preferenceWriteQueueRef.current.catch(()=>undefined)]);return useMemo(');return code;}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.SAVE_RECOVERY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});


 for(const width of [390,1280])for(const registered of [false,true])for(const scenario of ['automatic','online','visibility','preferences','disable','other-player','clear','exhausted','healthy-inflight']) {
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,registered,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+(registered?'?registered=1':''));await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.waitForFunction(()=>window.storageProbe.writes.length===1);await waitForAnswerInputReady(page);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');
  metric('native input remains playable',await page.evaluate(()=>window.draft()),'PIAN');
  metric('SDK initialized',await page.evaluate(()=>window.storageProbe.initializations>0),true);
  await page.clock.install();
  if(scenario==='online')await page.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,value:false}));
  if(scenario==='visibility')await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.evaluate(scenario=>{if(!['preferences','clear'].includes(scenario))window.storageProbe.failDraft=scenario==='exhausted'?100:1;window.releaseStorage();},scenario);await page.evaluate(()=>window.awaitQueue());
  const draftWrites=()=>page.evaluate(()=>window.storageProbe.writes.filter(x=>x.value.activeGame?.currentLetters.join('')==='PIAN').length);
  if(['automatic','online','visibility','exhausted','disable','other-player','healthy-inflight'].includes(scenario)) {
   metric('failed draft remains unacknowledged',await page.evaluate(()=>window.storageProbe.writes.find(x=>x.failed)?.ack),false);
   metric('one initial failure report',await page.evaluate(()=>window.storageProbe.failures.filter(x=>x==='player_data_save_failed').length),1);
  }
  if(scenario==='automatic') {
   await page.clock.runFor(1001);await page.evaluate(()=>window.awaitQueue());
   metric('one automatic retry without another edit',await draftWrites(),2);
   metric('retry makes newest draft durable',await page.evaluate(()=>window.durableData().riddleQuestPlayerState?.activeGame?.currentLetters.join('')??''),'PIAN');
  } else if(['online','visibility'].includes(scenario)) {
   await page.clock.runFor(20000);metric('unavailable browser does not poll saves',await draftWrites(),1);
   await page.evaluate(scenario=>{if(scenario==='online'){Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));}else{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));}},scenario);
   await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
   metric('real recovery signal retries pending draft',await draftWrites(),2);
   metric('resume makes draft durable',await page.evaluate(()=>window.durableData().riddleQuestPlayerState?.activeGame?.currentLetters.join('')??''),'PIAN');
  } else if(scenario==='preferences') {
   await page.evaluate(()=>{window.seedSdkPreference("locale","fr");window.storageProbe.failPreferences=2;window.changePreferences();});await page.evaluate(()=>window.awaitQueue());
   metric('two rejected preference flushes',await page.evaluate(()=>window.storageProbe.failures.filter(x=>x==='preference_save_failed').length),2);
   await page.clock.runFor(1001);await page.evaluate(()=>window.awaitQueue());
   metric('unrelated SDK preference metadata survives recovery',await page.evaluate(()=>window.durableData().locale),'fr');
   metric('merged preference fields retry together',await page.evaluate(()=>({highContrast:window.durableData().highContrast??false,reducedMotion:window.durableData().reducedMotion??true})),{highContrast:true,reducedMotion:false});
  } else if(scenario==='disable') {
   await page.evaluate(()=>window.writes.disable());await page.clock.runFor(60000);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.clock.runFor(20);
   metric('disabled session never retries',await draftWrites(),1);
  } else if(scenario==='other-player') {
   await page.evaluate(()=>window.restart(true));await page.locator('[data-host-epoch="1"]').waitFor();await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();await page.clock.runFor(7001);await page.evaluate(()=>window.awaitQueue());
   metric('hosted identity follows the replacement target player',await page.evaluate(()=>window.probe.hostedIdentities.at(-1)),{playerId:'other-player',uid:'firebase-other-player'});
   metric('replacement player never imports old draft',await page.evaluate(()=>window.storageProbe.writes.filter(x=>x.playerId==='other-player').every(x=>!x.value.activeGame)),true);
   metric('replacement retains authority profile',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.profile.coins),80);
  } else if(scenario==='clear') {
   metric('prior draft is durable before completion',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIAN');
   await page.evaluate(()=>window.storageProbe.failClear=100);await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1&&window.latestCheckpoint()===null);await page.evaluate(()=>window.awaitQueue());
   await page.clock.runFor(8001);await page.evaluate(()=>window.awaitQueue());
   metric('failed completion clear remains unacknowledged',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame!=null),true);
   await page.evaluate(()=>{window.storageProbe.failClear=0;window.dispatchEvent(new Event('online'));});await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
   metric('completion clear retries without replaying authority',await page.evaluate(()=>({clear:window.durableData().riddleQuestPlayerState.activeGame,guesses:window.probe.guesses,completions:window.probe.completions})),{clear:null,guesses:1,completions:1});
  } else if(scenario==='exhausted') {
   await page.clock.runFor(7001);await page.evaluate(()=>window.awaitQueue());metric('three automatic retries bound persistent failure',await draftWrites(),4);
   await page.clock.runFor(60000);metric('exhausted retries leave no ongoing polling',await draftWrites(),4);
   await page.evaluate(()=>{window.storageProbe.failDraft=0;window.dispatchEvent(new Event('online'));});await page.clock.runFor(20);await page.evaluate(()=>window.awaitQueue());
   metric('reconnection can recover after automatic budget expires',await page.evaluate(()=>window.durableData().riddleQuestPlayerState?.activeGame?.currentLetters.join('')??''),'PIAN');
  } else if(scenario==='healthy-inflight') {
   await page.evaluate(()=>window.holdNextDraft());await page.keyboard.type('o');await page.waitForFunction(()=>window.storageProbe.writes.some(x=>x.value.activeGame?.currentLetters.join('')==='PIANO'));
   await page.clock.runFor(1001);metric('retry waits behind a healthy entered save',await page.evaluate(()=>window.storageProbe.writes.filter(x=>x.value.activeGame).length),2);
   await page.evaluate(()=>window.releaseNextDraft());await page.evaluate(()=>window.awaitQueue());await page.clock.runFor(60000);
   metric('healthy acknowledgement cancels redundant retries',await page.evaluate(()=>window.storageProbe.writes.filter(x=>x.value.activeGame).length),2);
   metric('healthy newest answer reaches durable SDK data',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIANO');
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline)await page.screenshot({path:path.join(output,`${scenario}-${registered?'registered':'guest'}-${width}.png`)});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
