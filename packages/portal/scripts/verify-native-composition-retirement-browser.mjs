import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.url);
const {RACE_RULES,LiveRaceViewSchema}=require('@qwordly/core/race');
const {computeFeedback}=require('@qwordly/core/game');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.NATIVE_RETIRE_REACT_MODE??'development';
const fixture=path.join(root,'../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json');
const output=path.resolve(process.env.NATIVE_RETIRE_REPORT_DIR??path.join(root,'../../builds/test-evidence/native-composition-retirement-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/native-composition-retirement-'));
let browser,server,baseUrl;let tickets=new Map(),started=null;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
import {YouTubePlayableApp} from ${JSON.stringify(path.join(root,'src/playable/YouTubePlayableApp.tsx'))};import ${JSON.stringify(path.join(root,'src/playable/styles.css'))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/play/race/RaceTo10Game.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
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
const sdk={inPlayablesEnvironment:true,firstFrameReady(){},gameReady(){},async loadData(){window.probe.loads++;return '';},async saveData(data){if(!window.probe.loads)throw Error('Save before load');window.probe.saves.push(data);},async getLanguage(){return 'en';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(fn){window.pauseGame=fn;return ()=>{};},onResume(fn){window.resumeGame=fn;return ()=>{};},logError(){},logWarning(){}};
app.render(<React.StrictMode>{new URLSearchParams(location.search).has('playable')?<YouTubePlayableApp sdk={sdk}/>:<RaceTo10Game locale="en" ownerId={user} coins={100} matchmaking={adapter(user)} postToHost={postToHost} onClose={()=>{}}/>}</React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',resolve:{alias:{'#youtube-content':fixture}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'native-retire-baseline',async load(id){if(process.env.NATIVE_RETIRE_BASELINE_DIR&&id.endsWith('/YouTubeNativeAnswerInput.tsx'))return readFile(path.join(process.env.NATIVE_RETIRE_BASELINE_DIR,'local-editor.before.txt'),'utf8');if(process.env.NATIVE_RETIRE_BASELINE_DIR&&id.endsWith('/NativeAnswerInput.tsx'))return readFile(path.join(process.env.NATIVE_RETIRE_BASELINE_DIR,'live-editor.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
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
 if(process.env.NATIVE_RETIRE_SERVE_ONLY==='1'){console.log(JSON.stringify({url:baseUrl,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});const quick=process.env.NATIVE_RETIRE_QUICK==='1';
  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const target of process.env.NATIVE_RETIRE_TARGETS?.split(',')??(quick?['playable']:['playable','live']))for(const scenario of process.env.NATIVE_RETIRE_SCENARIOS?.split(',')??(target==='live'?(quick?['pending-composition']:['pending-composition','pending-tail']):(quick?['missing-end']:['missing-end','late-end','committed-tail','fresh-composition']))){
   tickets=new Map();started=null;const context=await browser.newContext({viewport:{width,height}}),a=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,target,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
   if(target==='playable'){await a.goto(baseUrl+'/?playable=1');await a.getByRole('button',{name:/Classic/}).click();await a.locator('.yt-answer-native').waitFor();await a.waitForFunction(()=>window.probe.saves.length===1&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');}
   else {const b=await context.newPage();for(const [page,user] of [[a,'Alice'],[b,'Bob']]){await page.goto(baseUrl+'/?user='+user);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();}await a.locator('.race-gameplay .guess-board').waitFor();}
   const selector=target==='playable'?'.yt-answer-native':'.race-native-answer-input',prefix=target==='playable'?(process.env.NATIVE_RETIRE_MINIMAL==='1'?'':'ro'):'te',suffix=target==='playable'?(process.env.NATIVE_RETIRE_MINIMAL==='1'?'rome':'me'):'st';
   const letters=()=>a.locator(target==='playable'?'.yt-guess-row.current .yt-tile':'.guess-row button').allTextContents().then(values=>values.slice(0,4).join('').toLowerCase());
   await a.locator(selector).focus();
   if(target==='live'){
    await a.keyboard.type(prefix);
    await a.evaluate(({selector,scenario,suffix})=>{const input=document.querySelector(selector);input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value=suffix;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:suffix,isComposing:true,inputType:'insertCompositionText'}));if(scenario==='pending-tail')input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:suffix}));window.holdHintOnce=true;},{selector,scenario,suffix});
    metric('live composition setup preserves its committed prefix',await letters(),scenario==='pending-tail'?prefix+suffix:prefix);
    await a.getByRole('button',{name:/Hint/}).click();await a.waitForFunction(()=>typeof window.releaseReceipt==='function');
    metric('live pending Hint keeps the native editor usable',await a.locator(selector).isDisabled(),false);
    if(scenario==='pending-composition')await a.evaluate(({selector,suffix})=>document.querySelector(selector).dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:suffix})),{selector,suffix});
    await a.evaluate(({selector,suffix})=>{const input=document.querySelector(selector);input.value=suffix;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:suffix,inputType:'insertText'}));},{selector,suffix});
    metric('live composition commits once while the receipt is pending',await letters(),prefix+suffix);
    metric('composition sends no guess',await a.evaluate(()=>window.probe.calls.filter(c=>c.action==='guess').length),0);metric('composition adds no material save',await a.evaluate(()=>window.probe.saves.length),0);
    await a.evaluate(()=>window.releaseReceipt());await a.waitForFunction(()=>document.querySelector('.guess-row button[disabled].green')?.textContent.toLowerCase()==='t');
    metric('live hint receipt preserves the complete composed answer',await letters(),prefix+suffix);
    await a.locator('.guess-row button').nth(3).click();await a.keyboard.press('Enter');await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));
    metric('explicit native Enter advances once',tickets.get('Alice').count,1);metric('explicit native Enter sends one guess',await a.evaluate(()=>window.probe.calls.filter(c=>c.action==='guess').map(c=>c.guess)),[prefix+suffix]);
    metric('no page errors',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
    await a.screenshot({path:path.join(output,[width,height,target,scenario,'settled.png'].join('-'))});await context.close();continue;
   }
   if(scenario!=='committed-tail')await a.keyboard.type(prefix);
   await a.evaluate(({selector,prefix,scenario,minimal})=>{const input=document.querySelector(selector);window.retiringEditor=input;input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));if(minimal)return;input.value=scenario==='committed-tail'?prefix:'xy';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:input.value,isComposing:true,inputType:'insertCompositionText'}));if(scenario==='committed-tail')input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:prefix}));},{selector,prefix,scenario,minimal:process.env.NATIVE_RETIRE_MINIMAL==='1'});
   metric('composition setup retains the committed prefix',await letters(),prefix);
   if(target==='playable')await a.evaluate(()=>window.pauseGame());else{await a.evaluate(()=>{window.holdHintOnce=true;});await a.getByRole('button',{name:/Hint/}).click();}
   await a.waitForFunction(selector=>document.querySelector(selector)?.disabled,selector);metric('interruption disables the same editor',await a.locator(selector).isDisabled(),true);
   if(target==='playable')await a.evaluate(()=>window.resumeGame());else await a.evaluate(()=>window.releaseReceipt());
   await a.waitForFunction(selector=>document.querySelector(selector)?.disabled===false,selector);metric('resume reuses the same editor node',await a.evaluate(selector=>document.querySelector(selector)===window.retiringEditor,selector),true);
   await a.locator(target==='playable'?'.yt-guess-row.current .yt-tile':'.guess-row button').nth(2).click();
   if(scenario==='late-end')await a.evaluate(selector=>{const input=document.querySelector(selector);input.value='e\u0301';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:input.value}));},selector);
   if(scenario==='late-end'||scenario==='committed-tail')await a.evaluate(({selector,text})=>{const input=document.querySelector(selector);input.value=text;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'}));},{selector,text:scenario==='late-end'?'é':prefix});
   if(process.env.NATIVE_RETIRE_BUFFER_CONTROL==='1')await a.evaluate(selector=>{document.querySelector(selector).value='';},selector);metric('retired composition and trailing delivery preserve the answer prefix',await letters(),prefix);
   if(scenario==='fresh-composition'){
    await a.evaluate(({selector,suffix})=>{const input=document.querySelector(selector);input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value=suffix;input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:suffix}));},{selector,suffix});
    await a.evaluate(({selector,suffix})=>{const input=document.querySelector(selector);input.value=suffix;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:suffix,inputType:'insertText'}));},{selector,suffix});
   }else await a.keyboard.type(suffix);
   metric('fresh post-interruption text reaches the complete answer',await letters(),prefix+suffix);
   metric('consumed native value is empty',await a.locator(selector).inputValue(),'');metric('editing sends no guess',await a.evaluate(()=>window.probe.calls.filter(c=>c.action==='guess').length),0);metric('editing adds no material save',await a.evaluate(()=>window.probe.saves.length),target==='playable'?1:0);
   await a.keyboard.press('Enter');
   if(target==='playable'){await a.locator('.yt-result').waitFor();metric('explicit native Enter wins once',await a.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalWins),1);metric('explicit native Enter adds one save',await a.evaluate(()=>window.probe.saves.length),2);}
   else {await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));metric('explicit native Enter advances once',tickets.get('Alice').count,1);metric('explicit native Enter sends one guess',await a.evaluate(()=>window.probe.calls.filter(c=>c.action==='guess').map(c=>c.guess)),[prefix+suffix]);}
   metric('no page errors',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
   await a.screenshot({path:path.join(output,[width,height,target,scenario,'settled.png'].join('-'))});await context.close();
  }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page-'+new URL(page.url()).searchParams.get('user')+'.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,nativeValue:document.querySelector('.yt-answer-native,.race-native-answer-input')?.value,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
