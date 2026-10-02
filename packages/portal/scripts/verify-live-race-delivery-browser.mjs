import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {build} from "vite";
import {chromium} from "@playwright/test";
const require = createRequire(import.meta.url);
const {RACE_RULES} = require("@qwordly/core/race");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive:true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-delivery-"));
const output = path.resolve(root, "../../artifacts/live-pvp-delivery/browser");
await mkdir(output, {recursive:true});
const authority = null;
const responsiveOnly = process.env.LIVE_RACE_RESPONSIVE_ONLY === "1";
const backoffOnly = process.env.LIVE_RACE_BACKOFF_ONLY === "1";
const rejectionOnly = process.env.LIVE_RACE_REJECTION_ONLY === "1";
const commandRecoveryOnly = process.env.LIVE_RACE_COMMAND_RECOVERY_ONLY === "1";
const source = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
const services=createFakeRaceServices(); const user=new URLSearchParams(location.search).get('user') || 'Alice';
window.deliveryCalls=[]; window.freezeJoinOnce=new URLSearchParams(location.search).get('fault')==='join';
const call=async(action,input)=>{
 window.deliveryCalls.push({action,...input});
 if(input.action==='poll' && window.failAllPolls) throw new Error('Injected offline poll');
 if(action==='join' && window.freezeJoinOnce){window.freezeJoinOnce=false;return new Promise(()=>{});}
 if(input.action==='poll' && window.freezePollOnce){window.freezePollOnce=false;return new Promise(()=>{});}
 const response=await fetch('/live/'+action,{method:'POST',body:JSON.stringify({user,...input})});
 const result=await response.json();
 if(!response.ok) throw Object.assign(new Error('Harness transport failed'),{code:result.code});
 if(input.action==='poll' && window.holdPollOnce){window.holdPollOnce=false;return new Promise(resolve=>{window.releasePoll=()=>resolve(result);});}
 if(input.action==='poll' && window.holdPollErrorOnce){window.holdPollErrorOnce=false;return new Promise((_resolve,reject)=>{window.releasePollError=()=>reject(new Error('Late poll failure'));});}
 if(input.action==='guess' && window.freezeGuessOnce){window.freezeGuessOnce=false;return new Promise(()=>{});}
 if(input.action==='guess' && window.holdGuessOnce){window.holdGuessOnce=false;return new Promise(resolve=>{window.releaseGuess=()=>resolve(result);});}
 return result;
};
const matchmaking={find:async()=>({status:'cancelled'}), live:{join:input=>call('join',input),update:input=>call('update',input)}};
async function postToHost(message) {if(message.type==='game:listRaceCategories') window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:await services.listRaceCategories({locale:'en'})}}}));}
window.completed=0; window.addEventListener('riddle-quest:live-race-completed',()=>window.completed++);
createRoot(document.getElementById('root')).render(<React.StrictMode><RaceTo10Game locale='en' ownerId={user} coins={100} matchmaking={matchmaking}
 postToHost={postToHost} onClose={()=>{}} /></React.StrictMode>);
`;
await writeFile(path.join(scratch,"main.tsx"),source);
await writeFile(path.join(scratch,"tsconfig.json"),JSON.stringify({compilerOptions:{jsx:"react-jsx"}}));
await writeFile(path.join(scratch,"index.html"),'<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser,server,baseUrl;
let tickets=new Map(), started=null,winner=null,bot=false;
const reset=()=>{tickets=new Map();started=null;winner=null;bot=false;};
function state(user) {
 const ticket=tickets.get(user), opponent=[...tickets.values()].find(item=>item.user!==user);
 const now=Date.now(), phase=winner!==null?'result':started?(now<started?'countdown':'racing'):'searching';
 const identity=item=>({displayName:item.user,avatarUrl:baseUrl+'/avatar.svg',bot:false,correctCount:item.count});
 const rival=opponent?identity(opponent):bot?{displayName:'Riddle Bot',avatarUrl:null,bot:true,correctCount:1}:null;
 const run=started?{runId:ticket.id,role:'creator',status:phase==='result'?'completed':phase==='countdown'?'scheduled':'active',
 serverNowMs:now,startsAtMs:started,categoryId:'history',locale:'en',rules:RACE_RULES,correctCount:ticket.count,
 wallElapsedMs:Math.max(0,now-started),totalPenaltyMs:0,adjustedElapsedMs:Math.max(0,now-started),events:[],
 currentRiddle:phase==='result'?null:{riddleId:'q'+ticket.count,text:'A four-letter browser test answer',answerLength:4,position:ticket.count,
 guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},
 opponent:rival?{displayName:rival.displayName,avatarUrl:rival.avatarUrl,adjustedFinishMs:300000,events:[]}:undefined}:null;
 return {ticketId:ticket.id,phase,serverNowMs:now,searchEndsAtMs:ticket.created+60000,startsAtMs:started,player:identity(ticket),opponent:rival,run,
 result:winner===null?null:winner===user?'win':'loss',rewardCoins:winner===user?50:0,...(winner===user?{newCoins:150}:{})};
}
try {
 await build({plugins:[{name:"original-live-race-baseline",async load(id){if(process.env.LIVE_RACE_BASELINE_FILE && id===path.join(root,"src/play/race/LiveRaceGame.tsx"))return await readFile(process.env.LIVE_RACE_BASELINE_FILE,"utf8");}}],root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{
  try {
   const url=new URL(request.url,'http://localhost');
   if(url.pathname==='/avatar.svg'){response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#75baff"/><circle cx="50" cy="42" r="22" fill="#18365b"/></svg>');return;}
   if(url.pathname.startsWith('/live/')) {
    let body='';for await(const chunk of request) body+=chunk; const input=JSON.parse(body);
    if(authority){const result=await authority.call(url.pathname.endsWith("join")?"join":"update",input);response.setHeader("Content-Type","application/json");response.end(JSON.stringify(result));return;}
    if(url.pathname==='/live/join' && !tickets.has(input.user)) {
     tickets.set(input.user,{user:input.user,id:(input.user==='Alice'?'a':'b').repeat(64),count:0,accepted:new Set(),created:Date.now()});
     if(tickets.size===2) started=Date.now()+5000;
    }
    const ticket=tickets.get(input.user);
    if(input.action==='guess' && !ticket.accepted.has(input.requestId) && input.riddleId!=='q'+ticket.count){
     response.writeHead(409,{'Content-Type':'application/json'}).end(JSON.stringify({code:'functions/failed-precondition'}));return;
    }
    if(input.action==='guess' && winner===null && Date.now()>=started && input.guess==='test' && !ticket.accepted.has(input.requestId)) {
     ticket.accepted.add(input.requestId); ticket.count++; if(ticket.count===10) winner=input.user;
    }
    if(input.action==='leave') tickets.delete(input.user);
    if(!started && ticket?.created+60000<=Date.now()){bot=true;started=Date.now()+5000;}
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify(state(input.user)));return;
   }
   const file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);
   const body=await readFile(file);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');response.end(body);
  }catch(error){response.writeHead(500).end(String(error));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));baseUrl=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  reset();const context=await browser.newContext({viewport});const a=await context.newPage(),b=await context.newPage();const errors=[];
  for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
  await a.goto(baseUrl+'/?user=Alice'+(responsiveOnly||backoffOnly||rejectionOnly||commandRecoveryOnly?'':'&fault=join'));await a.getByRole('button',{name:'Start PvP match',exact:true}).click();
  await a.locator('.live-race-self strong').waitFor({timeout:15000});
  const joins=await a.evaluate(()=>window.deliveryCalls.filter(item=>item.action==='join'));
  if(!responsiveOnly&&!backoffOnly&&!rejectionOnly&&!commandRecoveryOnly){assert.equal(joins.length,2);assert.equal(joins[0].requestId,joins[1].requestId);
  console.log('Hung join recovered with the same request ID at '+viewport.width+'px.');}
  await b.goto(baseUrl+'/?user=Bob');await b.getByRole('button',{name:'Start PvP match',exact:true}).click();
  await a.locator('.race-gameplay .guess-board').waitFor({timeout:15000});
  if(commandRecoveryOnly){
   async function solve(){await a.locator('.guess-row .cell:not([disabled])').first().click();await a.keyboard.type('test');await a.locator('.race-actions .submit-action').click();}
   await a.evaluate(()=>{window.holdGuessOnce=true;});await solve();
   await a.getByRole('button',{name:'Retry',exact:true}).waitFor({timeout:15000});
   await a.evaluate(()=>window.releaseGuess());
   await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10')&&!document.querySelector('.race-error'),null,{timeout:1000});
   assert.equal(await a.evaluate(()=>window.deliveryCalls.filter(item=>item.action==='guess').length),1,'Late owned receipt should recover before retry');
   console.log('Late accepted command recovered without a duplicate delivery at '+viewport.width+'px.');
   await a.evaluate(()=>{window.freezeGuessOnce=true;});await solve();
   await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('2 / 10')&&!document.querySelector('.race-error'),null,{timeout:15000});
   const guesses=await a.evaluate(()=>window.deliveryCalls.filter(item=>item.action==='guess'));
   assert.equal(guesses.length,3);assert.equal(guesses[1].requestId,guesses[2].requestId);assert.equal(tickets.get('Alice').count,2);
   console.log('Lost accepted answer recovered automatically with its original request ID at '+viewport.width+'px.');
   // The authority has completed the match while the next accepted answer response is lost.
   await a.evaluate(()=>{window.freezeGuessOnce=true;});await solve();winner='Bob';tickets.get('Bob').count=10;
   await a.locator('.live-race-victory').waitFor({timeout:15000});
   assert.equal(await a.evaluate(()=>window.completed),1);
   const finishedCalls=await a.evaluate(()=>window.deliveryCalls.length);
   await a.evaluate(()=>{window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));});
   await new Promise(resolve=>setTimeout(resolve,1200));
   assert.equal(await a.evaluate(()=>window.deliveryCalls.length),finishedCalls,'Finished match must stay quiet on reconnect');
   assert.equal(await a.evaluate(()=>window.completed),1);assert.deepEqual(errors,[]);
   console.log('Opponent victory recovered during an uncertain answer; terminal reconnect sent no requests at '+viewport.width+'px.');
   await context.close();continue;
  }
  if(rejectionOnly){
   await a.evaluate(()=>{window.holdPollOnce=true;});await a.waitForFunction(()=>Boolean(window.releasePoll));
   tickets.get('Alice').count=1;
   await a.locator('.guess-row .cell:not([disabled])').first().click();await a.keyboard.type('test');await a.locator('.race-actions .submit-action').click();
   await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10')&&!document.querySelector('.race-error'),null,{timeout:2000});
   assert.equal(tickets.get('Alice').count,1,'Rejected stale question cannot score');
   await a.evaluate(()=>window.releasePoll());
   await a.locator('.guess-row .cell:not([disabled])').first().click();await a.keyboard.type('test');await a.locator('.race-actions .submit-action').click();
   await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('2 / 10'));
   assert.equal(tickets.get('Alice').count,2);assert.deepEqual(errors,[]);
   console.log('Server rejection refreshed a question advanced by another tab without locking gameplay at '+viewport.width+'px.');
   await context.close();continue;
  }
  if(backoffOnly){
   await a.evaluate(()=>{window.failAllPolls=true;window.deliveryCalls=[];});
   await a.locator('.race-error').waitFor();await new Promise(resolve=>setTimeout(resolve,6100));
   const polls=await a.evaluate(()=>window.deliveryCalls.filter(item=>item.action==='poll').length);
   assert.ok(polls<=3,'Offline polling must back off; observed '+polls+' requests');
   await a.locator('.guess-row .cell:not([disabled])').first().click();await a.keyboard.type('test');
   assert.equal(await a.locator('.guess-row .cell').allTextContents().then(values=>values.join('')),'test');
   await a.evaluate(()=>{window.failAllPolls=false;window.dispatchEvent(new Event('online'));});
   await a.waitForFunction(()=>!document.querySelector('.race-error'));
   assert.equal(await a.locator('.guess-row .cell').allTextContents().then(values=>values.join('')),'test');
   await a.locator('.race-actions .submit-action').click();
   await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10'));
   assert.equal(tickets.get('Alice').count,1);assert.deepEqual(errors,[]);
   console.log('Offline polling backed off to '+polls+' calls, preserved typing and refreshed immediately on reconnect at '+viewport.width+'px.');
   await context.close();continue;
  }
  await a.evaluate(()=>{window.freezePollOnce=true;});await a.waitForFunction(()=>window.freezePollOnce===false);
  const began=Date.now();
  async function solve(){await a.locator('.guess-row .cell:not([disabled])').first().click();await a.keyboard.type('test');await a.locator('.race-actions .submit-action').click();}
  await solve();await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10'),null,{timeout:5000});
  const elapsed=Date.now()-began;assert.ok(elapsed<750,'Player guess must bypass a hung background poll; measured '+elapsed+'ms');
  console.log('Player guess bypassed hung poll in '+elapsed+'ms at '+viewport.width+'px.');
  if(responsiveOnly){assert.deepEqual(errors,[]);await context.close();continue;}
  await a.evaluate(()=>{window.holdPollOnce=true;});await a.waitForFunction(()=>Boolean(window.releasePoll));
  await solve();await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('2 / 10'));
  await a.evaluate(()=>window.releasePoll());await new Promise(resolve=>setTimeout(resolve,150));
  assert.match(await a.locator('.race-progress > div:first-child strong').innerText(),/2 \/ 10/);
  assert.equal(await a.locator('.race-error').count(),0);
  await a.evaluate(()=>{window.holdPollErrorOnce=true;});await a.waitForFunction(()=>Boolean(window.releasePollError));
  await solve();await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('3 / 10'));
  await a.evaluate(()=>window.releasePollError());await new Promise(resolve=>setTimeout(resolve,150));
  assert.match(await a.locator('.race-progress > div:first-child strong').innerText(),/3 \/ 10/);
  assert.equal(await a.locator('.race-error').count(),0);
  console.log('Late poll snapshots and failures cannot replace newer server-confirmed answers at '+viewport.width+'px.');
  await a.evaluate(()=>{window.freezeGuessOnce=true;});await solve();
  await a.getByRole('button',{name:'Retry',exact:true}).waitFor({timeout:15000});
  await a.evaluate(()=>window.dispatchEvent(new Event('online')));
  await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('4 / 10'));
  const guesses=await a.evaluate(()=>window.deliveryCalls.filter(item=>item.action==='guess'));
  assert.equal(guesses.length,5);assert.equal(guesses[3].requestId,guesses[4].requestId);assert.equal(tickets.get('Alice').count,4);
  assert.deepEqual(errors,[]);await a.screenshot({path:path.join(output,'recovered-'+viewport.width+'.png'),fullPage:true});
  console.log('Reconnect reconciled an accepted guess with its original request ID at '+viewport.width+'px.');await context.close();
 }

}finally{await browser?.close();await authority?.clear();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
