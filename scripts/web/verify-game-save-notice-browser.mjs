import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.SAVE_NOTICE_REACT_MODE??'development',baseline=process.env.SAVE_NOTICE_BASELINE_DIR;
const output=path.resolve(process.env.SAVE_NOTICE_REPORT_DIR??path.join(root,'builds/test-evidence/game-save-notice-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/save-notice-'));
const source=`
import {useJestPlayerStateWrites} from ${JSON.stringify(path.join(root,'platforms/web/jest/src/useJestPlayerStateWrites.ts'))};
import {commitJestStartupSession} from ${JSON.stringify(path.join(root,'platforms/web/jest/src/commitJestStartupSession.ts'))};
import {JestSdkPlatform} from ${JSON.stringify(path.join(root,'platforms/web/jest/src/JestSdkPlatform.ts'))};
import {createNotificationOperationGate} from ${JSON.stringify(path.join(root,'platforms/web/jest/src/notifications/operationGate.ts'))};
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayerSaveRecoveryLayout} from ${JSON.stringify(path.join(root,"src/accounts/components/recovery/PlayerSaveRecoveryLayout.tsx"))};
import {setLocaleAndWait,tr} from ${JSON.stringify(path.join(root,"src/localization/browser/i18n.ts"))};
import {PlayHostApp} from ${JSON.stringify(path.join(root,"src/app/components/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
import {applyPlayerPreferences,setPlayerHighContrast,setPlayerReducedMotion} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,"src/platform/bridge/browser/localBridge.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;const fixtureLocale=new URL(location.href).searchParams.get('locale')??'en';window.copy=()=>({message:tr('GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE'),retry:tr('CommonButtons.RETRY')});
window.probe={saves:[],guesses:0,completions:0,hostedIdentities:[],errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:fixtureLocale,muted:true,reducedMotion:true,onboardingComplete:true});
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
const baseSession=()=>({player:{...player},profile:null,entryIntent:{},preferences:{locale:fixtureLocale,muted:true,reducedMotion:true,onboardingComplete:true},playerData:null,firebaseAuthenticated:true});
function App(){const [current,setCurrent]=React.useState(baseSession),[epoch,setEpoch]=React.useState(0),[ready,setReady]=React.useState(false);const sessionRef=React.useRef(current);window.sessionRef=sessionRef;
const setSession=change=>{const next=typeof change==='function'?change(sessionRef.current):change;sessionRef.current=next;setCurrent(next);};
const writes=useJestPlayerStateWrites({platform,gate,sessionRef,setSession:React.useCallback(setSession,[]),setEngagementProgress:React.useCallback(()=>{},[]),trackFailure:React.useCallback(name=>window.storageProbe.failures.push(name),[])});window.writes=writes;
React.useEffect(()=>{let active=true;void platform.init().then(async()=>{await setLocaleAndWait(fixtureLocale);if(!active)return;writes.enable(null,player.playerId);writes.savePlayerData({profile:{username:"Initial authority",coins:300,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});setReady(true);});return()=>{active=false;writes.disable();};},[writes]);
window.writeUpdate=React.useCallback(update=>{window.probe.saves.push(update);writes.savePlayerData(update);},[writes]);
window.changePreferences=()=>{setPlayerHighContrast(true);setPlayerReducedMotion(false);};
window.mergeProfile=()=>window.writeUpdate({profile:{username:'Ada',coins:777,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});
window.restart=async other=>{writes.disable();player={playerId:other?'other-player':'jest-player',registered:true};const incoming=await platform.readPlayerData();const session={...baseSession(),playerData:{...incoming,schemaVersion:1,updatedAt:Date.now(),profile:{username:'Fresh authority',coins:80,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}}};
freshProfile=session.playerData.profile;await commitJestStartupSession({gate,isActive:()=>true,session,enablePlayerStateWrites:writes.enable,setEngagementProgress:()=>{},setSession:next=>{setSession(next);window.committed=next;setEpoch(x=>x+1);},trackFunnel:()=>{}});};
const hosted=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:current.playerData,onPlayerDataChange:window.writeUpdate});
return <div data-host-epoch={epoch} style={{height:"100%"}}>{ready?<PlayerSaveRecoveryLayout recovery={writes.recovery}><PlayHostApp key={epoch} session={hosted}/></PlayerSaveRecoveryLayout>:<p>Initializing fixture SDK</p>}</div>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
window.latestCheckpoint=()=>window.probe.saves.filter(x=>'activeGame' in x).at(-1)?.activeGame;
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'observe-jest-state-queue',async load(id){
if(id.endsWith('/PlayerSaveRecovery.ts')&&baseline)return (await readFile(path.join(baseline,'PlayerSaveRecovery.before.txt'),'utf8'))+"\nPlayerSaveRecovery.prototype.getSnapshot=()=> 'quiet';PlayerSaveRecovery.prototype.subscribe=()=>()=>{};";
if(!id.endsWith('/useJestPlayerStateWrites.ts'))return;let code=await readFile(id,'utf8');return code.replace('return useMemo(', 'window.awaitQueue=()=>Promise.all([playerDataWriteQueueRef.current.catch(()=>undefined),preferenceWriteQueueRef.current.catch(()=>undefined)]);return useMemo(');}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.SAVE_NOTICE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});


 const settleQueues=async page=>{let timeout;try{await Promise.race([page.evaluate(()=>window.awaitQueue()),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('owned storage queue did not settle')),10000);})]);}finally{clearTimeout(timeout);}};
 const locales=['en','es','pt','fr','de','ja','ko','hi','ru','tr','ar','id','it','nl','pl','vi'];
 const cases=locales.flatMap(locale=>(['en','de','ar','ja'].includes(locale)?[280,390,1280]:[390]).map(width=>({locale,width,scenario:'manual'})));
 cases.push(...['transient','preferences','replacement','offline'].map(scenario=>({locale:'en',width:390,scenario})));
 for(const {locale,width,scenario} of cases) {
  const height=width===280?568:844,context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({locale,width,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+'?locale='+locale);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  await page.waitForFunction(()=>window.storageProbe.writes.length===1);await waitForAnswerInputReady(page);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');
  await page.clock.install();const initializations=await page.evaluate(()=>window.storageProbe.initializations);
  metric('healthy game has no save prompt',await page.locator('.player-save-notice').count(),0);
  if(scenario==='offline')await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));});
  await page.evaluate(scenario=>{window.storageProbe.failDraft=scenario==='transient'?1:100;window.releaseStorage();},scenario);await settleQueues(page);
  if(scenario==='transient') {
   await page.clock.runFor(1001);await settleQueues(page);metric('transient save failures stay quiet',await page.locator('.player-save-notice').count(),0);
   metric('transient recovery persists draft',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIAN');
  } else {
   if(scenario!=='offline')await page.clock.runFor(7001);await settleQueues(page);
   if(!baseline)await page.locator('.player-save-notice').waitFor();
   metric('unresolved saves expose recovery',await page.locator('.player-save-notice').count(),1);
   await page.clock.runFor(50);
   if(!baseline)await page.screenshot({path:path.join(output,`prompt-${scenario}-${locale}-${width}.png`)});
   const expected=JSON.parse(await readFile(path.join(root,'src/locales',locale,'alerts.json'),'utf8')).GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE;
   metric('prompt uses the actual translated message',await page.locator('.player-save-notice p').count()?await page.locator('.player-save-notice p').innerText():'',expected);
   metric('riddle draft survives visible failure',await page.evaluate(()=>window.draft()),'PIAN');
   if(scenario==='replacement') {
    await page.evaluate(()=>{window.storageProbe.failDraft=0;window.restart(true);});await page.locator('[data-host-epoch="1"]').waitFor();await page.clock.runFor(20);await settleQueues(page);
   metric('hosted identity follows the replacement target player',await page.evaluate(()=>window.probe.hostedIdentities.at(-1)),{playerId:'other-player',uid:'firebase-other-player'});
    metric('retired prompt clears for replacement player',await page.locator('.player-save-notice').count(),0);
    metric('old answer never crosses target identity',await page.evaluate(()=>window.draft()),'');
   } else if(scenario==='offline') {
    metric('offline retry control waits for connectivity',await page.locator('.player-save-notice button').count()?await page.locator('.player-save-notice button').isDisabled():false,true);
    await page.evaluate(()=>{window.storageProbe.failDraft=0;Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));});await page.clock.runFor(20);await settleQueues(page);
    metric('online acknowledgement clears prompt',await page.locator('.player-save-notice').count(),0);
   } else {
    const geometry=await page.evaluate(()=>{const n=document.querySelector('.player-save-notice')?.getBoundingClientRect(),g=document.querySelector('.game-app')?.getBoundingClientRect(),k=document.querySelector('.keyboard')?.getBoundingClientRect(),b=document.querySelector('.player-save-notice button')?.getBoundingClientRect(),a=document.querySelector('.game-input-actions')?.getBoundingClientRect(),nav=document.querySelector('.game-bottom-navigation')?.getBoundingClientRect();return {noticeFits:!!n&&n.left>=-1&&n.right<=innerWidth+1,noticeAboveGame:!!n&&!!g&&n.bottom<=g.top+1,keyboardFits:!!k&&k.top>=0&&k.bottom<=innerHeight+1,controlsFit:!!a&&!!nav&&a.bottom<=innerHeight+1&&nav.bottom<=innerHeight+1,retryHeight:b?.height??0,smallestKeyHeight:Math.min(...Array.from(document.querySelectorAll('.keyboard button')).map(x=>x.getBoundingClientRect().height)),documentFits:document.documentElement.scrollHeight<=innerHeight+1};});
    metric('prompt fits without covering game controls',geometry.noticeFits&&geometry.noticeAboveGame&&geometry.keyboardFits&&geometry.controlsFit&&geometry.documentFits,true);
    metric('retry remains a full-size tap target',geometry.retryHeight>=44,true);
    metric('keyboard remains usable after warning layout',geometry.smallestKeyHeight>=32,true);
    metric('retry exposes the translated accessible name',await page.locator('.player-save-notice button').count()?await page.locator('.player-save-notice button').getAttribute('aria-label'):'',await page.evaluate(()=>window.copy().retry));
    await page.evaluate(scenario=>{window.storageProbe.failDraft=0;window.holdNextDraft();if(scenario==='preferences'){window.storageProbe.failPreferences=100;window.changePreferences();}},scenario);
    if(scenario==='preferences'){await settleQueues(page);await page.clock.runFor(7001);await page.evaluate(()=>{window.storageProbe.failPreferences=0;});}
    if(baseline)await page.evaluate(()=>window.writes.recovery.wake());else await page.locator('.player-save-notice button').click();await page.clock.runFor(20);
    metric('pending manual retry keeps recovery visible',await page.locator('.player-save-notice').count(),1);
    metric('pending retry exposes busy disabled button',await page.locator('.player-save-notice button').count()?await page.locator('.player-save-notice button').evaluate(x=>x.disabled&&x.getAttribute('aria-busy')==='true'):false,true);
    await page.keyboard.type('o');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIANO');metric('answer editing stays playable during retry',await page.evaluate(()=>window.draft()),'PIANO');
    await page.evaluate(()=>window.releaseNextDraft());await settleQueues(page);await page.clock.runFor(20);
    metric('prompt clears only after latest SDK acknowledgement',await page.locator('.player-save-notice').count(),0);
    metric('manual recovery persists newest answer',await page.evaluate(()=>window.durableData().riddleQuestPlayerState.activeGame.currentLetters.join('')),'PIANO');
    if(scenario==='preferences')metric('all pending preferences are durable before prompt clears',await page.evaluate(()=>({highContrast:window.durableData().highContrast,reducedMotion:window.durableData().reducedMotion})),{highContrast:true,reducedMotion:false});
   }
  }
  metric('storage health never restarts provider initialization',await page.evaluate(()=>window.storageProbe.initializations),initializations);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline)await page.screenshot({path:path.join(output,`${scenario}-${locale}-${width}.png`)});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
