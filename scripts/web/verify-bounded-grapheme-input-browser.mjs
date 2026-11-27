import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.url);
const {RACE_RULES,LiveRaceViewSchema}=require("../../firebase-functions/lib/src/races/contracts/index.js");
const {computeFeedback}=require('../../firebase-functions/lib/src/gameplay/rules/computeFeedback.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.BOUNDED_GRAPHEME_REACT_MODE??'development';
const fixture=path.join(root,'firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json');
const output=path.resolve(process.env.BOUNDED_GRAPHEME_REPORT_DIR??path.join(root,'builds/test-evidence/bounded-grapheme-input-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/bounded-grapheme-input-'));
let browser,server,baseUrl;let tickets=new Map(),started=null;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
import {YouTubePlayableApp} from ${JSON.stringify(path.join(root,"src/gameplay/components/local/LocalGameApp.tsx"))};import ${JSON.stringify(path.join(root,"src/gameplay/styles/local-game.css"))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root,"src/races/components/recorded/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const services=createFakeRaceServices(),user=new URLSearchParams(location.search).get('user')??'Alice';
window.probe={calls:[],saves:[],loads:0,errors:[],unhandled:[]};window.probe.segmentYields=0;window.probe.countSegments=false;
const segment=Intl.Segmenter.prototype.segment;
Intl.Segmenter.prototype.segment=function(...args){const segments=segment.apply(this,args);if(!window.probe.countSegments)return segments;const iterate=segments[Symbol.iterator].bind(segments);Object.defineProperty(segments,Symbol.iterator,{value:()=>{const iterator=iterate();return {next(){const value=iterator.next();if(!value.done)window.probe.segmentYields++;return value;},return(){return iterator.return?.()??{done:true};},[Symbol.iterator](){return this;}};}});return segments;};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
function adapter(owner){return {find:async()=>({status:'cancelled'}),live:{join:input=>call(owner,'join',input),update:input=>call(owner,'update',input)}};}
async function call(owner,operation,input){window.probe.calls.push({owner,operation,...input});
 const response=await fetch('/live/'+operation,{method:'POST',body:JSON.stringify({user:owner,...input})});const result=await response.json();if(!response.ok)throw Object.assign(new Error('Rejected fixture request'),{code:result.code});
 const hold=input.action==='poll'&&window.holdPollOnce||input.action==='guess'&&window.holdGuessOnce||input.action==='hint'&&window.holdHintOnce||input.action==='skip'&&window.holdSkipOnce;
 if(hold){window.holdPollOnce=window.holdGuessOnce=window.holdHintOnce=window.holdSkipOnce=false;return new Promise((resolve,reject)=>{window.releaseReceipt=()=>resolve(result);window.failReceipt=()=>reject(new Error('Lost reply'));});}
 return result;
}
async function postToHost(message){if(message.type==='game:listRaceCategories')window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:await services.listRaceCategories({locale:'en'})}}}));}
window.otherTab=(action,guess='test')=>fetch('/live/update',{method:'POST',body:JSON.stringify({user,ticketId:'a'.repeat(64),action,riddleId:'q0',guess,requestId:'other-tab-'+action+'-'+Date.now()})}).then(r=>r.json());
const app=createRoot(document.querySelector('#root'));
const sdk={inPlayablesEnvironment:true,firstFrameReady(){},gameReady(){},async loadData(){window.probe.loads++;return '';},async saveData(data){if(!window.probe.loads)throw Error('Save before load');window.probe.saves.push(data);},async getLanguage(){return 'en';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(){return ()=>{};},onResume(){return ()=>{};},logError(){},logWarning(){}};
app.render(<React.StrictMode>{new URLSearchParams(location.search).has('playable')?<YouTubePlayableApp sdk={sdk}/>:<RaceTo10Game locale="en" ownerId={user} coins={100} matchmaking={adapter(user)} postToHost={postToHost} onClose={()=>{}}/>}</React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',resolve:{alias:{'#youtube-content':fixture}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'bounded-grapheme-baseline',async load(id){if(process.env.BOUNDED_GRAPHEME_BASELINE_DIR&&['/NativeAnswerInput.tsx','/raceInput.ts','/localInput.ts'].some(name=>id.endsWith(name)))return readFile(path.join(process.env.BOUNDED_GRAPHEME_BASELINE_DIR,id.endsWith('/raceInput.ts')?'raceInput.before.txt':id.endsWith('/localInput.ts')?'playable-input.before.txt':'NativeAnswerInput.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 const state=user=>{
  const ticket=tickets.get(user),rival=[...tickets.values()].find(t=>t.user!==user),now=Date.now(),phase=ticket.left?'cancelled':started?'racing':'searching';
  const identity=t=>({displayName:t.user,avatarUrl:null,bot:false,correctCount:t.count});
  const run=phase==='racing'?{runId:ticket.id,role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,
   correctCount:ticket.count,wallElapsedMs:now-started,totalPenaltyMs:ticket.penalty,adjustedElapsedMs:now-started+ticket.penalty,events:ticket.events,
   currentRiddle:{riddleId:'q'+ticket.count,text:'A four-letter browser answer',answerLength:4,position:ticket.count,guessesUsed:ticket.guesses.length,guessesRemaining:5-ticket.guesses.length,hintAvailable:true,revealedLetters:ticket.hints,confirmedGuesses:ticket.guesses},
   opponent:rival?{displayName:rival.user,adjustedFinishMs:300000,events:[]}:undefined}:null;
  return LiveRaceViewSchema.parse({ticketId:ticket.id,phase,serverNowMs:now,searchEndsAtMs:ticket.created+60000,startsAtMs:started,player:identity(ticket),opponent:rival?identity(rival):null,run,result:null,rewardCoins:0});
 };
 server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/live/')){
   let body='';for await(const part of req)body+=part;const input=JSON.parse(body);
   if(url.pathname==='/live/join'&&!tickets.has(input.user)){tickets.set(input.user,{user:input.user,id:(input.user==='Alice'?'a':input.user==='Bob'?'b':'c').repeat(64),count:0,penalty:0,events:[],guesses:[],hints:[],accepted:new Set(),created:Date.now(),left:false});if(tickets.size===2)started=Date.now()-1000;}
   const ticket=tickets.get(input.user);if(!ticket)throw Error('No owned seat');
   if(['guess','hint','skip'].includes(input.action)&&!ticket.accepted.has(input.requestId)&&input.riddleId!=='q'+ticket.count){res.writeHead(409,{'content-type':'application/json'}).end(JSON.stringify({code:'functions/failed-precondition'}));return;}
   if(['guess','hint','skip'].includes(input.action)&&!ticket.accepted.has(input.requestId)){
    ticket.accepted.add(input.requestId);const wall=Date.now()-started;
    if(input.action==='guess'){if(input.guess.toLowerCase()==='test'){ticket.count++;ticket.guesses=[];ticket.hints=[];}else {ticket.guesses.push({guess:[...input.guess.toLowerCase()],feedback:computeFeedback(input.guess,'test','en')});if(ticket.guesses.length===RACE_RULES.maxGuessesPerRiddle){ticket.penalty+=RACE_RULES.skipPenaltyMs;ticket.events.push({sequence:ticket.events.length,type:'skip',riddlePosition:ticket.count,wallElapsedMs:wall,penaltyAddedMs:RACE_RULES.skipPenaltyMs,totalPenaltyMs:ticket.penalty,adjustedElapsedMs:wall+ticket.penalty,correctCount:ticket.count+1});ticket.count++;ticket.guesses=[];ticket.hints=[];}}}
    if(input.action==='hint'||input.action==='skip'){
     const skip=input.action==='skip',penalty=skip?RACE_RULES.skipPenaltyMs:RACE_RULES.hintPenaltyMs;ticket.penalty+=penalty;
     ticket.events.push({sequence:ticket.events.length,type:skip?'skip':'hint',riddlePosition:ticket.count,wallElapsedMs:wall,penaltyAddedMs:penalty,totalPenaltyMs:ticket.penalty,adjustedElapsedMs:wall+ticket.penalty,correctCount:ticket.count+Number(skip)});
     if(skip){ticket.count++;ticket.guesses=[];ticket.hints=[];}else ticket.hints=[{index:0,letter:'t'}];
    }
   }
   if(input.action==='leave')ticket.left=true;
   res.setHeader('content-type','application/json');res.end(JSON.stringify(state(input.user)));return;
  }
  const file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));
 }catch(error){res.writeHead(500).end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));baseUrl='http://127.0.0.1:'+server.address().port;
 if(process.env.BOUNDED_GRAPHEME_SERVE_ONLY==='1'){console.log(JSON.stringify({url:baseUrl,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});const quick=process.env.BOUNDED_GRAPHEME_QUICK==='1';

  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const target of process.env.BOUNDED_GRAPHEME_TARGETS?.split(',')??['playable','live'])for(const scenario of quick?['paste']:['paste','composition','hint']){
   tickets=new Map();started=null;const context=await browser.newContext({viewport:{width,height}}),a=await context.newPage();
   const metric=(name,actual,expected,measurement)=>{observations.push({width,height,target,scenario,name,actual,expected,...(measurement?{measurement}: {})});assert.deepEqual(actual,expected,name);};
   if(target==='playable'){await a.goto(baseUrl+'/?playable=1');await a.getByRole('button',{name:/Classic/}).click();await a.locator('.yt-answer-native').waitFor();await a.waitForFunction(()=>window.probe.saves.length===1&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');}
   else {const b=await context.newPage();for(const [page,user] of [[a,'Alice'],[b,'Bob']]){await page.goto(baseUrl+'/?user='+user);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();}await a.locator('.race-gameplay .guess-board').waitFor();}
   const selector=target==='playable'?'.yt-answer-native':'.race-native-answer-input',answer=target==='playable'?'rome':'test',text=answer+'x'.repeat(20000);
   const letters=()=>a.locator(target==='playable'?'.yt-guess-row.current .yt-tile':'.guess-row button').allTextContents().then(values=>values.slice(0,4).join('').toLowerCase());
   await a.locator(selector).focus();
   if(scenario==='hint'){await a.getByRole('button',{name:/Hint/}).click();await a.waitForFunction(target=>document.querySelector(target==='playable'?'.yt-tile.hinted':'.guess-row button[disabled].green')?.textContent.toLowerCase()===(target==='playable'?'r':'t'),target);await a.locator(selector).focus();}
   const work=await a.evaluate(({selector,text,scenario})=>{const input=document.querySelector(selector);window.probe.segmentYields=0;window.probe.countSegments=true;const inputText=scenario==='hint'?text.slice(1):text;input.value=inputText;if(scenario==='composition'){input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:input.value}));}else input.dispatchEvent(new InputEvent('input',{bubbles:true,data:input.value,inputType:'insertFromPaste'}));window.probe.countSegments=false;return {inputLength:inputText.length,segments:window.probe.segmentYields};},{selector,text,scenario});
   metric('long committed text preserves the bounded answer',await letters(),answer);
   const timing=await a.evaluate(({selector,text})=>{const input=document.querySelector(selector),samples=[];window.probe.countSegments=false;for(let repeat=0;repeat<9;repeat++){for(let index=0;index<4;index++)input.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));const start=performance.now();input.value=text;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertFromPaste'}));samples.push(performance.now()-start);}samples.shift();return {samplesMs:samples,medianMs:[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]};},{selector,text:scenario==='hint'?text.slice(1):text});
   metric('ignored suffix does not require full grapheme enumeration',work.segments<=64,true,{...work,...timing});
   metric('input cannot submit a guess',await a.evaluate(()=>window.probe.calls.filter(call=>call.action==='guess').length),0);
   metric('input cannot add a material save',await a.evaluate(()=>window.probe.saves.length),target==='playable'?(scenario==='hint'?2:1):0);
   metric('consumed native value is empty',await a.locator(selector).inputValue(),'');
   for(let index=0;index<4;index++)await a.keyboard.press('Backspace');
   await a.locator(target==='playable'?'.yt-guess-row.current .yt-tile:not([disabled])':'.guess-row button:not([disabled])').first().click();await a.keyboard.type(scenario==='hint'?answer.slice(1):answer);await a.keyboard.press('Enter');
   if(target==='playable'){await a.locator('.yt-result').waitFor();metric('fresh explicit answer wins once',await a.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalWins),1);metric('fresh explicit answer is scored once',await a.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalGuessesInWins),1);}
   else {await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));metric('fresh explicit answer advances once',tickets.get('Alice').count,1);metric('fresh explicit answer is sent once',await a.evaluate(()=>window.probe.calls.filter(call=>call.action==='guess').map(call=>call.guess)),[answer]);}
   metric('no page errors',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
   await a.screenshot({path:path.join(output,[width,height,target,scenario,'settled.png'].join('-'))});await context.close();
  }

 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page-'+new URL(page.url()).searchParams.get('user')+'.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
