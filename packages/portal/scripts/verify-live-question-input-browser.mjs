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
const mode=process.env.LIVE_QUESTION_REACT_MODE??'development';
const output=path.resolve(process.env.LIVE_QUESTION_REPORT_DIR??path.join(root,'../../builds/test-evidence/live-question-input-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-question-input-'));
let browser,server,baseUrl;let tickets=new Map(),started=null;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/play/race/RaceTo10Game.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
const services=createFakeRaceServices(),user=new URLSearchParams(location.search).get('user')??'Alice';
window.probe={calls:[],errors:[],unhandled:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
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
app.render(<React.StrictMode><RaceTo10Game locale="en" ownerId={user} coins={100} matchmaking={adapter(user)} postToHost={postToHost} onClose={()=>{}}/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-question-baseline',async load(id){if(process.env.LIVE_QUESTION_BASELINE_FILE&&id.endsWith('/race/components/RaceGameplay.tsx'))return readFile(process.env.LIVE_QUESTION_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
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
 if(process.env.LIVE_QUESTION_SERVE_ONLY==='1'){console.log(JSON.stringify({url:baseUrl,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});const quick=process.env.LIVE_QUESTION_QUICK==='1';

  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of quick?['correct']:['correct','skip','exhausted','external','same-question','hint','unfocused']){
   tickets=new Map();started=null;const context=await browser.newContext({viewport:{width,height}}),a=await context.newPage(),b=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
   for(const [page,user] of [[a,'Alice'],[b,'Bob']]){await page.goto(baseUrl+'/?user='+user);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();}
   await a.locator('.race-gameplay .guess-board').waitFor();
   const letters=()=>a.locator('.guess-row button:not([disabled])').allTextContents().then(values=>values.map(v=>v.toLowerCase()));
   if(scenario==='exhausted'){for(let index=0;index<4;index++){await a.evaluate(()=>window.otherTab('guess','zzzz'));}
    // The other tab's guesses render asynchronously; let them settle so the next click targets the live row, not a row about to lock.
    await a.waitForFunction(()=>{const rows=document.querySelectorAll('.guess-board .guess-row');return rows.length>=5&&document.querySelector('.guess-row button:not([disabled])')?.closest('.guess-row')===rows[rows.length-1];});}
   if(['correct','exhausted'].includes(scenario)){
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type(scenario==='correct'?'test':'zzzz');await a.evaluate(()=>window.holdGuessOnce=true);await a.locator('.race-actions .submit-action').click();await a.waitForFunction(()=>typeof window.releaseReceipt==='function');
   }else if(scenario==='skip'){
    await a.evaluate(()=>window.holdSkipOnce=true);await a.locator('.race-actions button').last().click();await a.waitForFunction(()=>typeof window.releaseReceipt==='function');
   }
   await a.locator('.race-native-answer-input').focus();
   await a.evaluate(()=>{const input=window.oldEditor=document.querySelector('.race-native-answer-input');input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));input.value='にほん';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'にほん',isComposing:true,inputType:'insertCompositionText'}));});
   metric('composition stays inside the native editor',await letters(),Array(4).fill(''));
   if(scenario==='unfocused')await a.getByRole('button',{name:'Close Race to 10',exact:true}).focus();
   if(['correct','exhausted','skip'].includes(scenario))await a.evaluate(()=>window.releaseReceipt());
   else {await a.evaluate(action=>window.otherTab(action,action==='guess'?'zzzz':'test'),scenario==='hint'?'hint':scenario==='same-question'?'guess':'skip');await a.evaluate(()=>window.dispatchEvent(new Event('online')));}
   const advance=!['same-question','hint'].includes(scenario);
   await a.waitForFunction(advance=>advance?document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'):document.querySelectorAll('.guess-board .guess-row')[0]?.textContent.trim().length>0,advance);
   metric('question transition matches canonical count',tickets.get('Alice').count,advance?1:0);
   const boundary=await a.evaluate(()=>({same:window.oldEditor===document.querySelector('.race-native-answer-input'),focused:document.activeElement===document.querySelector('.race-native-answer-input'),value:document.querySelector('.race-native-answer-input').value}));
   await a.evaluate(()=>{const input=window.oldEditor;input.value='にほん';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'にほん'}));input.value='にほん';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'にほん',inputType:'insertText'}));});
   metric('late composition cannot cross into a new question',await letters(),advance?Array(4).fill(''):scenario==='hint'?['に','ほ','ん']:['に','ほ','ん','']);
   metric('same-question observations retain the native editor',boundary.same,!advance);
   metric('editor focus survives question transition only if owned',boundary.focused,scenario!=='unfocused');
   metric('new question editor starts with no native text',boundary.value,advance?'':'にほん');
   if(advance){
    await a.locator('.race-native-answer-input').focus();await a.keyboard.type('te');
    metric('fresh native input still works',await letters(),['t','e','','']);
    await a.evaluate(()=>{const event=new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteContentBackward'});window.oldEditor.dispatchEvent(event);});
    metric('retired software deletion cannot edit new question',await letters(),['t','e','','']);
    await a.keyboard.press('Backspace');metric('fresh native deletion works once',await letters(),['t','','','']);
   } else {
    metric('same-question composition commits without a guess',await a.evaluate(()=>window.probe.calls.filter(call=>call.action==='guess').length),0);
   }
   metric('no page errors',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
   await a.screenshot({path:path.join(output,[width,height,scenario,'settled.png'].join('-'))});await context.close();
  }

 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page-'+new URL(page.url()).searchParams.get('user')+'.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
