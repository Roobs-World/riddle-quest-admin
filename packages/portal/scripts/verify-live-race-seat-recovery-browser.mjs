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
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-seat-recovery-"));
const output = path.resolve(root, "../../artifacts/live-pvp-seat-recovery/browser");
await mkdir(output, {recursive:true});
const authority = await (await import("./live-race-emulator.mjs")).createLiveRaceEmulator();
const fixtureRequire = createRequire(path.join(root,"../../firebase-functions/package.json"));
const fixtureDb = fixtureRequire("firebase-admin/firestore").getFirestore();
const source = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
const services=createFakeRaceServices(); const user=new URLSearchParams(location.search).get('user') || 'Alice';
const call=async (action,input)=>{const response=await fetch('/live/'+action,{method:'POST',body:JSON.stringify({user,...input})}); if(!response.ok) throw new Error('Harness transport failed'); return response.json();};
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
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{
  try {
   const url=new URL(request.url,'http://localhost');
   if(url.pathname==='/avatar.svg'){response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#75baff"/><circle cx="50" cy="42" r="22" fill="#18365b"/></svg>');return;}
   if(url.pathname.startsWith('/live/')) {
    let body='';for await(const chunk of request) body+=chunk; const input=JSON.parse(body);
    if(authority){const result=await authority.call(url.pathname.endsWith("join")?"join":"update",input);response.setHeader("Content-Type","application/json");response.end(JSON.stringify(result));return;}
    if(url.pathname==='/live/join' && !tickets.has(input.user)) {
     tickets.set(input.user,{user:input.user,id:(input.user==='Alice'?'a':'b').repeat(64),count:0,created:Date.now()});
     if(tickets.size===2) started=Date.now()+5000;
    }
    const ticket=tickets.get(input.user);
    if(input.action==='guess' && winner===null && Date.now()>=started && input.guess==='test') {
     ticket.count++; if(ticket.count===10) winner=input.user;
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
  await authority.reset();const context=await browser.newContext({viewport});const a=await context.newPage(),b=await context.newPage();const errors=[];
  await context.route("https://live-race.invalid/**",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}));
  for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
  async function enter(page,user,reload=false){if(reload)await page.reload();else await page.goto(baseUrl+'/?user='+user);await page.getByRole('button',{name:'Start PvP match',exact:true}).click();}
  async function solve(page){await page.locator('.guess-row .cell:not([disabled])').first().click();await page.keyboard.type(await authority.answer('Alice'));await page.locator('.race-actions .submit-action').click();}
  await enter(a,'Alice');await a.locator('.live-race-self strong').waitFor();await enter(b,'Bob');
  await a.locator('.race-gameplay .guess-board').waitFor({timeout:15000});await solve(a);
  await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10'));
  await fixtureDb.recursiveDelete(fixtureDb.collection('localizedRiddles/en/riddles'));
  assert.equal((await fixtureDb.collection('localizedRiddles/en/riddles').get()).size,0);
  await enter(a,'Alice',true);await a.locator('.race-gameplay .guess-board').waitFor({timeout:10000});
  await a.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong').textContent.includes('1 / 10'));
  await enter(b,'Bob',true);await b.locator('.race-gameplay .guess-board').waitFor({timeout:10000});
  await b.waitForFunction(()=>document.querySelector('.race-progress > div:nth-child(2) strong').textContent.includes('1 / 10'));
  assert.equal((await fixtureDb.collection('liveRaceMatches').get()).size,1);assert.equal((await fixtureDb.collection('liveRaceTickets').get()).size,2);
  for(let count=2;count<=10;count++){await solve(a);if(count<10)await a.waitForFunction(count=>document.querySelector('.race-progress > div:first-child strong').textContent.includes(count+' / 10'),count);}
  await a.locator('.live-race-victory').waitFor();await b.locator('.live-race-victory').waitFor({timeout:10000});
  assert.equal(await a.locator('.live-race-reward').innerText(),'+50 coins');assert.deepEqual(await authority.balances(),[150,100]);
  assert.equal(await a.evaluate(()=>window.completed),1);assert.equal(await b.evaluate(()=>window.completed),1);assert.deepEqual(errors,[]);
  await a.screenshot({path:path.join(output,'recovered-win-'+viewport.width+'.png'),fullPage:true});
  console.log('Real Firestore PvP recovered both players after catalog removal and settled one 50-coin win at '+viewport.width+'px.');await context.close();
 }

}finally{await browser?.close();await authority?.clear();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
