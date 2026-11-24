import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.FIT_REFLOW_REACT_MODE??'development',baseline=process.env.FIT_REFLOW_BASELINE_DIR;
const output=path.resolve(process.env.FIT_REFLOW_REPORT_DIR??path.join(root,'builds/test-evidence/viewport-fit-reflow-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/fit-reflow-'));
const stylesEntry=baseline?path.join(scratch,'styles-baseline.css'):path.join(root,"src/app/styles/game.css");
if(baseline){
 // CSS @imports are read by Vite's CSS pipeline, bypassing module load hooks.
 for(const name of ['foundation','guidance']){
  const original=await readFile(path.join(baseline,`styles.${name}.before.css`),'utf8');
  const rebased=original.replace(/url\("([^"\)]+)"\)/g,(_,asset)=>`url(${JSON.stringify(path.resolve(root,'src',asset))})`);
  await writeFile(path.join(scratch,`styles.${name}.css`),rebased);
 }
 const imports=['foundation','shared-ui','game-shell','puzzle','guidance'].map(name=>`@import ${JSON.stringify(path.join(['foundation','guidance'].includes(name)?scratch:path.join(root,'src'),`styles.${name}.css`))};`).join('\n');
 await writeFile(stylesEntry,imports);
}
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
import {applyPlayerPreferences,setPlayerNotificationsEnabled,setPlayerReducedMotion} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,"src/platform/bridge/browser/localBridge.ts"))};
import ${JSON.stringify(stylesEntry)};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;const fixtureLocale=new URL(location.href).searchParams.get('locale')??'en';const fixtureReducedMotion=new URL(location.href).searchParams.get('motion')!=='normal';window.copy=()=>({message:tr('GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE'),retry:tr('CommonButtons.RETRY')});
window.probe={saves:[],guesses:0,completions:0,errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:fixtureLocale,muted:true,reducedMotion:fixtureReducedMotion,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();let freshProfile=null;const services={...service,auth:{subscribe:listener=>service.auth.subscribe(snapshot=>listener(freshProfile?{...snapshot,profile:freshProfile}:snapshot))},loadProfile:async()=>freshProfile??await service.loadProfile(),submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};

window.storageProbe={writes:[],preferenceWrites:[],flushes:0,failures:[],initializations:0,failDraft:0,failPreferences:0,failClear:0};let release,released=false,lastOperation,releaseNext;const heldFlush=new Promise(r=>release=r);let holdNext=false;
let player={playerId:'jest-player',registered:new URL(location.href).searchParams.has('registered')};const stores=new Map(),durable=new Map();
const getStore=()=>{if(!stores.has(player.playerId))stores.set(player.playerId,{});return stores.get(player.playerId);};
window.durableData=()=>structuredClone(durable.get(player.playerId)??{});window.seedSdkPreference=(key,value)=>{getStore()[key]=value;durable.set(player.playerId,{...(durable.get(player.playerId)??{}),[key]:value});};window.holdNextDraft=()=>holdNext=true;window.releaseNextDraft=()=>releaseNext?.();
const sdk={init:async()=>{window.storageProbe.initializations++;},getPlayer:()=>player,data:{
set:(key,value)=>{const kind=typeof key==='string'?'state':'preferences',data=structuredClone(typeof key==='string'?value:key);if(kind==='state')getStore()[key]=data;else Object.assign(getStore(),data);lastOperation={kind,playerId:player.playerId,value:data,ack:false};window.storageProbe[kind==='state'?'writes':'preferenceWrites'].push(lastOperation);},
getAll:()=>structuredClone(getStore()),delete:key=>delete getStore()[key],flush:async()=>{window.storageProbe.flushes++;const entry=lastOperation;if(!released)await heldFlush;const draft=entry.kind==='state'&&entry.value.activeGame?.currentLetters.join('')==='PIAN';const clear=entry.kind==='state'&&entry.value.activeGame===null;
if((draft&&window.storageProbe.failDraft>0)||(clear&&window.storageProbe.failClear>0)||(entry.kind==='preferences'&&entry.value.notificationsEnabled===false&&window.storageProbe.failPreferences>0)){if(draft)window.storageProbe.failDraft--;else if(clear)window.storageProbe.failClear--;else window.storageProbe.failPreferences--;entry.failed=true;throw new Error('injected SDK flush failure');}
if(holdNext&&entry.kind==='state'&&entry.value.activeGame){holdNext=false;await new Promise(r=>releaseNext=r);}const prior=durable.get(entry.playerId)??{};durable.set(entry.playerId,entry.kind==='state'?{...prior,riddleQuestPlayerState:entry.value}:{...prior,...entry.value});entry.ack=true;}}};
const platform=new JestSdkPlatform(sdk),gate=createNotificationOperationGate({crossContextLock:null,deletionEpoch:()=>null,deletionPending:()=>false,requireCrossContextLock:false});
window.releaseStorage=()=>{released=true;release();};
const baseSession=()=>({player:{...player},profile:null,entryIntent:{},preferences:{locale:fixtureLocale,muted:true,reducedMotion:fixtureReducedMotion,onboardingComplete:true},playerData:null,firebaseAuthenticated:true});
function App(){const [current,setCurrent]=React.useState(baseSession),[epoch,setEpoch]=React.useState(0),[ready,setReady]=React.useState(false);const sessionRef=React.useRef(current);window.sessionRef=sessionRef;
const setSession=change=>{const next=typeof change==='function'?change(sessionRef.current):change;sessionRef.current=next;setCurrent(next);};
const writes=useJestPlayerStateWrites({platform,gate,sessionRef,setSession:React.useCallback(setSession,[]),setEngagementProgress:React.useCallback(()=>{},[]),trackFailure:React.useCallback(name=>window.storageProbe.failures.push(name),[])});window.writes=writes;
React.useEffect(()=>{let active=true;void platform.init().then(async()=>{await setLocaleAndWait(fixtureLocale);if(!active)return;writes.enable(null,player.playerId);writes.savePlayerData({profile:{username:"Initial authority",coins:300,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});setReady(true);});return()=>{active=false;writes.disable();};},[writes]);
window.writeUpdate=React.useCallback(update=>{window.probe.saves.push(update);writes.savePlayerData(update);},[writes]);
window.changePreferences=()=>{setPlayerNotificationsEnabled(false);setPlayerReducedMotion(false);};
window.mergeProfile=()=>window.writeUpdate({profile:{username:'Ada',coins:777,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});
window.restart=async other=>{writes.disable();player={playerId:other?'other-player':'jest-player',registered:true};const incoming=await platform.readPlayerData();const session={...baseSession(),playerData:{...incoming,schemaVersion:1,updatedAt:Date.now(),profile:{username:'Fresh authority',coins:80,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}}};
freshProfile=session.playerData.profile;await commitJestStartupSession({gate,isActive:()=>true,session,enablePlayerStateWrites:writes.enable,setEngagementProgress:()=>{},setSession:next=>{setSession(next);window.committed=next;setEpoch(x=>x+1);},trackFunnel:()=>{}});};
const hosted=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:current.playerData,onPlayerDataChange:window.writeUpdate});
return <div data-host-epoch={epoch} style={{height:"100%"}}>{ready?<PlayerSaveRecoveryLayout recovery={new URL(location.href).searchParams.has('unsaved')?layoutRecovery:writes.recovery}><PlayHostApp key={epoch} session={hosted}/></PlayerSaveRecoveryLayout>:<p>Initializing fixture SDK</p>}</div>;
}

import {PlayerSaveRecovery} from ${JSON.stringify(path.join(root,"src/accounts/browser/playerState/PlayerSaveRecovery.ts"))};
const layoutRecovery=new PlayerSaveRecovery(async()=>{},()=>false);layoutRecovery.attach();window.layoutRecovery=layoutRecovery;
import ${JSON.stringify(path.join(root,"src/races/styles/lobby.css"))};
import ${JSON.stringify(path.join(root,"src/races/styles/gameplay.css"))};
import {RaceGameplay} from ${JSON.stringify(path.join(root,"src/races/components/gameplay/RaceGameplay.tsx"))};
import {useRaceGameplayFit} from ${JSON.stringify(path.join(root,"src/races/hooks/useRaceGameplayFit.ts"))};
function RaceFixture(){const screenRef=React.useRef(null),viewportRef=React.useRef(null),gameplayRef=React.useRef(null);const [ready,setReady]=React.useState(false),[letters,setLetters]=React.useState([]);React.useEffect(()=>{void setLocaleAndWait(fixtureLocale).then(()=>setReady(true));},[]);useRaceGameplayFit({active:ready,screenRef,viewportRef,gameplayRef});
const run={runId:'layout-race',role:'creator',status:'active',rules:{targetCorrect:10,hintPenaltyMs:30000,skipPenaltyMs:30000},serverNowMs:Date.now(),startsAtMs:Date.now(),locale:fixtureLocale,correctCount:0,totalPenaltyMs:0,wallElapsedMs:0,adjustedElapsedMs:0,events:[],opponent:{displayName:'Opponent',events:[],adjustedFinishMs:0},currentRiddle:{riddleId:'layout-riddle',text:'What has keys but cannot open doors?',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]}};
window.raceLetters=()=>letters;const add=text=>setLetters(prior=>[...prior,...text.toUpperCase()].slice(0,5));return <section ref={screenRef} className='race-screen race-screen-gameplay' role='dialog'>{ready?<RaceGameplay live viewportRef={viewportRef} gameplayRef={gameplayRef} run={run} adjustedNow={0} opponentCorrect={0} feedback={null} coins={100} currentLetters={letters} activeSlotIndex={letters.length} guesses={[]} letterStates={{}} pending={false} allowTypingWhilePending={false} onClose={()=>{}} onSelectSlot={()=>{}} onLetter={add} onText={add} onBackspace={()=>setLetters(x=>x.slice(0,-1))} onHint={()=>{}} onSubmit={()=>window.probe.guesses++} onSkip={()=>{}}/>:null}</section>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode>{new URL(location.href).searchParams.has('race')?<RaceFixture/>:<App/>}</React.StrictMode>);
window.latestCheckpoint=()=>window.probe.saves.filter(x=>'activeGame' in x).at(-1)?.activeGame;
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
`;

await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.FIT_REFLOW_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}

 else {
 browser=await chromium.launch({headless:true});
 const locales=['en','de','ar','ja','es','pt','fr','ko','hi','ru','tr','id','it','nl','pl','vi'];
 const motions=[{name:'app',app:true,system:false},{name:'system',app:false,system:true},{name:'both',app:true,system:true},{name:'normal',app:false,system:false}];
 for(const locale of locales)for(const surface of ['solo','unsaved','race'])for(const motion of (['en','de','ar','ja'].includes(locale)?motions:motions.slice(0,2))){
  const context=await browser.newContext({viewport:{width:1280,height:844},reducedMotion:motion.system?'reduce':'no-preference'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?locale='+locale+(surface==='race'?'&race=1':surface==='unsaved'?'&unsaved=1':'')+(motion.app?'':'&motion=normal'));
  await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(surface==='unsaved')await page.evaluate(()=>window.layoutRecovery.failed());
  const measurements=[];
  for(const [stage,width,height]of [['desktop',1280,844],['short',500,494],['landscape',844,390],['tall',500,720],['short-again',500,494]]){
   await page.setViewportSize({width,height});await page.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<12;i++)await new Promise(r=>requestAnimationFrame(r));});
   const values=await page.evaluate(async()=>{const result=[];for(let i=0;i<8;i++){await new Promise(r=>requestAnimationFrame(r));const content=document.querySelector('.game-content,.race-gameplay'),boxes=['.riddle-card','.guess-board','.keyboard','.game-input-actions','.game-bottom-navigation'].map(s=>document.querySelector(s)?.getBoundingClientRect()).filter(Boolean),c=getComputedStyle(content);result.push({keyHeight:Math.min(...Array.from(document.querySelectorAll('.keyboard .key')).map(x=>x.getBoundingClientRect().height)),fits:boxes.every(b=>b.left>=-1&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1),scale:document.querySelector('.game-content,.race-gameplay-viewport').dataset.viewportScale,contentHeight:content.getBoundingClientRect().height,transitionDuration:c.transitionDuration,transitionDelay:c.transitionDelay,systemReduced:matchMedia('(prefers-reduced-motion: reduce)').matches,appReduced:document.documentElement.dataset.riddleQuestReducedMotion==='true'});}return result;});
   const metric=(name,actual,expected)=>observations.push({locale,surface,motion:motion.name,stage,name,actual,expected});
   metric('control geometry resolves without interpolation',values.every(x=>x.transitionDuration==='0s'&&x.transitionDelay==='0s'),true);
   metric('keys stay at least 32 pixels after resize',values.every(x=>x.keyHeight>=32),true);
   metric('puzzle and controls stay inside viewport',values.every(x=>x.fits),true);
   metric('settled layout stays stable',Math.max(...values.map(x=>x.contentHeight))-Math.min(...values.map(x=>x.contentHeight))<=1,true);
   metric('system preference fixture is applied',values.every(x=>x.systemReduced===motion.system),true);
   metric('app preference fixture is applied',values.every(x=>x.appReduced===motion.app),true);
   measurements.push({stage,width,height,values});
   if(stage==='short-again'&&['ar','de'].includes(locale))await page.screenshot({path:path.join(output,`${surface}-${locale}-${motion.name}.png`)});
  }
  if(surface==='race'){await page.locator('.guess-row .cell').first().click();await page.keyboard.type('pian');await page.waitForFunction(()=>window.raceLetters().join('')==='PIAN');observations.push({locale,surface,motion:motion.name,name:'native input after repeated resize',actual:await page.evaluate(()=>window.raceLetters().join('')),expected:'PIAN'});}
  else{await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.draft()==='PIAN');observations.push({locale,surface,motion:motion.name,name:'native input after repeated resize',actual:await page.evaluate(()=>window.draft()),expected:'PIAN'});}
  observations.push({locale,surface,motion:motion.name,name:'no browser error',actual:errors,expected:[]});
  await writeFile(path.join(output,`${surface}-${locale}-${motion.name}.json`),JSON.stringify(measurements,null,2));await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures},null,2));if(!baseline&&failures.length)process.exitCode=1;
