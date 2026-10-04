import crypto from "node:crypto";
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
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-race-"));
const output = path.resolve(process.env.LIVE_RACE_REPORT_DIR ?? path.join(root, "../../artifacts/live-pvp"));
await mkdir(output, {recursive:true});
const push = process.env.LIVE_RACE_PUSH === "1";
const streams = new Map();
const broadcast = () => {for(const response of streams.values())response.write("data: "+JSON.stringify({message:{revision: crypto.randomUUID()}})+"\n\n");};
const authority = process.env.LIVE_RACE_USE_EMULATOR === "1" ? await (await import("./live-race-emulator.mjs")).createLiveRaceEmulator() : null;
const source = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {observeFirebaseLiveRace} from ${JSON.stringify(path.join(root, 'src/play/firebaseLiveRaceSignals.ts'))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
window.livePushEvents=0;window.bridgeCalls=[];window.legacyFindCalls=0;window.liveSnapshots=[];window.liveRequests=[];
const params=new URLSearchParams(location.search);
const services=createFakeRaceServices(); const user=new URLSearchParams(location.search).get('user') || 'Alice';
const call=async (action,input)=>{window.liveRequests.push({action:input.action || action,at:performance.now()});const response=await fetch('/live/'+action,{method:'POST',body:JSON.stringify({user,...input})}); if(!response.ok) throw new Error('Harness transport failed'); const result=await response.json();window.liveSnapshots.push(result);return result;};
const matchmaking={find:async()=>{window.legacyFindCalls++;return {status:'cancelled'};}, live:{join:input=>call('join',input),update:input=>call('update',input), ...( ${push} ? {observe:(ticketId,onChange,onStatus)=>{
 window.notifyLive=onChange;
 const stop=observeFirebaseLiveRace(ticketId,()=>{window.livePushEvents++;onChange();},status=>{window.livePushConnected=status;onStatus(status);});
 window.breakPush=()=>{stop();onStatus(false);};return stop;
}} : {})}};
async function postToHost(message) {window.bridgeCalls.push(message.type);if(message.type==='game:listRaceCategories') window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',
 {detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:await services.listRaceCategories({locale:'en'})}}}));}
window.completed=0; window.addEventListener('riddle-quest:live-race-completed',()=>window.completed++);
createRoot(document.getElementById('root')).render(<React.StrictMode><RaceTo10Game locale='en' ownerId={user} coins={100} matchmaking={params.has('unavailable') ? {find:matchmaking.find} : matchmaking} challengeId={params.get('challenge') || undefined} openInbox={params.has('inbox')} tournamentLocale={params.has('tournament') ? 'en' : undefined}
 postToHost={postToHost} onClose={()=>{}} /></React.StrictMode>);
`;
await writeFile(path.join(scratch,"main.tsx"),source);
await writeFile(path.join(scratch,"firebase.ts"), `
import {initializeApp} from 'firebase/app';import {getFunctions,httpsCallableFromURL} from 'firebase/functions';
const app=initializeApp({projectId:'demo-riddle-quest-push',apiKey:'fake-api-key'});
export const updateLiveRace=httpsCallableFromURL(getFunctions(app),location.origin+'/stream?user='+new URLSearchParams(location.search).get('user'));
`);
await writeFile(path.join(scratch,"tsconfig.json"),JSON.stringify({compilerOptions:{jsx:"react-jsx"}}));
await writeFile(path.join(scratch,"index.html"),'<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser,server,baseUrl;
let tickets=new Map(), started=null,winner=null,bot=false;
let lastGuessCommittedAt=0;
const latency=[];
const reset=()=>{tickets=new Map();started=null;winner=null;bot=false;};
function state(user) {
 const ticket=tickets.get(user), opponent=[...tickets.values()].find(item=>item.user!==user);
 const now=Date.now(), phase=winner!==null?'result':started?(now<started?'countdown':'racing'):'searching';
 const identity=item=>({displayName:item.user,avatarUrl:baseUrl+'/avatar.svg',bot:false,correctCount:item.count});
 const rival=opponent?identity(opponent):bot?{displayName:'Riddle Bot',avatarUrl:null,bot:true,correctCount:1}:null;
 const run=started?{runId:ticket.id,role:'creator',status:phase==='result'?'completed':phase==='countdown'?'scheduled':'active',
 serverNowMs:now,startsAtMs:started,categoryId:ticket.categoryId,locale:'en',rules:RACE_RULES,correctCount:ticket.count,
 wallElapsedMs:Math.max(0,now-started),totalPenaltyMs:0,adjustedElapsedMs:Math.max(0,now-started),events:[],
 currentRiddle:phase!=='racing'?null:{riddleId:'q'+ticket.count,text:'A four-letter browser test answer',answerLength:4,position:ticket.count,
 guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},
 opponent:rival?{displayName:rival.displayName,avatarUrl:rival.avatarUrl,adjustedFinishMs:300000,events:[]}:undefined}:null;
 return {ticketId:ticket.id,phase,serverNowMs:now,searchEndsAtMs:ticket.created+60000,startsAtMs:started,player:identity(ticket),opponent:rival,run,
 result:winner===null?null:winner===user?'win':'loss',rewardCoins:winner===user?50:0,...(winner===user?{newCoins:150}:{})};
}
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',plugins:[{name:'injected-firebase-callable',enforce:'pre',resolveId(source,importer){if(source==='../firebase' && importer?.endsWith('firebaseLiveRaceSignals.ts'))return path.join(scratch,'firebase.ts');}}],build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{
  try {
   const url=new URL(request.url,'http://localhost');
   if(url.pathname==='/stream') {
    let body='';for await(const chunk of request)body+=chunk;
    const input=JSON.parse(body).data,user=url.searchParams.get('user');
    response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    response.write(': connected\n\n');
    const emit=chunk=>{if(response.destroyed)return false;response.write('data: '+JSON.stringify({message:chunk})+'\n\n');return true;};
    const stop=authority ? authority.observe(user,input.ticketId,emit,error=>{if(!response.destroyed)response.end('data: '+JSON.stringify(error?{error:{status:'PERMISSION_DENIED',message:String(error)}}:{result:null})+'\n\n');}) : ()=>{};
    if(!authority)emit({revision:crypto.randomUUID()});
    streams.set(user,response);response.on('close',()=>{stop();if(streams.get(user)===response)streams.delete(user);});return;
   }
   if(url.pathname==='/avatar.svg'){response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#75baff"/><circle cx="50" cy="42" r="22" fill="#18365b"/></svg>');return;}
   if(url.pathname.startsWith('/live/')) {
    let body='';for await(const chunk of request) body+=chunk; const input=JSON.parse(body);
    if(authority){const result=await authority.call(url.pathname.endsWith("join")?"join":"update",input);response.setHeader("Content-Type","application/json");response.end(JSON.stringify(result));return;}
    if(url.pathname==='/live/join' && !tickets.has(input.user)) {
     tickets.set(input.user,{user:input.user,id:(input.user==='Alice'?'a':'b').repeat(64),count:0,created:Date.now(),categoryId:input.categoryId});
     if(tickets.size===2) {started=Date.now()+5000;broadcast();}
    }
    const ticket=tickets.get(input.user);
    if(input.action==='guess' && winner===null && Date.now()>=started && input.guess==='test') {
     ticket.count++;lastGuessCommittedAt=Date.now(); if(ticket.count===10) winner=input.user;broadcast();
    }
    if(input.action==='leave') tickets.delete(input.user);
    if(!started && ticket?.created+60000<=Date.now()){bot=true;started=Date.now()+5000;}
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify(state(input.user)));return;
   }
   const file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);
   const body=await readFile(file);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');response.end(body);
  }catch(error){console.error(error);response.writeHead(500).end(String(error));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));baseUrl=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  async function solve(page){
   const answer=authority ? await authority.answer(new URL(page.url()).searchParams.get('user')) : 'test';
   const revealed=authority ? await page.evaluate(()=>window.liveSnapshots.at(-1).run.currentRiddle.revealedLetters.map(letter=>letter.index)) : [];
   await page.locator('.guess-row .cell:not([disabled])').first().click();
   await page.keyboard.type([...answer].filter((_,index)=>!revealed.includes(index)).join(''));
   await page.locator('.race-actions .submit-action').click();
  }
 for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  reset(); await authority?.reset(); const context=await browser.newContext({viewport});const a=await context.newPage(),b=await context.newPage(); const errors=[];
  await context.route("https://live-race.invalid/**", route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#75baff"/><circle cx="50" cy="42" r="22" fill="#18365b"/></svg>'}));
  if(authority)await context.route("https://live-race.invalid/Alice.svg", route=>route.fulfill({status:404,body:"Unavailable avatar"}));
  for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
  await a.addInitScript(()=>localStorage.setItem('riddleQuest:activeRaceRun', JSON.stringify({runId:'retired-ghost',ownerId:'Alice'})));
  await a.goto(baseUrl+'/?user=Alice&challenge=retired-ghost&inbox=1&tournament=1');
  await a.locator('.race-category-grid button').first().waitFor();
  assert.equal(await a.locator('.race-hub-tabs,.race-inbox,.race-challenge-card').count(),0);
  assert.equal(await a.getByText('Recorded head-to-head',{exact:true}).count(),0);
  await a.getByRole('button',{name:'History People, events, and eras from the past',exact:true}).click();
  assert.equal(await a.getByRole('button',{name:'History People, events, and eras from the past',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await a.locator('.live-race-lobby').count(),0,'Category selection must not start a recorded or live run');
  await a.screenshot({path:path.join(output,`pvp-only-intro-${viewport.width}.png`),fullPage:true});
  await a.getByRole('button',{name:'Start PvP match',exact:true}).click();
  await a.locator('.live-race-self strong').waitFor();assert.equal(await a.locator('.live-race-self strong').innerText(),'Alice');
  if(authority){await a.locator('.live-race-self .live-race-avatar').waitFor();assert.equal(await a.locator('.live-race-self img').count(),0,'Unavailable player avatar must show a stable placeholder');}
  assert.equal(await a.locator('.live-race-rival strong').count(),0);assert.match(await a.locator('.live-race-status').innerText(),/Finding opponent/);
  const geometry=await a.evaluate(()=>{const lobby=document.querySelector('.live-race-lobby').getBoundingClientRect();const self=document.querySelector('.live-race-self').getBoundingClientRect();const status=document.querySelector('.live-race-status').getBoundingClientRect();return {lobby,self,status};});
  assert.ok(geometry.self.y<geometry.status.y);assert.ok(Math.abs(geometry.status.x+geometry.status.width/2-(geometry.lobby.x+geometry.lobby.width/2))<2);
  assert.ok(Math.abs(geometry.status.y+geometry.status.height/2-(geometry.lobby.y+geometry.lobby.height/2))<2,'Search status occupies the vertical center of the lobby');
  assert.ok(geometry.lobby.y+geometry.lobby.height>viewport.height-50,'Lobby fills the available screen height');
  await a.screenshot({path:path.join(output,`searching-${viewport.width}.png`),fullPage:true});
  await b.goto(baseUrl+'/?user=Bob');await b.getByRole('button',{name:'History People, events, and eras from the past',exact:true}).click();await b.getByRole('button',{name:'Start PvP match',exact:true}).click();
  await b.locator('.live-race-search-wheel[data-phase=countdown]').waitFor();assert.equal(await b.locator('.live-race-search-wheel[data-phase=countdown]').innerText(),'');
  await a.locator('.live-race-rival strong').waitFor();assert.equal(await a.locator('.live-race-rival strong').innerText(),'Bob');
  assert.equal(await b.locator('.live-race-rival strong').innerText(),'Alice');
  if(authority)await b.locator('.live-race-rival .live-race-avatar').waitFor();
  if(authority)for(const page of [a,b])assert.equal(await page.evaluate(()=>window.liveSnapshots.filter(view=>view.phase==='countdown').every(view=>view.run.currentRiddle===null)),true,'Neither player may inspect the first riddle during countdown');
  await a.screenshot({path:path.join(output,`countdown-${viewport.width}.png`),fullPage:true});
  await a.locator('.race-gameplay .guess-board').waitFor({timeout:15000});await b.locator('.race-gameplay .guess-board').waitFor({timeout:15000});

  // Current live gameplay owns the multilingual input coverage formerly exercised by recorded races.
  const nativeInput=a.locator('.race-native-answer-input');
  for(const {committed,rendered} of [
   {committed:'e\u0301',rendered:'é'},{committed:'نَ',rendered:'نَ'},{committed:'Ж',rendered:'Ж'},
   {committed:'क्ष',rendered:'क्ष'},{committed:'日',rendered:'日'},{committed:'한',rendered:'한'},{committed:'中',rendered:'中'},
  ]){
   await nativeInput.evaluate((element,value)=>{
    element.focus({preventScroll:true});
    element.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:value}));
    element.value=value;
    element.dispatchEvent(new InputEvent('input',{bubbles:true,data:value,inputType:'insertCompositionText',isComposing:true}));
    element.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:value}));
   },committed);
   await a.waitForFunction(value=>document.querySelector('.race-gameplay .guess-row .cell')?.textContent===value,rendered);
   assert.equal(await a.locator('.race-gameplay .guess-row .cell').nth(1).innerText(),'','Composition commits one grapheme exactly once');
   const accepted=await nativeInput.evaluate(element=>element.dispatchEvent(new InputEvent('beforeinput',{
    bubbles:true,cancelable:true,inputType:'deleteContentBackward',
   })));
   assert.equal(accepted,false,'Software backspace consumes one live answer slot');
   await a.waitForFunction(()=>document.querySelector('.race-gameplay .guess-row .cell')?.textContent==='');
  }
  await nativeInput.fill('日本語');
  await a.waitForFunction(()=>[...document.querySelectorAll('.race-gameplay .guess-row .cell')].map(cell=>cell.textContent).join('')==='日本語');
  for(let index=0;index<3;index++)await nativeInput.press('Backspace');
  await a.waitForFunction(()=>[...document.querySelectorAll('.race-gameplay .guess-row .cell')].every(cell=>cell.textContent===''));
  console.log('Live multilingual IME, paste, and physical/software deletion passed at '+viewport.width+'px.');

  if(push && authority){
   await a.waitForFunction(()=>window.livePushConnected===true).catch(async error=>{console.error(await a.evaluate(()=>({connected:window.livePushConnected,signals:window.livePushEvents,requests:window.liveRequests})));throw error;});
   await a.waitForTimeout(500);
   const before=await a.evaluate(()=>window.liveRequests.filter(request=>request.action==='poll').length);
   await a.waitForTimeout(3250);
   const count=await a.evaluate(before=>window.liveRequests.filter(request=>request.action==='poll').length-before,before);
   assert.ok(count<=1,'Connected push must remove the half-second polling wait and use only reconciliation');
   latency.push({viewport:viewport.width,pollWindowMs:3250,pollCount:count});
  }
  if(!authority){
   const before=await a.evaluate(()=>window.liveRequests.filter(request=>request.action==='poll').length);
   await a.waitForTimeout(3250);
   const requests=await a.evaluate(before=>window.liveRequests.filter(request=>request.action==='poll').slice(before),before);
   assert.ok(push ? requests.length<=1 : requests.length>=5 && requests.length<=8,'Foreground human progress must poll twice per second without overlapping requests');
   latency.push({viewport:viewport.width,pollWindowMs:3250,pollCount:requests.length,pollIntervalsMs:requests.slice(1).map((request,index)=>request.at-requests[index].at)});
   console.log('Foreground human polling at '+viewport.width+'px: '+requests.length+' observations in 3.25 seconds.');
  }
  await solve(b);await b.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10'));
  await a.waitForFunction(()=>document.querySelector('.race-progress > div:nth-child(2) strong').textContent.includes('1 / 10'));
  if(!authority){latency.at(-1).opponentDisplayDelayMs=Date.now()-lastGuessCommittedAt;}
  await a.screenshot({path:path.join(output,`live-progress-${viewport.width}.png`),fullPage:true});
  if(push && authority){
   await a.locator('.guess-row .cell:not([disabled])').first().click();await a.keyboard.type('a');
   const before=await a.evaluate(()=>window.liveRequests.filter(request=>request.action==='poll').length);
   let releasePoll, capturedPoll, fulfilledPoll;
   const captured=new Promise(resolve=>{capturedPoll=resolve;});
   const release=new Promise(resolve=>{releasePoll=resolve;});
   const fulfilled=new Promise(resolve=>{fulfilledPoll=resolve;});
   let held=false;
   const hold=async route=>{
    if(held || route.request().postDataJSON().action!=='poll'){await route.continue();return;}
    held=true;const old=await route.fetch();capturedPoll();await release;await route.fulfill({response:old});fulfilledPoll();
   };
   await a.route('**/live/update',hold);await a.evaluate(()=>window.notifyLive());
   await Promise.race([captured,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No held observation')),4000))]);
   const pushBefore=await a.evaluate(()=>window.livePushEvents);
   const committedAt=Date.now();await solve(b);
   await a.waitForFunction(before=>window.livePushEvents>before,pushBefore);
   releasePoll();await fulfilled;await a.unroute('**/live/update',hold);
   await a.waitForFunction(()=>document.querySelector('.race-progress > div:nth-child(2) strong').textContent.includes('2 / 10'));
   latency.at(-1).pushActionToDisplayMs=Date.now()-committedAt;
   latency.at(-1).pushReceiptToDisplayMs=Math.max(0,Date.now()-authority.lastCommitAt());
   assert.ok(Date.now()-committedAt<1500,'A notification queued during an observation must refresh before the five-second watchdog');
   assert.equal(await a.locator('.guess-row .cell').first().innerText(),'A','Push must preserve a typed draft');
   await a.keyboard.press('Backspace');
   await a.evaluate(()=>window.breakPush());await a.waitForTimeout(1700);
   const fallbackPolls=await a.evaluate(before=>window.liveRequests.filter(request=>request.action==='poll').length-before,before);
   assert.ok(fallbackPolls>=3,'Connection loss resumes fast polling immediately');
   console.log('Push queued during a held observation delivered opponent progress and preserved the draft; disconnection resumed fast polling.');
  }
  if(!authority){
   let captured,release,timeout,held=false;
   const capturedPoll=new Promise(resolve=>{captured=resolve;});
   const releasePoll=new Promise(resolve=>{release=resolve;});
   const holdPoll=async route=>{
    if(held || route.request().postDataJSON().action!=='poll'){await route.continue();return;}
    held=true;const stale=await route.fetch();captured();await releasePoll;await route.fulfill({response:stale});
   };
   await a.route('**/live/update',holdPoll);
   try{
    await Promise.race([capturedPoll,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('No progress poll to supersede')),8000);})]).finally(()=>clearTimeout(timeout));
    const commandStartedAt=Date.now();
    await solve(a);await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10'));
    latency.at(-1).commandWhilePollHeldMs=Date.now()-commandStartedAt;
    assert.ok(latency.at(-1).commandWhilePollHeldMs<1500,'A guess must complete before the held background poll times out');
    const returned=a.waitForResponse(response=>response.url().endsWith('/live/update') && response.request().postDataJSON().action==='poll');
    release();await returned;
    await a.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.match(await a.locator('.race-progress > div:first-child strong').innerText(),/1 \/ 10/,'Late superseded polls must not rewind the accepted guess');
    console.log('A player guess superseded a held background poll without rewinding progress at '+viewport.width+'px.');
   }finally{release();await a.unroute('**/live/update',holdPoll);}
  }
  for(let i=0;i<8;i++){await solve(a);await a.waitForFunction(count=>document.querySelector('.race-progress > div:first-child strong').textContent.includes(count+' / 10'),i+(authority?1:2));}
  if(authority){
   await a.locator('.race-actions button').first().click();
   await a.waitForFunction(()=>window.liveSnapshots.at(-1).run.currentRiddle.revealedLetters.length===1);
   const wrongAttempts=viewport.width===1280?1:RACE_RULES.maxGuessesPerRiddle;
   for(let index=0;index<wrongAttempts;index++){
    await a.locator('.guess-row .cell:not([disabled])').first().click();await a.keyboard.type('x'.repeat((await authority.answer('Alice')).length));
    if(index===0){assert.equal(await a.locator('.race-actions .submit-action').isDisabled(),false,'Hint time must not block submitting');assert.equal(await a.locator('.live-race-cooldown').count(),0);}
    await a.waitForFunction(()=>!document.querySelector('.race-actions .submit-action').disabled,null,{timeout:RACE_RULES.hintPenaltyMs+5000});
    await a.locator('.race-actions .submit-action').click();
    await a.waitForFunction(expected=>{const riddle=window.liveSnapshots.at(-1).run?.currentRiddle;return expected===5?riddle?.position===9:riddle?.guessesUsed===expected;},index+1);
   }
   if(viewport.width===1280)await a.locator('.race-actions button').last().click();
   await a.waitForFunction(()=>window.liveSnapshots.at(-1).run?.currentRiddle?.position===9);
   const current=await a.evaluate(()=>window.liveSnapshots.at(-1));
   assert.equal(current.player.correctCount,9);assert.equal(current.rewardCoins,0);
   assert.deepEqual(current.run.currentRiddle.revealedLetters,[]);assert.deepEqual(current.run.currentRiddle.confirmedGuesses,[]);
   assert.equal(current.run.currentRiddle.guessesUsed,0);assert.equal(current.run.currentRiddle.guessesRemaining,RACE_RULES.maxGuessesPerRiddle);
   assert.deepEqual(await authority.balances(),[100,100],'Nine completed riddles must not settle the race');
   await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent==='Riddles completed: 9 / 10');
   await b.waitForFunction(()=>document.querySelector('.race-progress > div:nth-child(2) strong').textContent==='Riddles completed: 9 / 10');
   const nextRiddleId=current.run.currentRiddle.riddleId;
   await a.screenshot({path:path.join(output,`skip-progress-${viewport.width}.png`),fullPage:true});
   await a.reload();await a.getByRole('button',{name:'History People, events, and eras from the past',exact:true}).click();
   await a.getByRole('button',{name:'Start PvP match',exact:true}).click();
   await a.locator('.race-gameplay .guess-board').waitFor().catch(async error=>{
    console.error(await a.evaluate(()=>({snapshots:window.liveSnapshots,text:document.querySelector('.race-screen')?.textContent})));
    await a.screenshot({path:path.join(output,`reload-failure-${viewport.width}.png`),fullPage:true});throw error;
   });
   assert.equal(await a.evaluate(()=>window.liveSnapshots.at(-1).run.currentRiddle.riddleId),nextRiddleId,'Reload must restore the current question');
   assert.equal((await a.locator('.race-progress > div:first-child strong').innerText()).replace(/\s+/g,' '),'Riddles completed: 9 / 10');
   await a.locator('.race-actions button').first().click();
   await a.waitForFunction(()=>window.liveSnapshots.at(-1).run.currentRiddle.revealedLetters.length===1);
   assert.equal(await a.locator('.race-actions button').first().isDisabled(),false,'Skip time must not block the next hint');
   await a.waitForFunction(()=>!document.querySelector('.race-actions button').disabled,null,{timeout:RACE_RULES.skipPenaltyMs+5000});
   console.log('Hint and '+(viewport.width===1280?'manual skip':'exhausted guesses')+' advanced the completed-riddle counter and preserved the current question on reload at '+viewport.width+'px.');
  }
  await solve(a);
  if(authority){
   await a.locator('.race-outcome-loading').waitFor();
   assert.equal(await a.locator('.race-outcome-loading').innerText(),'Waiting for your opponent to finish…');
   assert.equal(await a.locator('.live-race-victory').count(),0);
   assert.equal(await a.evaluate(()=>window.completed),0);
   assert.deepEqual(await authority.balances(),[100,100],'An early penalized finish must not grant coins');
   await b.waitForFunction(()=>window.liveSnapshots.at(-1).opponent.correctCount===10);
   assert.equal(await b.locator('.race-gameplay .guess-board').count(),1,'Rival must retain their active riddle');
   const frozenClock=await a.locator('.race-header-clock strong').innerText();
   await b.locator('.guess-row .cell:not([disabled])').first().click();await b.keyboard.type('a');
   await b.waitForTimeout(1200);
   assert.equal(await a.locator('.race-header-clock strong').innerText(),frozenClock,'Finished adjusted time must stay frozen');
   assert.equal(await b.locator('.guess-row .cell').first().innerText(),'A','Progress polls must preserve the rival draft');
   await a.screenshot({path:path.join(output,`penalty-waiting-${viewport.width}.png`),fullPage:true});
   await b.screenshot({path:path.join(output,`rival-continues-${viewport.width}.png`),fullPage:true});
   if(viewport.width===390){
    await b.keyboard.press('Backspace');
    for(let index=push?2:1;index<10;index++){await solve(b);if(index<9)await b.waitForFunction(count=>window.liveSnapshots.at(-1).player.correctCount===count,index+1);}
   }else await authority.expireFinishWindow('Alice');
  }
  await a.locator('.live-race-victory').waitFor();await b.locator('.live-race-victory').waitFor({timeout:10000});
  const rivalWins=authority && viewport.width===390;
  assert.equal(await (rivalWins?b:a).locator('.live-race-reward').innerText(),'+50 coins');assert.equal(await (rivalWins?a:b).locator('.live-race-reward').count(),0);
  assert.equal(await a.evaluate(()=>window.completed),1);assert.equal(await b.evaluate(()=>window.completed),1);
  assert.equal(await a.locator('.race-gameplay').count(),0);await a.screenshot({path:path.join(output,`victory-${viewport.width}.png`),fullPage:true});
  if(authority) assert.deepEqual(await authority.balances(),rivalWins?[100,150]:[150,100]);
  assert.deepEqual(await a.evaluate(()=>[...new Set(window.bridgeCalls)]),['game:listRaceCategories']);
  assert.equal(await a.evaluate(()=>window.legacyFindCalls),0);
  await a.getByRole('button',{name:'Close Race to 10',exact:true}).last().click();
  await a.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();
  assert.equal(await a.locator('.race-hub-tabs,.race-inbox,.race-challenge-card').count(),0);
  assert.deepEqual(errors,[]);console.log(`Live PvP passed at ${viewport.width}px: intro, lobby identities, countdown, progress, ${authority?'penalty window and adjusted-time settlement':'immediate unpenalized victory'}, and one 50-coin grant.`);
  await context.close();
 }
 reset();await authority?.reset();const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();await page.goto(baseUrl+'/?user=Alice');
 await page.getByRole('button',{name:'Start PvP match',exact:true}).click();await page.locator('.live-race-self strong').waitFor();if(authority)await authority.expireSearch('Alice');else tickets.get('Alice').created=Date.now()-60000;
 await page.locator('.live-race-rival strong').waitFor();assert.equal(await page.locator('.live-race-rival strong').innerText(),'Opponent');
 const assertNeutralOpponent=async()=>assert.doesNotMatch(await page.locator('.race-screen').innerText(),/\bbot\b|🤖/i);
 await assertNeutralOpponent();
 await page.screenshot({path:path.join(output,'opponent-countdown-390.png'),fullPage:true});
 await page.locator('.race-gameplay').waitFor({timeout:15000});
 assert.match(await page.locator('.race-scoreboard').innerText(),/Opponent/);await assertNeutralOpponent();
 await page.screenshot({path:path.join(output,'opponent-gameplay-390.png'),fullPage:true});
 if(!authority){
  for(let index=0;index<10;index++){await solve(page);if(index<9)await page.waitForFunction(count=>window.liveSnapshots.at(-1).player.correctCount===count,index+1);}
  await page.locator('.live-race-victory').waitFor();
  assert.match(await page.locator('.race-result-score').innerText(),/Opponent/);await assertNeutralOpponent();
  await page.screenshot({path:path.join(output,'opponent-result-390.png'),fullPage:true});
 }
 await context.close();
 const unavailable=await browser.newPage({viewport:{width:390,height:844}});await unavailable.goto(baseUrl+'/?unavailable=1&challenge=retired-ghost');
 await unavailable.getByRole('alert').waitFor();assert.match(await unavailable.getByRole('alert').innerText(),/unavailable for this account/);
 assert.equal(await unavailable.getByRole('button',{name:'Start PvP match',exact:true}).isDisabled(),true);
 assert.deepEqual(await unavailable.evaluate(()=>[...new Set(window.bridgeCalls)]),['game:listRaceCategories']);await unavailable.close();
 console.log('Retired links, category selection, PvP-only return navigation and missing live capability passed.');
 console.log('Bot fallback UI passed at 390px; server deadline advanced through the injected transport.');
 await writeFile(path.join(output,'polling-latency.json'),JSON.stringify({transport:'injected local HTTP authority; not production latency',pushEnabled:push,samples:latency},null,2));
}finally{await browser?.close();await authority?.clear();for(const stream of streams.values())stream.end();streams.clear();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(scratch,{recursive:true,force:true});}
