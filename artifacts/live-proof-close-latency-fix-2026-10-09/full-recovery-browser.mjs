import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from '/home/craig-beswetherick/Documents/riddle-quest/node_modules/.pnpm/vite@8.3.1_@types+node@26.6.3_@vitejs+devtools@0.7.6_yaml@2.9.1/node_modules/vite/dist/node/index.js';
import {chromium,firefox} from '/home/craig-beswetherick/Documents/riddle-quest/node_modules/.pnpm/@playwright+test@1.63.0/node_modules/@playwright/test/index.mjs';
const require=createRequire("/home/craig-beswetherick/Documents/riddle-quest/packages/portal/package.json");
const {RACE_RULES,LiveRaceViewSchema}=require('@qwordly/core/race');
const {computeFeedback}=require('@qwordly/core/game');
const root="/home/craig-beswetherick/Documents/riddle-quest/packages/portal";
const mode=process.env.LIVE_DRAFT_REACT_MODE??'development';
const engine=process.env.LIVE_RELOAD_BROWSER??'chromium';
const output=path.resolve("/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-proof-close-latency-fix-2026-10-09/full-recovery",engine+'-'+mode);
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
function adapter(owner){return {find:async()=>({status:'cancelled'}),live:{...(new URLSearchParams(location.search).get('lookup')==='missing'?{}:{confirmGuessReceipt:input=>call(owner,'receipt',input)}),join:input=>call(owner,'join',input),update:input=>call(owner,'update',input)}};}
async function call(owner,operation,input){window.probe.calls.push({owner,operation,...input});
 if(input.action==='guess'&&window.holdRejectedOnce){window.holdRejectedOnce=false;return new Promise((_resolve,reject)=>window.releaseRejected=()=>reject(Object.assign(new Error('Unaccepted stale command'),{code:'functions/failed-precondition'})));}
 const response=await fetch('/live/'+operation,{method:'POST',body:JSON.stringify({user:owner,...input})});const result=await response.json();if(operation!=='receipt')window.probe.lastView=result;if(!response.ok)throw Object.assign(new Error('Rejected fixture request'),{code:result.code});
 if(operation==='receipt'){const lookup=new URLSearchParams(location.search).get('lookup');if(lookup==='unconfirmed')return {status:'unconfirmed'};if(lookup==='malformed')return {status:'accepted',guess:'answer'};if(['timeout','writer','close','owner'].includes(lookup))return new Promise(resolve=>window.releaseProof=()=>resolve(result));}
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
   if(url.pathname==='/live/join'&&!tickets.has(input.user)){tickets.set(input.user,{user:input.user,id:(input.user==='Alice'?'a':input.user==='Bob'?'b':'c').repeat(64),count:0,penalty:0,events:[],guesses:[],hints:[],accepted:new Set(),proofs:new Map(),created:Date.now(),left:false});if(tickets.size===2)started=Date.now()-1000;}
   const ticket=tickets.get(input.user);if(!ticket)throw Error('No owned seat');
   if(['guess','hint','skip'].includes(input.action)&&!ticket.accepted.has(input.requestId)&&input.riddleId!=='q'+ticket.count){res.writeHead(409,{'content-type':'application/json'}).end(JSON.stringify({code:'functions/failed-precondition'}));return;}
   if(url.pathname==='/live/receipt'){const proof=ticket.proofs.get(input.requestId),accepted=proof&&proof.ticketId===input.ticketId&&proof.riddleId===input.riddleId&&proof.position===input.position&&proof.guessesUsedBefore===input.guessesUsedBefore&&proof.guessesUsedAfter===input.guessesUsedBefore+1;res.setHeader('content-type','application/json');res.end(JSON.stringify({status:accepted?'accepted':'unconfirmed'}));return;}
   if(['guess','hint','skip'].includes(input.action)&&!ticket.accepted.has(input.requestId)){
    ticket.accepted.add(input.requestId);const position=ticket.count,before=ticket.guesses.length;const wall=Date.now()-started;
    if(input.action==='guess'){if(input.guess.toLowerCase()==='test'){ticket.count++;ticket.guesses=[];ticket.hints=[];}else {ticket.guesses.push({guess:[...input.guess.toLowerCase()],feedback:computeFeedback(input.guess,'test','en')});ticket.proofs.set(input.requestId,{ticketId:ticket.id,riddleId:input.riddleId,position,guessesUsedBefore:before,guessesUsedAfter:ticket.guesses.length});}}
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

 browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'?{executablePath:process.env.LIVE_RELOAD_FIREFOX_EXECUTABLE}:{})});
 for(const width of [390,1280])for(const scenario of ['wrong','hint','skip','unconfirmed','missing','malformed','timeout','writer','close','owner','consumed']){
  tickets=new Map();started=null;
  const context=await browser.newContext({viewport:{width,height:844}}),a=await context.newPage(),b=await context.newPage();
  await context.addInitScript(()=>{if(new URLSearchParams(location.search).get('denyWrites')){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('riddleQuest:liveRaceDraft:'))throw new DOMException('Optional checkpoint denied','QuotaExceededError');return original.call(this,key,value);};}});
  const metric=(name,actual,expected)=>{observations.push({width,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
  for(const [page,user] of [[a,'Alice'],[b,'Bob']]){await page.goto(baseUrl+'/?user='+user+'&lookup='+scenario);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();}
  await a.locator('.race-gameplay .guess-board').waitFor();
  const letters=()=>a.locator('.guess-row button:not([disabled])').allTextContents().then(values=>values.map(v=>v.toLowerCase()));
  if(scenario==='consumed'){
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('zzzz');await a.evaluate(()=>window.holdRejectedOnce=true);await a.locator('.race-actions .submit-action').click();await a.waitForFunction(()=>typeof window.releaseRejected==='function');
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('zzzz');await a.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const original=await a.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:liveRaceDraft:Alice')).guessReceipt.requestId);
    await a.goto(baseUrl+'/?user=Alice&lookup=consumed&denyWrites=1');await a.getByRole('button',{name:'Start PvP match',exact:true}).click();await a.locator('.race-gameplay .guess-board').waitFor();
    metric('exact-count reload recovers independent full word',await letters(),['z','z','z','z']);
    await a.locator('.race-actions .submit-action').click();await a.waitForFunction(()=>window.probe.lastView?.run?.currentRiddle?.guessesUsed===1);
    metric('replacement acceptance owns a different request',await a.evaluate(original=>window.probe.calls.find(c=>c.action==='guess').requestId!==original,original),true);
    metric('failed clear retains only the original request locator',await a.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:liveRaceDraft:Alice')).guessReceipt.requestId),original);
    await a.reload();await a.getByRole('button',{name:'Start PvP match',exact:true}).click();await a.locator('.race-gameplay .guess-board').waitFor();
    metric('consumed word cannot reappear after failed clear',await letters(),['','','','']);
    metric('lookup tests original identity instead of accepted replacement',await a.evaluate(()=>window.probe.calls.find(c=>c.operation==='receipt').requestId),original);
    metric('reload cannot replay the consumed word',await a.evaluate(()=>window.probe.calls.filter(c=>c.action==='guess').length),0);
    metric('no browser error',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
    await a.screenshot({path:path.join(output,width+'-'+scenario+'-reloaded.png')});await context.close();continue;
  }
  if(!['hint','skip'].includes(scenario)){
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('zzzz');
    await a.evaluate(()=>window.holdGuessOnce=true);await a.locator('.race-actions .submit-action').click();
  }else if(scenario==='hint'){
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('te');
    await a.evaluate(()=>window.holdHintOnce=true);await a.locator('.race-actions button').first().click();
  }else{
    await a.evaluate(()=>window.holdSkipOnce=true);await a.locator('.race-actions button').last().click();
  }
  await a.waitForFunction(()=>typeof window.releaseReceipt==='function');
  if(scenario!=='hint'){
    await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('te');
  }
  metric('held accepted command permits newer local draft',await letters(),['t','e','','']);
  await a.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const checkpoint=await a.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:liveRaceDraft:Alice')));
  metric('checkpoint contains the newer unsent cells',checkpoint.letters,['t','e','','']);
  const accepted=await a.evaluate(()=>({id:window.probe.lastView.ticketId,position:window.probe.lastView.run.currentRiddle.position,guesses:window.probe.lastView.run.currentRiddle.guessesUsed}));
  await a.reload();await a.getByRole('button',{name:'Start PvP match',exact:true}).click();
  if(['writer','close','owner'].includes(scenario)){
    await a.waitForFunction(()=>typeof window.releaseProof==='function');
    if(scenario==='writer')await a.evaluate(()=>{const key='riddleQuest:liveRaceDraft:Alice',record=JSON.parse(localStorage.getItem(key));localStorage.setItem(key,JSON.stringify({...record,writerId:'newer-browser-writer',letters:['x','y','','']}));});
    if(scenario==='close')await a.getByRole('button',{name:'Close Race to 10',exact:true}).click();
    if(scenario==='owner'){await a.evaluate(()=>window.replaceOwner());await a.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();}
    await a.evaluate(async()=>{window.releaseProof();await Promise.resolve();await Promise.resolve();});
    if(scenario==='close'){await a.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();metric('close removes its checkpoint while lookup is pending',await a.evaluate(()=>localStorage.getItem('riddleQuest:liveRaceDraft:Alice')),null);metric('late proof cannot reopen closed gameplay',await a.locator('.race-gameplay .guess-board').count(),0);metric('no browser error',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);await context.close();continue;}
    if(scenario==='owner'){await a.getByRole('button',{name:'Start PvP match',exact:true}).click();await a.locator('.race-gameplay .guess-board').waitFor();metric('replacement account cannot inherit old proof cells',await letters(),['','','','']);metric('new account performs no old receipt lookup',await a.evaluate(()=>window.probe.calls.filter(c=>c.operation==='receipt'&&c.owner==='Carol').length),0);metric('no browser error',await a.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);await context.close();continue;}
  }
  await a.locator('.race-gameplay .guess-board').waitFor();
  const recovered=await a.evaluate(()=>({id:window.probe.lastView.ticketId,position:window.probe.lastView.run.currentRiddle.position,guesses:window.probe.lastView.run.currentRiddle.guessesUsed}));
  metric('rejoin recovers accepted command authority',recovered,accepted);
  metric('receipt-bound recovery of independently typed cells',await letters(),scenario==='wrong'?['t','e','','']:scenario==='hint'?['e','','']:['','','','']);
  metric('lookup is limited to eligible ambiguous recovery',await a.evaluate(()=>window.probe.calls.filter(c=>c.operation==='receipt').length),['wrong','unconfirmed','malformed','timeout','writer','close','owner','consumed'].includes(scenario)?1:0);
  if(scenario==='writer')metric('late proof preserves competing checkpoint cells',await a.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:liveRaceDraft:Alice')).letters),['x','y','','']);
  if(scenario==='wrong'){const saved=await a.evaluate(()=>JSON.parse(localStorage.getItem('riddleQuest:liveRaceDraft:Alice')));metric('normalized checkpoint removes historical locator',Object.hasOwn(saved,'guessReceipt'),false);metric('normalized checkpoint binds the confirmed attempt',JSON.parse(saved.binding).at(-1),1);}
  if(scenario==='timeout'){await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('x');await a.evaluate(async()=>{window.releaseProof();await Promise.resolve();await Promise.resolve();});metric('late acceptance cannot overwrite newly composed cells',await letters(),['x','','','']);}
  metric('reload does not redeliver the held command',await a.evaluate(()=>window.probe.calls.filter(c=>['guess','hint','skip'].includes(c.action)).length),0);
  metric('no browser error',await a.evaluate(()=>window.probe.errors),[]);
  metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
  await a.screenshot({path:path.join(output,width+'-'+scenario+'-reloaded.png')});await context.close();
 }
 console.log(JSON.stringify({engine,mode,browserVersion:browser.version(),journeys:22,checks:observations.length}));
}finally{
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
