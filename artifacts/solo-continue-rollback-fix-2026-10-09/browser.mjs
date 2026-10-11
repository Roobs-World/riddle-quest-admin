/** Real router, reducer and durable journal regression for paid receipts and cancelled delivery clocks.
 * Timers retain callbacks after cancellation to reproduce the commit-before-passive-cleanup boundary.
 * Strict Mode cold restoration and account return exercise exact lifetime ownership. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '../../node_modules/.pnpm/vite@8.3.1_@types+node@26.6.3_@vitejs+devtools@0.7.6_yaml@2.9.1/node_modules/vite/dist/node/index.js';
import {chromium,firefox} from '../../node_modules/.pnpm/@playwright+test@1.63.0/node_modules/@playwright/test/index.mjs';
const portal=path.resolve('packages/portal'),mode=process.env.PENDING_LIFE_MODE??'development',engine=process.env.PENDING_LIFE_BROWSER??'chromium',evidence=path.resolve(process.env.PENDING_LIFE_REPORT_DIR??path.join(portal,'../../artifacts/journal-write-deduplication-browser',engine+'-'+mode));await mkdir(evidence,{recursive:true});assert.ok(['development','production'].includes(mode));assert.ok(['chromium','firefox'].includes(engine));const observations=[],storageTrace=[];let browserVersion;
await mkdir(path.join(portal,'node_modules/.cache'),{recursive:true});const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/pending-play-lifetime-'));let browser,server;
try{
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useGameMessageRouter} from ${JSON.stringify(path.join(portal,'src/play/useGameMessageRouter.ts'))};
import {useGameMessageListener} from ${JSON.stringify(path.join(portal,'src/play/game/hooks/useGameBridgeLifecycle.ts'))};
import {HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(portal,'src/play/localBridge.ts'))};
import {useProvisionalPlayRecovery} from ${JSON.stringify(path.join(portal,'src/play/game/hooks/useProvisionalPlayRecovery.ts'))};
import {gameSessionReducer,createInitialGameSession} from ${JSON.stringify(path.join(portal,'src/play/gameSession.ts'))};
import {createPendingPlayJournalStorage,pendingPlayScope} from ${JSON.stringify(path.join(portal,'src/play/pendingGuessJournal.ts'))};
import {ControlledGuessBoard,ControlledKeyboard} from ${JSON.stringify(path.join(portal,'src/play/GameFrameControls.tsx'))};
import {CONTINUE_COIN_COST} from ${JSON.stringify(path.join(portal,'src/play/modalPages/commerce/commerceCosts.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(portal,'src/styles.css'))};
window.setTime=value=>{now=value;};window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const [replacement,operation]=new URLSearchParams(location.search).get('scenario').split(':');window.probe={messages:[],journalWrites:[],routed:0,leases:[],intervals:[],timeouts:[],actions:[],errors:[],unhandled:[],passiveRetired:false};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const user={uid:'Alice',isAnonymous:true,accountGeneration:1},profile={username:'Alice',coins:570,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1};const first={riddleId:'classic_1',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:true,revealedHints:[{index:0,letter:'P'}],evaluation:{answer:'piano',locale:'en'}};
function seed(){let state=gameSessionReducer(createInitialGameSession(),{type:'hostInit',locale:'en',gameMode:'classic',user,profile,products:[]});state=gameSessionReducer(state,{type:'loadRiddle',riddle:new URLSearchParams(location.search).get('bad')==='keyboard'?{...first,revealedHints:[{index:0,letter:'P'}]}:new URLSearchParams(location.search).has('confirmed')?{...first,attemptsUsed:1,acceptedGuesses:[{attempt:1,feedback:[...'PIZZA'].map(letter=>({letter,status:'red'}))}]}:first});if(operation==='continue')for(let attempts=1;attempts<=5;attempts++)state=gameSessionReducer(state,{type:'guessResolved',feedback:{guess:[...'PIZZA'],feedback:Array(5).fill('red')},attempts,isCorrect:false,gameOver:false,canContinue:attempts===5});return state;}
const storage=createPendingPlayJournalStorage({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{if(key.startsWith('riddleQuest:pendingPlay:v1:'))window.probe.journalWrites.push(value);localStorage.setItem(key,value);},removeItem:key=>localStorage.removeItem(key)});let now=new URLSearchParams(location.search).has('rollbackClock')?100000:0;const adapters={journal:{...storage,acquire:(scope,owner,time)=>{window.probe.leases.push(scope);return storage.acquire(scope,owner,time);}},clock:{now:()=>now,setTimeout:(fn,ms)=>{window.probe.timeouts.push({fn,ms});return window.probe.timeouts.length;},clearTimeout:id=>{window.probe.timeouts[id-1].cleared=true;},setInterval:(fn,ms)=>{window.probe.intervals.push({fn,ms});return window.probe.intervals.length;},clearInterval:id=>{window.probe.intervals[id-1].cleared=true;}}};
const state=seed();const {currentLetters,activeSlotIndex,guesses,engineSnapshot,modal,lastOutcome,completionAcknowledged,letterStates,profile:baseProfile,lastRewards,optimisticAchievementIds}=state;
const bad=new URLSearchParams(location.search).get('bad');const base={currentLetters,activeSlotIndex,guesses,engineSnapshot,modal,lastOutcome,completionAcknowledged,letterStates,profile:baseProfile,lastRewards,optimisticAchievementIds};
const draft=bad==='null'?[null,'','','','']:bad==='object'?[{},'','','','']:bad==='multiple'?['AB','','','','']:bad==='locked'?['A','I','','','']:['P','I','','',''];
window.expectedDraft=bad==='locked'||bad==='valid'?'PI':'P';window.expectedCoins=profile.coins-CONTINUE_COIN_COST;
window.originalMessage={type:'game:spendCoins',requestId:'continue-receipt-0001',payload:{reason:'continue',gameMode:'classic',riddleId:first.riddleId,sessionToken:first.sessionToken,amount:CONTINUE_COIN_COST}};
storage.write({version:1,scope:pendingPlayScope('Alice',1,'en'),confirmedClassicIndex:1,riddle:first,base,draft,draftActiveSlotIndex:2,successors:[],queue:[],coinAction:window.originalMessage});


function Frame(){const [state,reduce]=React.useReducer(gameSessionReducer,undefined,seed),[replace,setReplace]=React.useState(0),stateRef=React.useRef(state);stateRef.current=state;
 const dispatch=React.useCallback(action=>{window.probe.actions.push(action);reduce(action);},[]);
 const post=React.useCallback(message=>window.probe.messages.push({actor:stateRef.current.user?.uid??null,generation:stateRef.current.user?.accountGeneration??null,locale:stateRef.current.locale,message}),[]);
 const recovery=useProvisionalPlayRecovery({state,stateRef,dispatch,postToHost:post,playFeedback:()=>{},adapters});
 const router=useGameMessageRouter({dispatch,stateRef,postToHost:post,requestRiddle:recovery.requestRiddle,onGuessResult:recovery.handleQueuedGuessResult,acceptRiddleResult:recovery.acceptRiddleResult});const trackedRouter=React.useCallback(async(...args)=>{try{return await router(...args);}finally{window.probe.routed++;}},[router]);useGameMessageListener({router:trackedRouter,postToHost:post});
 window.emit=message=>window.dispatchEvent(new CustomEvent(HOST_TO_GAME_EVENT,{detail:message}));window.current=()=>({uid:state.user?.uid,generation:state.user?.accountGeneration,locale:state.locale,hints:state.hintRevealedIndices,notice:state.notice,token:state.riddle?.sessionToken,index:state.riddle?.index,draft:state.currentLetters.join(''),coins:state.profile?.coins,pending:recovery.coinActionsReady,actions:window.probe.actions,rows:state.guesses,terminal:state.engineSnapshot?.gameOver,continued:state.engineSnapshot?.hasUsedContinue,pendingSpend:state.pendingCoinSpend,attempts:state.engineSnapshot?.attemptsUsed,slot:state.activeSlotIndex,paused:state.paused,riddleId:state.riddle?.riddleId,letterStates:state.letterStates,modal:state.modal,lastOutcome:state.lastOutcome,lastRewards:state.lastRewards,optimisticAchievementIds:state.optimisticAchievementIds,completionAcknowledged:state.completionAcknowledged});
 window.originalScope=pendingPlayScope('Alice',1,'en');window.readOriginalJournal=()=>storage.read(window.originalScope);
 window.start=()=>operation==='guess'?recovery.submitGuess():operation==='hint'?recovery.requestHint():operation==='continue'?recovery.requestContinue():recovery.requestSkip();
 window.replace=()=>{const replacement=window.nextReplacement??new URLSearchParams(location.search).get('scenario').split(':')[0];setReplace(value=>value+1);if(['account','generation','logout','return'].includes(replacement))dispatch({type:'authState',user:replacement==='logout'?null:{...user,uid:replacement==='account'?'Bob':'Alice',accountGeneration:replacement==='generation'?2:1},profile:{...profile,username:replacement==='return'?'Alice':'Bob',coins:replacement==='return'?570:900}});else if(replacement==='locale')dispatch({type:'hostInit',locale:'fr',gameMode:'classic',user,profile,products:[]});else if(replacement==='profile')dispatch({type:'profileUpdated',profile:{...profile,coins:800,username:'Updated profile'}});
 if(['account','generation','locale','question','return'].includes(replacement))dispatch({type:'loadRiddle',riddle:replacement==='return'?first:{...first,index:2,riddleId:'classic_2',sessionToken:'00000000-0000-4000-8000-000000000002'}});};
 React.useLayoutEffect(()=>{if(replace){window.probe.actorAtReceipt=stateRef.current.user?.uid;window.commitFn?.();}},[replace]);
 React.useEffect(()=>{window.probe.passiveRetired=false;return()=>{window.probe.passiveRetired=true;};},[]);
 window.exerciseRollback=kind=>{
  if(kind==='shop')dispatch({type:'openModal',modal:'shop'});
  else if(kind!=='ordinary'){
   let riddle={...first};
   if(kind==='hint')riddle.revealedHints=[{index:0,letter:'P'},{index:1,letter:'I'}];
   else if(kind==='grant')riddle={...riddle,hasUsedContinue:true,awaitingContinue:false};
   else {const count=kind==='win5'?5:6;riddle={...riddle,attemptsUsed:count,hasUsedContinue:count===6,awaitingContinue:false,
    acceptedGuesses:Array.from({length:count},(_,index)=>({attempt:index+1,feedback:[...(index===count-1&&kind!=='loss'?'PIANO':'PIZZA')].map(letter=>({letter,status:index===count-1&&kind!=='loss'?'green':'red'}))}))};}
   dispatch({type:'loadRiddle',riddle});
  }
  window.emit({type:'host:operationResult',requestId:window.originalMessage.requestId,payload:{operation:'spendCoins',ok:false,error:'Fixture rejection',errorKind:'rejected'}});
 };
 return <main data-token={state.riddle?.sessionToken} data-ready={recovery.coinActionsReady} data-coins={state.profile?.coins} data-owner={state.user?.uid} data-draft={state.currentLetters.join('')}><ControlledGuessBoard answerLength={5} currentLetters={state.currentLetters} activeSlotIndex={state.activeSlotIndex} guesses={state.guesses} hintRevealedIndices={state.hintRevealedIndices} onSelectSlot={index=>dispatch({type:'selectSlot',index})}/><ControlledKeyboard letterStates={state.letterStates} onLetter={letter=>dispatch({type:'typeLetter',letter})} onBackspace={()=>dispatch({type:'backspace'})}/><button data-submit disabled={operation==='guess'&&!recovery.canSubmit} onClick={window.start}>Submit fixture</button><button data-replace onClick={window.replace}>Replace account fixture</button></main>;
}
function App(){const [mounted,setMounted]=React.useState(true);React.useLayoutEffect(()=>{if(!mounted){window.probe.callbackBeforePassiveCleanup=!window.probe.passiveRetired;now=25000;window.retainedTimer.fn();}},[mounted]);return <><button data-retire onClick={()=>setMounted(false)}>Retire fixture</button>{mounted?<Frame/>:<output data-retired>Retired fixture</output>}</>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
await build({root:scratch,configFile:false,publicDir:path.join(portal,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'pending-scope-baseline',enforce:'pre',async load(id){if(process.env.PENDING_LIFE_BASELINE_FILE&&id.endsWith('/pendingGuessJournal.ts'))return readFile(process.env.PENDING_LIFE_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.webm':'audio/webm'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await(engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'&&process.env.PENDING_LIFE_FIREFOX_EXECUTABLE?{executablePath:process.env.PENDING_LIFE_FIREFOX_EXECUTABLE}:{})});browserVersion=browser.version();
const origin='http://127.0.0.1:'+server.address().port;
for(const width of [390,1280])for(const kind of ['hint','grant','win','loss','win5','shop','ordinary']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
 await page.goto(origin+'/?scenario=none:continue&bad=valid');
 await page.waitForFunction(()=>window.probe.messages.some(x=>x.message.type==='game:spendCoins')&&window.current().continued);
 const metric=(name,actual,expected)=>observations.push({width,kind,name,actual,expected});
 const expected=await page.evaluate(()=>window.originalMessage);
 metric('original request before rollback',await page.evaluate(()=>window.readOriginalJournal().coinAction),expected);
 await page.evaluate(()=>{window.setTime(25000);window.probe.intervals.at(-1).fn();});
 metric('retry remains exact',await page.evaluate(()=>window.probe.messages.filter(x=>x.message.type==='game:spendCoins').at(-1).message),expected);
 await page.evaluate(kind=>window.exerciseRollback(kind),kind);
 await page.waitForFunction(()=>window.current().pendingSpend===null);
 const current=await page.evaluate(()=>window.current());
 const terminal=['win','loss','win5'].includes(kind),confirmedGrant=['grant','win','loss'].includes(kind);
 metric('host grant survives only when confirmed',current.continued,confirmedGrant);
 metric('terminal proof survives',current.terminal,terminal);
 metric('current attempt count survives',current.attempts,kind==='win'||kind==='loss'?6:5);
 metric('current outcome survives',current.lastOutcome?.kind??null,kind==='loss'?'loss':kind==='win'||kind==='win5'?'win':null);
 metric('modal ownership survives',current.modal,kind==='shop'?'shop':kind==='win'||kind==='win5'?'victory':kind==='grant'||kind==='loss'?null:'continue');
 if(kind==='hint'){metric('new hint glyph survives',current.draft,'PI');metric('new hint lock survives',current.hints,[0,1]);metric('new keyboard knowledge survives',current.letterStates.i,'green');}
 metric('ordinary refund policy retained',current.coins,570);
 metric('paid receipt retired',await page.evaluate(()=>Boolean(window.readOriginalJournal()?.coinAction)),false);
 metric('no browser errors',await page.evaluate(()=>[...window.probe.errors,...window.probe.unhandled]),[]);
 await page.screenshot({path:path.join(evidence,width+'-'+kind+'.png')});await context.close();
}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({engine,mode,browserVersion,journeys:14,checks:observations.length,failures},null,2));assert.equal(failures.length,0);
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(evidence,'storage-trace.json'),JSON.stringify(storageTrace,null,2));await writeFile(path.join(evidence,'observations.json'),JSON.stringify({engine,mode,browserVersion,observations},null,2)+'\n');}
