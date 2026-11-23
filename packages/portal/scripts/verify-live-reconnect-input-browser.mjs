import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.url);
const {RACE_RULES,LiveRaceViewSchema}=require('@riddle-quest/core/race');
const {computeFeedback}=require('@riddle-quest/core/game');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.LIVE_DRAFT_REACT_MODE??'development';
const output=path.resolve(process.env.LIVE_DRAFT_REPORT_DIR??path.join(root,'../../builds/test-evidence/live-reconnect-input-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-reconnect-input-'));
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
 if(input.action==='guess'&&window.holdRejectedOnce){window.holdRejectedOnce=false;return new Promise((_resolve,reject)=>window.releaseRejected=()=>reject(Object.assign(new Error('Unaccepted stale command'),{code:'functions/failed-precondition'})));}
 const response=await fetch('/live/'+operation,{method:'POST',body:JSON.stringify({user:owner,...input})});const result=await response.json();if(!response.ok)throw Object.assign(new Error('Rejected fixture request'),{code:result.code});
 const hold=input.action==='poll'&&window.holdPollOnce||input.action==='guess'&&window.holdGuessOnce||input.action==='hint'&&window.holdHintOnce||input.action==='skip'&&window.holdSkipOnce;
 if(hold){window.holdPollOnce=window.holdGuessOnce=window.holdHintOnce=window.holdSkipOnce=false;return new Promise((resolve,reject)=>{window.releaseReceipt=()=>resolve(result);window.failReceipt=()=>reject(new Error('Lost reply'));});}
 return result;
}
async function postToHost(message){if(message.type==='game:listRaceCategories')window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:await services.listRaceCategories({locale:'en'})}}}));}
window.otherTabWrong=()=>fetch('/live/update',{method:'POST',body:JSON.stringify({user,ticketId:'a'.repeat(64),action:'guess',riddleId:'q0',guess:'zzzz',requestId:'other-tab-wrong'})}).then(r=>r.json());
const app=createRoot(document.querySelector('#root'));
function mount(owner){app.render(<React.StrictMode><RaceTo10Game locale="en" ownerId={owner} coins={100} matchmaking={adapter(owner)} postToHost={postToHost} onClose={()=>{}}/></React.StrictMode>);}
mount(user);window.replaceOwner=()=>mount('Carol');
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-draft-baseline',async load(id){if(process.env.LIVE_DRAFT_BASELINE_FILE&&id.endsWith('/race/LiveRaceGame.tsx'))return readFile(process.env.LIVE_DRAFT_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
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
    if(input.action==='guess'){if(input.guess.toLowerCase()==='test'){ticket.count++;ticket.guesses=[];ticket.hints=[];}else ticket.guesses.push({guess:[...input.guess.toLowerCase()],feedback:computeFeedback(input.guess,'test','en')});}
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
 if(process.env.LIVE_DRAFT_SERVE_ONLY==='1'){console.log(JSON.stringify({url:baseUrl,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});const quick=process.env.LIVE_DRAFT_QUICK==='1';
  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of quick?['wrong']:['wrong','hint','skip','poll','retry','rejected','no-edit','empty','owner','close']){
   tickets=new Map();started=null;const context=await browser.newContext({viewport:{width,height}}),a=await context.newPage(),b=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
   for(const [page,user] of [[a,'Alice'],[b,'Bob']]){await page.goto(baseUrl+'/?user='+user);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();}
   await a.locator('.race-gameplay .guess-board').waitFor();
   const letters=()=>a.locator('.guess-row button:not([disabled])').allTextContents().then(values=>values.map(v=>v.toLowerCase()));
   if(scenario==='poll'){
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('te');await a.evaluate(()=>window.otherTabWrong());
    await a.evaluate(()=>{window.holdPollOnce=true;window.dispatchEvent(new Event('online'));});
   }else if(scenario==='hint'){
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('xe');await a.evaluate(()=>window.holdHintOnce=true);await a.locator('.race-actions button').first().click();
   }else if(scenario==='skip'){
    await a.evaluate(()=>window.holdSkipOnce=true);await a.locator('.race-actions button').last().click();
   }else{
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('zzzz');await a.evaluate(rejected=>{if(rejected)window.holdRejectedOnce=true;else window.holdGuessOnce=true;},['rejected','no-edit','empty'].includes(scenario));await a.locator('.race-actions .submit-action').click();
   }
   await a.waitForFunction(()=>typeof window.releaseReceipt==='function'||typeof window.releaseRejected==='function');
   metric('held delivery leaves native composition enabled',await a.locator('.race-native-answer-input').isEnabled(),true);
   if(scenario!=='no-edit'){
    await a.locator('.guess-row button:not([disabled])').first().click();
    if(scenario==='hint'||scenario==='poll')await a.locator('.guess-row button:not([disabled])').nth(2).click();
    await a.keyboard.type(scenario==='hint'||scenario==='poll'?'st':'test');
    if(scenario==='empty')for(let index=0;index<4;index++)await a.keyboard.press('Backspace');
   }
   const expected=scenario==='no-edit'||scenario==='empty'?Array(4).fill(''):scenario==='hint'?['x','e','s','t']:['t','e','s','t'];
   metric('held delivery accepts native local edits',await letters(),expected);
   const before=await a.evaluate(()=>window.probe.calls.filter(x=>['guess','hint','skip'].includes(x.action)).length);
   if(scenario!=='poll')metric('pending receipt still locks Submit',await a.locator('.race-actions .submit-action').isDisabled(),true);
   if(scenario!=='poll'){await a.keyboard.press('Enter');metric('native Enter cannot bypass pending authority',await a.evaluate(()=>window.probe.calls.filter(x=>['guess','hint','skip'].includes(x.action)).length),before);}
   else metric('background observations keep Submit available',await a.locator('.race-actions .submit-action').isEnabled(),true);
   await a.screenshot({path:path.join(output,[width,height,scenario,'held.png'].join('-'))});
   if(scenario==='owner'){
    await a.evaluate(()=>window.replaceOwner());await a.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();await a.evaluate(()=>window.releaseReceipt());
    metric('retired receipt cannot reopen another account board',await a.locator('.race-native-answer-input').count(),0);
   }else if(scenario==='close'){
    await a.getByRole('button',{name:'Close Race to 10',exact:true}).click();
    metric('close immediately disables draft editing',await a.locator('.race-native-answer-input').isDisabled(),true);
    await a.evaluate(()=>window.releaseReceipt());await a.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();
    metric('leave confirms once for the original ticket',await a.evaluate(()=>new Set(window.probe.calls.filter(x=>x.action==='leave').map(x=>x.requestId)).size),1);
   }else{
    if(['rejected','no-edit','empty'].includes(scenario)){await a.evaluate(()=>{window.holdPollOnce=true;window.releaseRejected();});await a.waitForFunction(()=>typeof window.releaseReceipt==='function');}
    else if(scenario==='retry'){await a.evaluate(()=>{window.originalRelease=window.releaseReceipt;window.failReceipt();});await a.locator('.race-error button').waitFor();await a.evaluate(()=>window.holdGuessOnce=true);await a.locator('.race-error button').click();await a.waitForFunction(()=>window.probe.calls.filter(x=>x.action==='guess').length===2&&window.releaseReceipt!==window.originalRelease);}
    await a.evaluate(()=>window.releaseReceipt());await a.waitForTimeout(100);
    const reconciled=scenario==='skip'||scenario==='empty'?Array(4).fill(''):scenario==='no-edit'?Array(4).fill('z'):['t','e','s','t'];
    metric('receipt keeps only the correct question-owned draft',await letters(),scenario==='hint'?['e','s','t']:reconciled);
    metric('accepted original guess is never replaced by new draft text',await a.evaluate(()=>window.probe.calls.filter(x=>x.action==='guess').map(x=>x.guess)),scenario==='hint'||scenario==='skip'||scenario==='poll'?[]:scenario==='retry'?['zzzz','zzzz']:['zzzz']);
    metric('transport retry retains one original request id',await a.evaluate(()=>new Set(window.probe.calls.filter(x=>x.action==='guess').map(x=>x.requestId)).size),scenario==='hint'||scenario==='skip'||scenario==='poll'?0:1);
    metric('local edits cannot change authority solve count',tickets.get('Alice').count,scenario==='skip'?1:0);
    metric('authority applies each help penalty once',tickets.get('Alice').penalty,scenario==='hint'?RACE_RULES.hintPenaltyMs:scenario==='skip'?RACE_RULES.skipPenaltyMs:0);
    if(['skip','empty','no-edit'].includes(scenario)){
     await a.locator('.guess-row button:not([disabled])').last().click();for(let index=0;index<4;index++)await a.keyboard.press('Backspace');await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('test');
    }
    metric('next explicit command uses the complete native word',await letters(),scenario==='hint'?['e','s','t']:['t','e','s','t']);
    await a.locator('.race-actions .submit-action').click();await a.waitForFunction(count=>window.probe.calls.filter(x=>x.action==='guess').length===count,scenario==='retry'?3:scenario==='hint'||scenario==='skip'||scenario==='poll'?1:2);
    await a.waitForFunction(count=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes(count+' / 10'),scenario==='skip'?2:1);
    metric('new explicit submission advances authority exactly once',tickets.get('Alice').count,scenario==='skip'?2:1);
   }
   metric('no page errors',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
   await context.close();
  }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page-'+new URL(page.url()).searchParams.get('user')+'.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
