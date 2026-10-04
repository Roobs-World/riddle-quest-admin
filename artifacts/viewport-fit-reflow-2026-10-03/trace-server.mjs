import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '/home/craig-beswetherick/Documents/riddle-quest/packages/portal/node_modules/vite/dist/node/index.js';
import {chromium} from '/home/craig-beswetherick/Documents/riddle-quest/packages/portal/node_modules/@playwright/test/index.mjs';

const root='/home/craig-beswetherick/Documents/riddle-quest/packages/portal';
const mode=process.env.FIT_REFLOW_REACT_MODE??'development',baseline=process.env.FIT_REFLOW_BASELINE_DIR;
const output=path.resolve(process.env.FIT_REFLOW_REPORT_DIR??path.join(root,'../../artifacts/viewport-fit-reflow-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/fit-reflow-'));
const source=`
import {useJestPlayerStateWrites} from ${JSON.stringify(path.join(root,'src/jest/useJestPlayerStateWrites.ts'))};
import {commitJestStartupSession} from ${JSON.stringify(path.join(root,'src/jest/commitJestStartupSession.ts'))};
import {JestSdkPlatform} from ${JSON.stringify(path.join(root,'src/jest/JestSdkPlatform.ts'))};
import {createNotificationOperationGate} from ${JSON.stringify(path.join(root,'src/jest/notifications/operationGate.ts'))};
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayerSaveRecoveryLayout} from ${JSON.stringify(path.join(root,'src/play/PlayerSaveRecoveryLayout.tsx'))};
import {setLocaleAndWait,tr} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {applyPlayerPreferences,setPlayerHighContrast,setPlayerReducedMotion} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;const fixtureLocale=new URL(location.href).searchParams.get('locale')??'en';window.copy=()=>({message:tr('GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE'),retry:tr('CommonButtons.RETRY')});
window.probe={saves:[],guesses:0,completions:0,errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:fixtureLocale,muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();let freshProfile=null;const services={...service,auth:{subscribe:listener=>service.auth.subscribe(snapshot=>listener(freshProfile?{...snapshot,profile:freshProfile}:snapshot))},loadProfile:async()=>freshProfile??await service.loadProfile(),submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};

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
return <div data-host-epoch={epoch} style={{height:"100%"}}>{ready?<PlayerSaveRecoveryLayout recovery={new URL(location.href).searchParams.has('unsaved')?layoutRecovery:writes.recovery}><PlayHostApp key={epoch} session={hosted}/></PlayerSaveRecoveryLayout>:<p>Initializing fixture SDK</p>}</div>;
}

import {PlayerSaveRecovery} from ${JSON.stringify(path.join(root,'src/platform/PlayerSaveRecovery.ts'))};
const layoutRecovery=new PlayerSaveRecovery(async()=>{},()=>false);layoutRecovery.attach();window.layoutRecovery=layoutRecovery;
import ${JSON.stringify(path.join(root,'src/styles.race-lobby.css'))};
import ${JSON.stringify(path.join(root,'src/styles.race-gameplay.css'))};
import {RaceGameplay} from ${JSON.stringify(path.join(root,'src/play/race/components/RaceGameplay.tsx'))};
import {useRaceGameplayFit} from ${JSON.stringify(path.join(root,'src/play/race/hooks/useRaceGameplayFit.ts'))};
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
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'fit-trace',async load(id){if(!id.endsWith('/useViewportFit.ts'))return;let code=await readFile(id,'utf8');if(process.env.FIT_REFLOW_MIN_PROBE==='1')code=code.replace('content.style.minHeight = \"0\";', 'content.style.setProperty(\"min-height\", \"0px\", \"important\");');if(process.env.FIT_REFLOW_TRACE==='1')code=code.replace('const availableHeight = shell.clientHeight;', 'const availableHeight = shell.clientHeight;window.fitTrace ??= [];const trace = {availableHeight, before:content.getAttribute("style"), candidates:[]};window.fitTrace.push(trace);').replace('return content.scrollHeight * scale;', 'const height=content.scrollHeight;trace.candidates.push({scale,height,minHeight:content.style.minHeight,width:content.style.width});return height*scale;').replace('content.dataset.viewportScale = nextScale.toFixed(4);','content.dataset.viewportScale = nextScale.toFixed(4);trace.selected=nextScale;');return code;}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.FIT_REFLOW_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}

}finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
