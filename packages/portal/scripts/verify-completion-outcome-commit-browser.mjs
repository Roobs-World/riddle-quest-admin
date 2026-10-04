import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.COMPLETION_COMMIT_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const baseline=process.env.COMPLETION_COMMIT_BASELINE_DIR;
const output=path.resolve(process.env.COMPLETION_COMMIT_REPORT_DIR??path.join(root,'../../artifacts/completion-outcome-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/completion-commit-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useCompletionDelivery} from ${JSON.stringify(path.join(root,'src/play/game/hooks/useCompletionDelivery.ts'))};
import {useGameMessageRouter} from ${JSON.stringify(path.join(root,'src/play/useGameMessageRouter.ts'))};
import {useGameMessageListener} from ${JSON.stringify(path.join(root,'src/play/game/hooks/useGameBridgeLifecycle.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'src/play/gameSession.ts'))};
import {createGameMessageRouter} from ${JSON.stringify(path.join(root,'src/play/bridgeRouter.ts'))};
import {HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
const params=new URL(location.href).searchParams,scenario=params.get('scenario')??'spec-loss',channel=params.get('channel')??'local';
window.probe={messages:[],effects:[],results:[],suspended:0,errors:[],unhandled:[]};window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const first={riddleId:'classic_1',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false},next={...first,riddleId:'classic_2',sessionToken:'00000000-0000-4000-8000-000000000002',index:2};
function terminal(){let state=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:first});const win=scenario==='spec-win';for(let i=1;i<=(win?1:5);i++)state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:win?['P','I','A','N','O']:['Z','Z','Z','Z','Z'],feedback:Array(5).fill(win?'green':'red')},attempts:i,isCorrect:win,gameOver:win||i===5,canContinue:false});return state;}
window.emit=()=>{const message={type:'host:operationResult',requestId:window.completion.requestId,payload:{operation:'completeGame',ok:true,data:{coinsEarned:0}}};window.dispatchEvent(channel==='local'?new CustomEvent(HOST_TO_GAME_EVENT,{detail:message}):new MessageEvent('message',{origin:location.origin,source:window.parent,data:message}));};
function Game({version}){const [state,dispatch]=React.useReducer(gameSessionReducer,undefined,terminal),stateRef=React.useRef(state);stateRef.current=state;
window.advance=()=>{dispatch({type:'closeModal'});dispatch({type:'loadRiddle',riddle:next});};
const trace=React.useCallback(action=>{window.probe.effects.push({version,type:action.type});dispatch(action);},[version]),post=React.useCallback(message=>{window.probe.messages.push({version,message});if(message.type==='game:completeGame')window.completion=message;},[version]);
const ownerKey=scenario==='account-speculative'&&version==='B'?'Bob:1':'Alice:1';
const receipt=useCompletionDelivery({ownerKey,outcome:state.guessPending?null:state.lastOutcome,dispatch:trace,postToHost:post});
const complete=React.useCallback((ok,id)=>{const accepted=receipt(ok,id);window.probe.results.push(accepted);return accepted;},[receipt]);
const requestRiddle=React.useCallback(()=>post({type:'game:loadRiddle',requestId:'next-'+version,payload:{gameMode:'classic'}}),[post]);
const router=useGameMessageRouter({dispatch:trace,stateRef,postToHost:post,requestRiddle,onCompletionResult:complete});useGameMessageListener({router,postToHost:post});
return <output data-game data-version={version} data-riddle={state.riddle?.riddleId} data-kind={state.lastOutcome?.kind??'none'} data-ack={String(state.completionAcknowledged)}>Game {version}: {state.riddle?.riddleId}, {state.completionAcknowledged?'acknowledged':'pending'}</output>;}
let unblock;const pending=new Promise(resolve=>unblock=resolve);function Suspend({version}){if(version==='B'&&!window.allowB){window.probe.suspended++;throw pending;}return null;}
function App(){const [version,setVersion]=React.useState('A'),[epoch,setEpoch]=React.useState(0);window.speculate=()=>React.startTransition(()=>{window.advance();setVersion('B');});window.commit=()=>{window.allowB=true;unblock();window.advance();setVersion('B');};window.refresh=()=>setEpoch(x=>x+1);
React.useLayoutEffect(()=>{if(version==='B'&&scenario==='commit-next')window.emit();},[version]);
return <div data-epoch={epoch}><React.Suspense fallback={<p>Waiting</p>}><Game version={version}/><Suspend version={version}/></React.Suspense><button data-prepare onClick={()=>window.speculate()}>Prepare next question</button><button data-commit onClick={()=>window.commit()}>Commit next question</button><button data-receipt onClick={()=>window.emit()}>Deliver completion</button></div>;}
await createGameMessageRouter(new Proxy({},{get:()=>()=>{}}))({type:'host:pause',payload:{}});
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'completion-commit-baseline',enforce:'pre',async load(id){if(!baseline)return;const file=id.endsWith('/useCompletionDelivery.ts')?'delivery.before.txt':id.endsWith('/useGameMessageRouter.ts')?'router.before.txt':null;if(file)return readFile(path.join(baseline,file),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.COMPLETION_COMMIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.COMPLETION_COMMIT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const channel of process.env.COMPLETION_COMMIT_CHANNELS?.split(',')??['local','native'])for(const scenario of process.env.COMPLETION_COMMIT_SCENARIOS?.split(',')??['spec-loss','spec-win','commit-next','account-speculative','stable-live']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,channel,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario+'&channel='+channel);await page.waitForFunction(()=>!!window.completion);await page.locator('[data-game]').waitFor();await page.evaluate(()=>window.probe.effects=[]);
  if(scenario.startsWith('spec-')||scenario==='account-speculative'){await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.suspended>0);metric('suspended next question keeps the completed question visible',await page.locator('[data-game]').getAttribute('data-riddle'),'classic_1');metric('suspended next question keeps the committed outcome',await page.locator('[data-game]').getAttribute('data-kind'),scenario==='spec-win'?'win':'loss');await page.locator('[data-receipt]').click();}
  else if(scenario==='commit-next'){await page.locator('[data-commit]').click();await page.waitForFunction(()=>document.querySelector('[data-game]')?.dataset.riddle==='classic_2');}
  else{const before=await page.evaluate(()=>new Set(window.probe.messages.filter(x=>x.message.type==='game:completeGame').map(x=>x.message.requestId)).size);for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-epoch]')?.dataset.epoch===String(i+1),i);}metric('parent updates preserve completion identity',await page.evaluate(()=>new Set(window.probe.messages.filter(x=>x.message.type==='game:completeGame').map(x=>x.message.requestId)).size),before);await page.locator('[data-receipt]').click();}
  await page.waitForTimeout(80);const accepted=!['commit-next','account-speculative'].includes(scenario),next=accepted&&scenario!=='spec-win'?['A']:[];
  metric('receipt belongs to the committed question and allowed account',await page.evaluate(()=>window.probe.results[0]),accepted);
  metric('visible current outcome receives its acknowledgement',await page.locator('[data-game]').getAttribute('data-ack'),String(accepted));
  metric('current receipt rewards exactly once',await page.evaluate(()=>window.probe.effects.filter(x=>x.type==='completionReward').length),accepted?1:0);
  metric('acknowledged loss requests its next question once',await page.evaluate(()=>window.probe.messages.filter(x=>x.message.type==='game:loadRiddle').map(x=>x.version)),next);
  await page.locator('[data-receipt]').click();await page.waitForTimeout(30);metric('replay cannot reward twice',await page.evaluate(()=>window.probe.effects.filter(x=>x.type==='completionReward').length),accepted?1:0);metric('replay cannot request another question',await page.evaluate(()=>window.probe.messages.filter(x=>x.message.type==='game:loadRiddle').map(x=>x.version)),next);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.COMPLETION_COMMIT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.COMPLETION_COMMIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Completion receipts follow the committed outcome');
