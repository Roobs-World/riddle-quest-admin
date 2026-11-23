import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.GAME_RETIRE_REACT_MODE??'development',baseline=process.env.GAME_RETIRE_BASELINE_DIR;
const output=path.resolve(process.env.GAME_RETIRE_REPORT_DIR??path.join(root,'builds/test-evidence/game-bridge-retirement-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});const scratch=await mkdtemp(path.join(root,'node_modules/.cache/game-retire-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useGameMessageListener} from ${JSON.stringify(path.join(root,'src/web/play/game/hooks/useGameBridgeLifecycle.ts'))};
import {useCompletionDelivery} from ${JSON.stringify(path.join(root,'src/web/play/game/hooks/useCompletionDelivery.ts'))};
import {useGameMessageRouter} from ${JSON.stringify(path.join(root,'src/web/play/useGameMessageRouter.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'src/hosted/play/gameSession.ts'))};
import {createGameMessageRouter} from ${JSON.stringify(path.join(root,'src/web/play/bridgeRouter.ts'))};
import {HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/web/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.probe={effects:[],messages:[],errors:[],unhandled:[],adds:0,removes:0,retained:[],suspended:0,acknowledgementAt:null,immediateAck:null};window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const params=new URL(location.href).searchParams,scenario=params.get('scenario')??'retire',channel=params.get('channel')??'local';
const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
window.addEventListener=(type,fn,...args)=>{if([HOST_TO_GAME_EVENT,'message'].includes(type)){window.probe.adds++;window.probe.retained.push({type,fn});}return add(type,fn,...args);};window.removeEventListener=(type,...args)=>{if([HOST_TO_GAME_EVENT,'message'].includes(type))window.probe.removes++;return remove(type,...args);};
window.emit=message=>window.dispatchEvent(channel==='local'?new CustomEvent(HOST_TO_GAME_EVENT,{detail:message}):new MessageEvent('message',{origin:location.origin,source:window.parent,data:message}));
window.completeReceipt=()=>({type:'host:operationResult',requestId:window.completion.requestId,payload:{operation:'completeGame',ok:true,data:{coinsEarned:0}}});
window.retainedReceipt=()=>{const message=window.completeReceipt();for(const entry of window.probe.retained)if(entry.type===(channel==='local'?HOST_TO_GAME_EVENT:'message'))entry.fn(channel==='local'?new CustomEvent(entry.type,{detail:message}):new MessageEvent(entry.type,{origin:location.origin,source:window.parent,data:message}));};
function terminalState(){let state=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{riddleId:'classic_1',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}});for(let i=1;i<=5;i++)state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:['Z','Z','Z','Z','Z'],feedback:['red','red','red','red','red']},attempts:i,isCorrect:false,gameOver:i===5,canContinue:false});return state;}
function Game({version}){const [state,dispatch]=React.useReducer(gameSessionReducer,undefined,terminalState),stateRef=React.useRef(state);stateRef.current=state;
const traceDispatch=React.useCallback(action=>{window.probe.effects.push({version,type:action.type});if(action.type==='completionAcknowledged'&&window.probe.acknowledgementAt===null)window.probe.acknowledgementAt=performance.now();dispatch(action);},[version]);
const post=React.useCallback(message=>{window.probe.messages.push({version,message});if(message.type==='game:completeGame'){window.completion=message;if(scenario==='sync-initial'){window.emit(window.completeReceipt());if(window.probe.immediateAck===null)window.probe.immediateAck=window.probe.acknowledgementAt!==null;}}},[version]);
const requestRiddle=React.useCallback(()=>post({type:'game:loadRiddle',requestId:'next-'+version,payload:{gameMode:'classic'}}),[post]);
const complete=useCompletionDelivery({outcome:state.lastOutcome,dispatch:traceDispatch,postToHost:post,ownerKey:'Alice:1'});
const router=useGameMessageRouter({dispatch:traceDispatch,stateRef,postToHost:post,requestRiddle,onCompletionResult:complete});useGameMessageListener({router,postToHost:post});
return <output data-game data-version={version} data-ack={String(state.completionAcknowledged)}>Completion {state.completionAcknowledged?'acknowledged':'pending'}</output>;}
let unblock;const pending=new Promise(resolve=>unblock=resolve);window.unblock=unblock;function Suspend({version}){if(version==='B'&&!window.allowB){window.probe.suspended++;throw pending;}return null;}
function App(){const [version,setVersion]=React.useState('A'),[mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0);window.retire=()=>setMounted(false);window.refresh=()=>setEpoch(x=>x+1);window.speculate=()=>React.startTransition(()=>setVersion('B'));window.commit=()=>{window.allowB=true;unblock();setVersion('B');};window.remount=()=>setMounted(true);
React.useLayoutEffect(()=>{if(!mounted){window.probe.phase={removed:!document.querySelector('[data-game]'),listeners:window.probe.adds-window.probe.removes};window.emit(window.completeReceipt());}else if(version==='B'&&scenario==='replace'){window.probe.phase={removed:false,listeners:window.probe.adds-window.probe.removes};window.emit(window.completeReceipt());}},[mounted,version]);
return <div data-epoch={epoch}><React.Suspense fallback={<p>Waiting</p>}>{mounted?<Game version={version}/>:<p data-retired>Retired game</p>}<Suspend version={version}/></React.Suspense><button data-retire onClick={()=>setMounted(false)}>Retire game</button><button data-replace onClick={()=>window.commit()}>Replace listener</button></div>;}
await createGameMessageRouter(new Proxy({},{get:()=>()=>{}}))({type:'host:pause',payload:{}});
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'game-retire-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useGameBridgeLifecycle.ts'))return readFile(path.join(baseline,'bridge.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.GAME_RETIRE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.GAME_RETIRE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const channel of process.env.GAME_RETIRE_CHANNELS?.split(',')??['local','native'])for(const scenario of process.env.GAME_RETIRE_SCENARIOS?.split(',')??['retire','replace','speculative','live','stable','sync-initial','remount']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,channel,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario+'&channel='+channel);await page.waitForFunction(()=>!!window.completion);await page.locator('[data-game]').waitFor();
  metric('game owns one listener for each validated channel',await page.evaluate(()=>window.probe.adds-window.probe.removes),2);
  await page.evaluate(()=>{window.probe.effects=[];});
  if(scenario==='retire'||scenario==='remount'){await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();await page.evaluate(()=>window.retainedReceipt());}
  else if(scenario==='replace'){await page.locator('[data-replace]').click();await page.waitForFunction(()=>document.querySelector('[data-game]')?.dataset.version==='B');}
  else if(scenario==='speculative'){await page.evaluate(()=>window.speculate());await page.waitForFunction(()=>window.probe.suspended>0);metric('unfinished replacement keeps the committed game',await page.locator('[data-game]').getAttribute('data-version'),'A');await page.evaluate(()=>window.emit(window.completeReceipt()));}
  else if(scenario==='stable'){const before=await page.evaluate(()=>({adds:window.probe.adds,removes:window.probe.removes}));for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-epoch]')?.dataset.epoch===String(i+1),i);}metric('ordinary parent updates retain channel subscriptions',await page.evaluate(()=>({adds:window.probe.adds,removes:window.probe.removes})),before);await page.evaluate(()=>window.emit(window.completeReceipt()));}
  else if(scenario==='live')await page.evaluate(()=>window.emit(window.completeReceipt()));
  if(scenario==='sync-initial')metric('first synchronous completion reply is handled before the host send returns',await page.evaluate(()=>window.probe.immediateAck),true);
  await page.waitForTimeout(100);const requests=await page.evaluate(()=>window.probe.messages.filter(x=>x.message.type==='game:loadRiddle').map(x=>x.version));
  metric('only the current game can request the next question from a loss receipt',requests,scenario==='retire'||scenario==='remount'?[]:[scenario==='replace'?'B':'A']);
  if(scenario==='retire'||scenario==='remount'){metric('removed game ignores completion reducer effects',await page.evaluate(()=>window.probe.effects),[]);metric('removed game detaches both channels during commit',await page.evaluate(()=>window.probe.phase),{removed:true,listeners:0});}
  else{metric('current receipt acknowledges the completion',await page.locator('[data-game]').getAttribute('data-ack'),'true');await page.evaluate(()=>window.emit(window.completeReceipt()));await page.waitForTimeout(30);metric('replayed completion cannot request another question',await page.evaluate(()=>window.probe.messages.filter(x=>x.message.type==='game:loadRiddle').map(x=>x.version)),[scenario==='replace'?'B':'A']);}
  if(scenario==='remount'){await page.evaluate(()=>window.remount());await page.locator('[data-game]').waitFor();await page.evaluate(()=>window.emit(window.completeReceipt()));await page.waitForTimeout(40);metric('remounted game owns its fresh completion receipt',await page.evaluate(()=>window.probe.messages.filter(x=>x.message.type==='game:loadRiddle').map(x=>x.version)),['A']);metric('remount installs exactly two current listeners',await page.evaluate(()=>window.probe.adds-window.probe.removes),2);}
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.GAME_RETIRE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.GAME_RETIRE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Game bridge committed retirement assertions');
