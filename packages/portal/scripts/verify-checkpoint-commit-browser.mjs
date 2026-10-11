import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,firefox} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.CHECKPOINT_COMMIT_REACT_MODE??'development',baseline=process.env.CHECKPOINT_COMMIT_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const lifecycle=process.env.CHECKPOINT_COMMIT_LIFECYCLE??'visibility',browserName=process.env.CHECKPOINT_COMMIT_BROWSER??'chromium';
assert.ok(['visibility','pagehide','both'].includes(lifecycle));assert.ok(['chromium','firefox'].includes(browserName));
const output=path.resolve(process.env.CHECKPOINT_COMMIT_REPORT_DIR??path.join(root,'../../artifacts/checkpoint-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/checkpoint-commit-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useGameSessionPersistence} from ${JSON.stringify(path.join(root,'src/play/game/hooks/useGameSessionPersistence.ts'))};
import {createSavedGame} from ${JSON.stringify(path.join(root,'src/play/GameSessionCheckpoints.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'src/play/gameSession.ts'))};
const lifecycle=${JSON.stringify(lifecycle)};
const scenario=new URL(location.href).searchParams.get('scenario')??'spec-state';
window.probe={saves:[],suspended:0,adds:0,removes:0,listeners:new Set(),errors:[],unhandled:[],initialBackground:false};
const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
document.addEventListener=(type,fn,...rest)=>{if(type==='visibilitychange'){window.probe.adds++;window.probe.listeners.add(fn);}return add(type,fn,...rest);};document.removeEventListener=(type,fn,...rest)=>{if(type==='visibilitychange'){window.probe.removes++;window.probe.listeners.delete(fn);}return remove(type,fn,...rest);};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const user={uid:'Alice',displayName:'Alice',isAnonymous:true,accountGeneration:1};
const first={riddleId:'classic_1',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false},second={...first,riddleId:'classic_2',sessionToken:'00000000-0000-4000-8000-000000000002',index:2};
function seed(){let state=gameSessionReducer(createInitialGameSession(),{type:'hostInit',locale:'en',gameMode:'classic',user,profile:null,products:[]});state=gameSessionReducer(state,{type:'loadRiddle',riddle:first});if(scenario!=='startup')for(const letter of 'PIAN')state=gameSessionReducer(state,{type:'typeLetter',letter});if(scenario==='spec-terminal')state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:[...'PIANO'],feedback:Array(5).fill('green')},attempts:1,isCorrect:true,gameOver:true,canContinue:false});return state;}
let restored=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:first});for(const letter of 'PIAN')restored=gameSessionReducer(restored,{type:'typeLetter',letter});const restoredGame=createSavedGame(restored,1);
window.background=()=>{if(lifecycle==='pagehide'){window.backgroundOpen=true;try{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));}finally{window.backgroundOpen=false;}return;}const old=Object.getOwnPropertyDescriptor(document,'visibilityState');Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});window.backgroundOpen=true;try{document.dispatchEvent(new Event('visibilitychange'));if(lifecycle==='both')window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));}finally{window.backgroundOpen=false;if(old)Object.defineProperty(document,'visibilityState',old);else delete document.visibilityState;}};
window.backgroundSaves=()=>window.probe.saves.filter(x=>x.background);
function Game({version}){const [state,dispatch]=React.useReducer(gameSessionReducer,undefined,seed),stateRef=React.useRef(state);stateRef.current=state;
 window.advance=()=>{if(scenario==='spec-terminal')dispatch({type:'completionAcknowledged'});else if(scenario!=='commit-adapter'){if(scenario==='spec-account'||scenario==='spec-generation')dispatch({type:'authState',user:{...user,uid:scenario==='spec-account'?'Bob':'Alice',accountGeneration:scenario==='spec-generation'?2:1},profile:null});if(scenario==='commit-draft')dispatch({type:'typeLetter',letter:'O'});else dispatch({type:'loadRiddle',riddle:second});}};
 useGameSessionPersistence({state,stateRef,dispatch,restoredGame:scenario==='startup'?restoredGame:undefined,onSaveGame:game=>window.probe.saves.push({version,background:Boolean(window.backgroundOpen),game})});
 return <output data-game data-version={version} data-riddle={state.riddle?.riddleId} data-draft={state.currentLetters.join('')} data-ack={String(state.completionAcknowledged)} data-owner={state.user?.uid} data-generation={state.user?.accountGeneration}>Game {version}: {state.riddle?.riddleId} draft {state.currentLetters.join('')}</output>;}
let unblock;const pending=new Promise(resolve=>unblock=resolve);function Suspend({version}){if(version==='B'&&!window.allowB){window.probe.suspended++;throw pending;}return null;}
function App(){const [version,setVersion]=React.useState('A'),[mounted,setMounted]=React.useState(true),[tick,setTick]=React.useState(0);window.refresh=()=>setTick(x=>x+1);window.speculate=()=>React.startTransition(()=>{window.advance();setVersion('B');});window.commit=()=>{window.allowB=true;unblock();window.advance();setVersion('B');};window.retire=()=>setMounted(false);
 React.useLayoutEffect(()=>{if((version==='B'&&scenario.startsWith('commit-'))||(!mounted&&scenario==='retire')||(scenario==='startup'&&!window.probe.initialBackground)){window.probe.initialBackground=true;window.background();}},[version,mounted]);
 return <div data-tick={tick}><React.Suspense fallback={<p>Waiting</p>}>{mounted?<><Game version={version}/><Suspend version={version}/></>:<p data-retired>Game removed</p>}</React.Suspense><button data-prepare onClick={window.speculate}>Prepare suspended change</button><button data-commit onClick={window.commit}>Commit change</button><button data-background onClick={window.background}>Background checkpoint</button><button data-retire onClick={window.retire}>Retire game</button></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'captured-checkpoint-adapter',async load(id){if(baseline&&id.endsWith('/useGameSessionPersistence.ts'))return readFile(path.join(baseline,'persistence.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.CHECKPOINT_COMMIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await (browserName==='firefox'?firefox:chromium).launch({headless:true,...(browserName==='firefox'&&process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH}:{})});
 for(const [width,height] of process.env.CHECKPOINT_COMMIT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.CHECKPOINT_COMMIT_SCENARIOS?.split(',')??['spec-state','spec-terminal','spec-account','spec-generation','commit-state','commit-draft','commit-adapter','retire','stable','startup']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await page.waitForFunction(()=>window.probe.listeners.size===1);await page.locator('[data-game]').waitFor();if(scenario==='startup')await page.waitForFunction(()=>document.querySelector('[data-game]')?.dataset.draft==='PIAN');
  metric('mounted game owns one background listener',await page.evaluate(()=>window.probe.listeners.size),1);await page.evaluate(()=>{window.probe.saves=[];window.originalGame=document.querySelector('[data-game]');});
  const listeners=await page.evaluate(()=>({adds:window.probe.adds,removes:window.probe.removes}));
  if(scenario.startsWith('spec-')){await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.suspended>0);metric('suspended change keeps question A visible',await page.locator('[data-game]').getAttribute('data-riddle'),'classic_1');metric('suspended change retains the original DOM',await page.evaluate(()=>window.originalGame===document.querySelector('[data-game]')),true);metric('suspended change keeps old receipt acknowledgement',await page.locator('[data-game]').getAttribute('data-ack'),'false');await page.locator('[data-background]').click();}
  else if(scenario.startsWith('commit-')){await page.locator('[data-commit]').click();await page.waitForFunction(()=>document.querySelector('[data-game]')?.dataset.version==='B');}
  else if(scenario==='retire'){await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();}
  else{if(scenario==='stable'){for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-tick]')?.dataset.tick===String(i+1),i);}}await page.locator('[data-background]').click();}
  const saves=await page.evaluate(()=>window.backgroundSaves().map(x=>({version:x.version,riddle:x.game?.riddleId??null,draft:x.game?.currentLetters.join('')??null,outcome:x.game?.pendingOutcome?.kind??null})));
  const empty=['spec-account','spec-generation','retire'].includes(scenario),next=scenario==='commit-state';metric('background writes belong to the committed game and adapter',saves,empty?[]:Array.from({length:lifecycle==='both'?2:1},()=>({version:scenario.startsWith('commit-')?'B':'A',riddle:next?'classic_2':'classic_1',draft:scenario==='commit-draft'?'PIANO':next||scenario==='spec-terminal'?'':'PIAN',outcome:scenario==='spec-terminal'?'win':null})));
  metric('retirement releases the background listener',await page.evaluate(()=>window.probe.listeners.size),scenario==='retire'?0:1);
  if(scenario==='stable'||scenario==='commit-adapter'){metric('callback updates retain the background subscription',await page.evaluate(()=>({adds:window.probe.adds,removes:window.probe.removes})),listeners);}
  if(scenario==='startup')metric('startup restoration reaches the visible draft before saving',await page.locator('[data-game]').getAttribute('data-draft'),'PIAN');
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.CHECKPOINT_COMMIT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.CHECKPOINT_COMMIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Committed background checkpoint ownership');
