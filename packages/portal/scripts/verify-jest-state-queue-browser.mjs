import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.JEST_QUEUE_REACT_MODE??'development',baseline=process.env.JEST_QUEUE_BASELINE_DIR;
const output=path.resolve(process.env.JEST_QUEUE_REPORT_DIR??path.join(root,'../../builds/test-evidence/jest-state-queue-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/jest-queue-'));
const source=`
import {useJestPlayerStateWrites} from ${JSON.stringify(path.join(root,'src/jest/useJestPlayerStateWrites.ts'))};
import {commitJestStartupSession} from ${JSON.stringify(path.join(root,'src/jest/commitJestStartupSession.ts'))};
import {JestSdkPlatform} from ${JSON.stringify(path.join(root,'src/jest/JestSdkPlatform.ts'))};
import {createNotificationOperationGate} from ${JSON.stringify(path.join(root,'src/jest/notifications/operationGate.ts'))};
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={saves:[],guesses:0,completions:0,hostedIdentities:[],errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();let freshProfile=null;const services={...service,auth:{subscribe:listener=>service.auth.subscribe(snapshot=>{const user=snapshot.user?{...snapshot.user,uid:player.playerId==='jest-player'?snapshot.user.uid:'firebase-'+player.playerId}:null;window.probe.hostedIdentities.push({playerId:player.playerId,uid:user?.uid??null});listener({...snapshot,user,...(freshProfile?{profile:freshProfile}:{})});})},loadProfile:async()=>freshProfile??await service.loadProfile(),submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};

window.storageProbe={writes:[],flushes:0,failures:[],initializations:0};let release,released=false;const heldFlush=new Promise(r=>release=r);
let player={playerId:'jest-player',registered:new URL(location.href).searchParams.has('registered')};const stores=new Map();
const getStore=()=>{if(!stores.has(player.playerId))stores.set(player.playerId,{});return stores.get(player.playerId);};
const sdk={init:async()=>{window.storageProbe.initializations++;},getPlayer:()=>player,data:{
set:(key,value)=>{if(typeof key==='string'){getStore()[key]=structuredClone(value);if(key==='riddleQuestPlayerState')window.storageProbe.writes.push({playerId:player.playerId,value:structuredClone(value),ack:false});}else Object.assign(getStore(),key);},
getAll:()=>structuredClone(getStore()),delete:key=>delete getStore()[key],flush:async()=>{window.storageProbe.flushes++;const entry=window.storageProbe.writes.at(-1);if(!released)await heldFlush;if(entry)entry.ack=true;}}};
const platform=new JestSdkPlatform(sdk),gate=createNotificationOperationGate({crossContextLock:null,deletionEpoch:()=>null,deletionPending:()=>false,requireCrossContextLock:false});
window.releaseStorage=()=>{released=true;release();};
const baseSession=()=>({player:{...player},profile:null,entryIntent:{},preferences:{locale:'en',muted:true,reducedMotion:true,onboardingComplete:true},playerData:null,firebaseAuthenticated:true});
function App(){const [current,setCurrent]=React.useState(baseSession),[epoch,setEpoch]=React.useState(0),[ready,setReady]=React.useState(false);const sessionRef=React.useRef(current);window.sessionRef=sessionRef;
const setSession=change=>{const next=typeof change==='function'?change(sessionRef.current):change;sessionRef.current=next;setCurrent(next);};
const writes=useJestPlayerStateWrites({platform,gate,sessionRef,setSession:React.useCallback(setSession,[]),setEngagementProgress:React.useCallback(()=>{},[]),trackFailure:React.useCallback(name=>window.storageProbe.failures.push(name),[])});window.writes=writes;
React.useEffect(()=>{let active=true;void platform.init().then(()=>{if(!active)return;writes.enable(null,player.playerId);writes.savePlayerData({profile:{username:"Initial authority",coins:300,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:1}});setReady(true);});return()=>{active=false;writes.disable();};},[writes]);
window.writeUpdate=update=>{window.probe.saves.push(update);writes.savePlayerData(update);};
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
if(!['/useJestPlayerStateWrites.ts','/commitJestStartupSession.ts'].some(name=>id.endsWith(name)))return;
let code=await readFile(baseline?path.join(baseline,path.basename(id).replace('.ts','.before.txt')):id,'utf8');
if(id.endsWith('/useJestPlayerStateWrites.ts'))code=code.replace('return useMemo(', 'window.awaitQueue=()=>Promise.all([playerDataWriteQueueRef.current.catch(()=>undefined),preferenceWriteQueueRef.current.catch(()=>undefined)]);return useMemo(');return code;}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.JEST_QUEUE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});


 for(const width of [390,1280])for(const registered of [false,true])for(const scenario of ['latest','same-player','other-player','drain-restart']) {
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,registered,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+(registered?'?registered=1':''));await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.waitForFunction(()=>window.storageProbe.writes.length===1);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');
  for(let i=0;i<10;i++){await page.keyboard.press('Backspace');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIA');await page.keyboard.type('n');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIAN');}
  await page.evaluate(()=>window.mergeProfile());
  metric('24 physical answer edits reach checkpoint hook',await page.evaluate(()=>window.probe.saves.filter(x=>'activeGame' in x).length),24);
  metric('SDK initialized before queued state writes',await page.evaluate(()=>window.storageProbe.initializations>0),true);
  metric('answer stays playable while SDK flush is held',await page.evaluate(()=>window.draft()),'PIAN');
  metric('held SDK call remains sole write',await page.evaluate(()=>window.storageProbe.writes.length),1);
  metric('held SDK flush acknowledges no snapshot',await page.evaluate(()=>window.storageProbe.writes.some(x=>x.ack)),false);
  if(scenario!=='latest') {
   if(scenario==='drain-restart')await page.evaluate(()=>{window.oldDrain=window.writes.drainAndClear();});
   await page.evaluate(other=>window.restart(other),scenario!=='same-player');
   await page.locator('[data-host-epoch="1"]').waitFor();await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();await page.waitForTimeout(50);
   metric('hosted identity follows the committed target player',await page.evaluate(()=>window.probe.hostedIdentities.at(-1)),{playerId:scenario==='same-player'?'jest-player':'other-player',uid:scenario==='same-player'?'jest-guest':'firebase-other-player'});
   metric('startup keeps fresh authority profile',await page.evaluate(()=>window.committed.playerData.profile.coins),80);
   metric('startup checkpoint remains isolated by target player',await page.evaluate(()=>window.committed.playerData.activeGame?.currentLetters.join('')??''),scenario==='same-player'?'PIAN':'');
   metric('host restores same-player draft without importing another player',await page.evaluate(()=>window.draft()),scenario==='same-player'?'PIAN':'');
  }
  await page.evaluate(async()=>{window.releaseStorage();if(window.oldDrain)await window.oldDrain;await window.awaitQueue();});
  if(scenario==='latest') {
   metric('waiting edits and profile need one newest SDK write',await page.evaluate(()=>window.storageProbe.writes.length),2);
   metric('newest stored draft is PIAN',await page.evaluate(()=>window.storageProbe.writes.at(-1).value.activeGame.currentLetters.join('')),'PIAN');
   metric('independent cached profile survives coalescing',await page.evaluate(()=>window.storageProbe.writes.at(-1).value.profile.coins),777);
   await page.keyboard.type('o');await page.waitForFunction(()=>window.latestCheckpoint()?.currentLetters.join('')==='PIANO');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1&&window.latestCheckpoint()===null);await page.evaluate(()=>window.awaitQueue());
   metric('ordinary submission reaches authority once',await page.evaluate(()=>window.probe.guesses),1);
   metric('completion clear reaches SDK',await page.evaluate(()=>window.storageProbe.writes.at(-1).value.activeGame),null);
  } else {
   metric('new visit persists fresh authority profile',await page.evaluate(()=>window.storageProbe.writes.at(-1).value.profile.coins),80);
   metric('retired waiting snapshots do not replay into SDK',await page.evaluate(()=>window.storageProbe.writes.length<=3),true);
   if(scenario==='same-player')metric('new visit writes retained draft',await page.evaluate(()=>window.storageProbe.writes.at(-1).value.activeGame?.currentLetters.join('')??''),'PIAN');
   else metric('another player never receives retired answer',await page.evaluate(()=>window.storageProbe.writes.filter(x=>x.playerId==='other-player').every(x=>!x.value.activeGame)),true);
   if(scenario==='drain-restart')metric('old drain cannot clear new startup',await page.evaluate(()=>window.sessionRef.current.playerData?.profile?.coins),80);
  }
  metric('no storage failure',await page.evaluate(()=>window.storageProbe.failures),[]);metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline)await page.screenshot({path:path.join(output,`${scenario}-${registered?'registered':'guest'}-${width}.png`)});await context.close();

 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
