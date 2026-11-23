import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,firefox} from '@playwright/test';
const portal=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.PENDING_SCOPE_MODE??'development',engine=process.env.PENDING_SCOPE_BROWSER??'chromium',evidence=path.resolve(process.env.PENDING_SCOPE_REPORT_DIR??path.join(portal,'../../builds/test-evidence/pending-play-scope-retirement-2026-10-06',engine+'-'+mode));await mkdir(evidence,{recursive:true});assert.ok(['development','production'].includes(mode));assert.ok(['chromium','firefox'].includes(engine));const observations=[];let browserVersion;
await mkdir(path.join(portal,'node_modules/.cache'),{recursive:true});const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/pending-scope-retirement-'));let browser,server,result;
try{
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useProvisionalPlayRecovery} from ${JSON.stringify(path.join(portal,'src/play/game/hooks/useProvisionalPlayRecovery.ts'))};
import {gameSessionReducer,createInitialGameSession} from ${JSON.stringify(path.join(portal,'../hosted/src/play/gameSession.ts'))};
import {createPendingPlayJournalStorage} from ${JSON.stringify(path.join(portal,'../hosted/src/play/pendingPlayJournalDiagnostics.ts'))};
import {pendingPlayScope} from ${JSON.stringify(path.join(portal,'../hosted/src/play/pendingGuessJournal.ts'))};
import {ControlledGuessBoard,ControlledKeyboard} from ${JSON.stringify(path.join(portal,'src/play/GameFrameControls.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(portal,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const [replacement,operation]=new URLSearchParams(location.search).get('scenario').split(':');window.probe={messages:[],leases:[],intervals:[],actions:[],errors:[],unhandled:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const user={uid:'Alice',isAnonymous:true,accountGeneration:1},profile={username:'Alice',coins:570,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1};const first={riddleId:'classic_1',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'piano',locale:'en'}};
function seed(){let state=gameSessionReducer(createInitialGameSession(),{type:'hostInit',locale:'en',gameMode:'classic',user,profile,products:[]});state=gameSessionReducer(state,{type:'loadRiddle',riddle:first});if(operation==='continue')for(let attempts=1;attempts<=5;attempts++)state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:[...'PIZZA'],feedback:Array(5).fill('red')},attempts,isCorrect:false,gameOver:false,canContinue:attempts===5});return state;}
const storage=createPendingPlayJournalStorage(localStorage);let now=0;const adapters={journal:{...storage,acquire:(scope,owner,time)=>{window.probe.leases.push(scope);return storage.acquire(scope,owner,time);}},clock:{now:()=>now,setTimeout:(fn,ms)=>window.setTimeout(fn,ms),clearTimeout:id=>window.clearTimeout(id),setInterval:(fn,ms)=>{window.probe.intervals.push({fn,ms});return window.probe.intervals.length;},clearInterval:id=>{window.probe.intervals[id-1].cleared=true;}}};
function App(){const [state,reduce]=React.useReducer(gameSessionReducer,undefined,seed),[replace,setReplace]=React.useState(false),stateRef=React.useRef(state);stateRef.current=state;
 const dispatch=React.useCallback(action=>{window.probe.actions.push(action);reduce(action);},[]);
 const post=React.useCallback(message=>window.probe.messages.push({actor:stateRef.current.user?.uid??null,generation:stateRef.current.user?.accountGeneration??null,locale:stateRef.current.locale,message}),[]);
 const recovery=useProvisionalPlayRecovery({state,stateRef,dispatch,postToHost:post,playFeedback:()=>{},adapters});
 window.originalScope=pendingPlayScope('Alice',1,'en');window.readOriginalJournal=()=>storage.read(window.originalScope);
 window.start=()=>operation==='guess'?recovery.submitGuess():operation==='hint'?recovery.requestHint():operation==='continue'?recovery.requestContinue():recovery.requestSkip();
 window.replace=()=>{setReplace(true);if(['account','generation','logout'].includes(replacement))dispatch({type:'authState',user:replacement==='logout'?null:{...user,uid:replacement==='account'?'Bob':'Alice',accountGeneration:replacement==='generation'?2:1},profile});else if(replacement==='locale')dispatch({type:'hostInit',locale:'fr',gameMode:'classic',user,profile,products:[]});else if(replacement==='profile')dispatch({type:'profileUpdated',profile:{...profile,coins:800,username:'Updated profile'}});
 if(['account','generation','locale','question'].includes(replacement))dispatch({type:'loadRiddle',riddle:{...first,index:2,riddleId:'classic_2',sessionToken:'00000000-0000-4000-8000-000000000002'}});};
 React.useLayoutEffect(()=>{if(replace){now=25000;window.probe.intervals[0].fn();}},[replace]);
 return <main data-owner={state.user?.uid} data-draft={state.currentLetters.join('')}><ControlledGuessBoard answerLength={5} currentLetters={state.currentLetters} activeSlotIndex={state.activeSlotIndex} guesses={state.guesses} hintRevealedIndices={state.hintRevealedIndices} onSelectSlot={index=>dispatch({type:'selectSlot',index})}/><ControlledKeyboard letterStates={state.letterStates} onLetter={letter=>dispatch({type:'typeLetter',letter})} onBackspace={()=>dispatch({type:'backspace'})}/><button data-submit disabled={operation==='guess'&&!recovery.canSubmit} onClick={window.start}>Submit fixture</button><button data-replace onClick={window.replace}>Replace account fixture</button></main>;
}createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
await build({root:scratch,configFile:false,publicDir:path.join(portal,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'pending-scope-baseline',enforce:'pre',async load(id){if(process.env.PENDING_SCOPE_BASELINE_FILE&&id.endsWith('/useProvisionalPlayRecovery.ts'))return readFile(process.env.PENDING_SCOPE_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.webm':'audio/webm'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await(engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'&&process.env.PENDING_SCOPE_FIREFOX_EXECUTABLE?{executablePath:process.env.PENDING_SCOPE_FIREFOX_EXECUTABLE}:{})});browserVersion=browser.version();
const origin='http://127.0.0.1:'+server.address().port;
const scenarios=process.env.PENDING_SCOPE_SCENARIOS?.split(',')??['account','generation','locale','logout','profile','question','none'].flatMap(kind=>['guess','hint','continue','skip'].map(operation=>kind+':'+operation));
for(const [width,height] of process.env.PENDING_SCOPE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of scenarios){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
 const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});const [replacement,operation]=scenario.split(':');
 await page.goto(origin+'/?scenario='+scenario);await page.locator('[data-owner=Alice]').waitFor();
 if(operation==='guess')for(const letter of 'PIZZA')await page.locator('.keyboard .key').filter({hasText:new RegExp('^'+letter+'$')}).first().click();
 await page.locator('[data-submit]').click();await page.waitForFunction(()=>window.probe.intervals.length===1);
 const queued=()=>page.evaluate(()=>window.probe.messages.filter(x=>['game:submitGuess','game:requestHint','game:spendCoins','game:skipRiddle'].includes(x.message.type)));
 const before=await queued();metric('native action admits one original queued operation',before.length,1);metric('original action uses Alice and its issued question',[before[0]?.actor,before[0]?.generation,before[0]?.locale,before[0]?.message.payload.sessionToken],['Alice',1,'en','00000000-0000-4000-8000-000000000001']);
 await page.locator('[data-replace]').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const after=await queued(),revoked=['account','generation','locale','logout'].includes(replacement);metric('scope revocation rejects retry before network delivery',after.length,revoked?1:2);
 metric('same-scope retries preserve the exact idempotency request',after.map(x=>x.message.requestId),Array(revoked?1:2).fill(before[0].message.requestId));
 metric('no retry can acquire a lease under another scope',await page.evaluate(()=>window.probe.leases.filter(scope=>scope!==window.originalScope)),[]);
 metric('original queued action remains durable for its originating player',await page.evaluate(operation=>{const journal=window.readOriginalJournal();return operation==='guess'?journal?.queue[0]?.message.requestId:journal?.coinAction?.requestId;},operation),before[0].message.requestId);
 if(revoked)metric('scope cleanup retires the old lease interval',await page.evaluate(()=>window.probe.intervals[0].cleared),true);
 metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);metric('self-contained injected harness',external,[]);
 await page.screenshot({path:path.join(evidence,[width,height,scenario.replace(':','-')].join('-')+'.png')});await context.close();
}
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,engine,browserVersion,cases:new Set(observations.map(x=>[x.width,x.height,x.scenario].join(':'))).size,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'Pending-play retry scope retirement');
