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
const output=path.resolve("/home/craig-beswetherick/Documents/riddle-quest/artifacts/live-checkpoint-read-deduplication-2026-10-09",engine+'-'+mode);
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
 const response=await fetch('/live/'+operation,{method:'POST',body:JSON.stringify({user:owner,...input})});const result=await response.json();window.probe.lastView=result;if(!response.ok)throw Object.assign(new Error('Rejected fixture request'),{code:result.code});
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

 browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'?{executablePath:process.env.LIVE_RELOAD_FIREFOX_EXECUTABLE}:{})});
 for(const width of [390,1280]){
  tickets=new Map();started=null;
  const context=await browser.newContext({viewport:{width,height:844}}),a=await context.newPage(),b=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({width,name,actual,expected});assert.deepEqual(actual,expected,name);};
  for(const [page,user] of [[a,'Alice'],[b,'Bob']]){await page.goto(baseUrl+'/?user='+user);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();}
  await a.locator('.race-gameplay .guess-board').waitFor();
  await a.locator('.guess-row button:not([disabled])').first().click();await a.keyboard.type('te');
  const letters=()=>a.locator('.guess-row button:not([disabled])').allTextContents().then(values=>values.map(v=>v.toLowerCase()));
  metric('partial draft before native reload',await letters(),['t','e','','']);
  const before=await a.evaluate(()=>{const v=window.probe.lastView;return [v.ticketId,v.run.runId,v.run.locale,v.run.currentRiddle.riddleId,v.run.currentRiddle.position,v.run.currentRiddle.guessesUsed];});
  await a.reload();await a.getByRole('button',{name:'Start PvP match',exact:true}).click();await a.locator('.race-gameplay .guess-board').waitFor();
  const after=await a.evaluate(()=>{const v=window.probe.lastView;return [v.ticketId,v.run.runId,v.run.locale,v.run.currentRiddle.riddleId,v.run.currentRiddle.position,v.run.currentRiddle.guessesUsed];});
  metric('injected authority returns identical seat and question',after,before);
  metric('recovered seat restores unsent letters on reload',await letters(),['t','e','','']);
  metric('reload does not replay a guess',await a.evaluate(()=>window.probe.calls.filter(c=>c.action==='guess').length),0);
  metric('no browser error',await a.evaluate(()=>window.probe.errors),[]);
  metric('no unhandled rejection',await a.evaluate(()=>window.probe.unhandled),[]);
  await a.screenshot({path:path.join(output,width+'-reloaded.png')});await context.close();
 }
 console.log(JSON.stringify({engine,mode,browserVersion:browser.version(),journeys:2,checks:observations.length}));
}finally{
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
