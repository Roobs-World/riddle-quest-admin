import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.LIVE_WATCHDOG_REACT_MODE??'development',baseline=process.env.LIVE_WATCHDOG_BASELINE_FILE;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.LIVE_WATCHDOG_REPORT_DIR??path.join(root,'builds/test-evidence/live-signal-watchdog-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-watchdog-'));
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,"src/races/components/live/LiveRaceGame.tsx"))};
import {observeFirebaseLiveRace} from ${JSON.stringify(path.join(root,"src/races/transport/browser/firebaseLiveRaceSignals.ts"))};
import {RACE_RULES,LiveRaceViewSchema} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {liveRacePollInterval} from ${JSON.stringify(path.join(root,"src/races/live/liveRacePolling.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
const scenario=new URLSearchParams(location.search).get('scenario')??'eof',revision='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
window.probe={streams:[],notifications:0,statuses:[],calls:[],joins:0,releases:[],errors:[],unhandled:[],view:null};
window.addEventListener('error',e=>probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>probe.unhandled.push(String(e.reason)));
window.fixtureStream=async(_input,{signal})=>{
 const index=probe.streams.length,entry={index,aborted:signal.aborted};probe.streams.push(entry);signal.addEventListener('abort',()=>{entry.aborted=true;},{once:true});
 if(index===0&&scenario==='headers')return new Promise(resolve=>probe.releases.push(()=>resolve({data:new Promise(()=>{}),stream:(async function*(){yield {revision:'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'};})()})));
 if(index===0&&scenario!=='healthy')return {data:new Promise(()=>{}),stream:(async function*(){yield {revision};if(scenario==='pending'){while(!probe.breakStream){await new Promise(resolve=>setTimeout(resolve,50));yield {revision};}}if(scenario==='chunks'||scenario==='retire'||scenario==='pending'){await new Promise(resolve=>probe.releases.push(resolve));yield {revision:'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee'};}})()};
 return {data:new Promise(()=>{}),stream:(async function*(){try{while(!signal.aborted){yield {revision:index===0?revision:'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'};await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();},timer=setTimeout(finish,50);signal.addEventListener('abort',finish,{once:true});if(signal.aborted)finish();});}}finally{}})()};
};
window.interval=()=>liveRacePollInterval(probe.view,true,window.signalRef.current);
let correct=0;const start=Date.now()-1000,ticket='a'.repeat(64),identity=(name,count)=>({displayName:name,avatarUrl:null,bot:false,correctCount:count});
const snapshot=()=>{const now=Date.now();return probe.view=LiveRaceViewSchema.parse({ticketId:ticket,phase:'racing',serverNowMs:now,searchEndsAtMs:start+60000,startsAtMs:start,player:identity('Alice',correct),opponent:identity('Bob',0),result:null,rewardCoins:0,run:{runId:ticket,role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:correct,wallElapsedMs:now-start,totalPenaltyMs:0,adjustedElapsedMs:now-start,events:[],serverNowMs:now,startsAtMs:start,currentRiddle:{riddleId:'q'+correct,text:'What has keys but cannot open doors?',answerLength:5,position:correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Bob',adjustedFinishMs:300000,events:[]}}});};
const transport={join:async()=>{probe.joins++;return snapshot();},update:async input=>{probe.calls.push(input.action);if(input.action==='guess'){correct++;if(scenario==='pending'&&!probe.commandHeld){probe.commandHeld=true;return new Promise(resolve=>probe.releaseCommand=()=>resolve(snapshot()));}}return snapshot();},observe(ticket,change,status){status(false);return observeFirebaseLiveRace(ticket,()=>{probe.notifications++;change();},connected=>{probe.statuses.push(connected);status(connected);});}};
function App(){const [mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0);return <><nav style={{position:'fixed',bottom:0,left:0,zIndex:10000,background:'white'}}><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button><button data-break onClick={()=>{probe.breakStream=true;}}>Break stream</button><button data-retire onClick={()=>setMounted(false)}>Retire race</button><span>{epoch}</span></nav>{mounted?<LiveRaceGame transport={transport} locale='en' categoryId='mixed' ownerId='Alice' coins={100} onClose={()=>setMounted(false)}/>:<p data-retired>Retired fixture</p>}</>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-watchdog-injection',enforce:'pre',async load(id){if(id===path.join(root,"src/platform/firebase/browserClient.ts"))return 'export const updateLiveRace={stream:(...args)=>window.fixtureStream(...args)};';if(id.endsWith('/firebaseLiveRaceSignals.ts')){const source=await readFile(baseline??id,'utf8');assert(source.includes('15_000'));assert(source.includes('500 * 2'));return source.replaceAll('15_000','300').replace('500 * 2','40 * 2');}if(id.endsWith('/useLiveRaceSignals.ts')){const source=await readFile(id,'utf8');assert(source.includes('return connected;'));return source.replace('return connected;','window.signalRef=connected;return connected;');}}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_WATCHDOG_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.LIVE_WATCHDOG_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_WATCHDOG_CASES?.split(',')??['eof','headers','chunks','healthy','retire','pending']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.goto(url+'/?scenario='+scenario);await page.locator('.race-native-answer-input').waitFor();await page.waitForFunction(()=>probe.streams.length===1);await settle();
  metric('one mounted player owns one join',await page.evaluate(()=>probe.joins),1);
  let pendingPolls=0;if(scenario==='pending'){await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.waitForFunction(()=>typeof probe.releaseCommand==='function');await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');pendingPolls=await page.evaluate(()=>probe.calls.filter(x=>x==='poll').length);await page.locator('[data-break]').click();}
  if(scenario==='retire'){await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();}
  await page.waitForTimeout(450);await settle();
  metric('only a failed connection renews the SDK wait',await page.evaluate(()=>probe.streams.length),['healthy','retire'].includes(scenario)?1:2);
  metric('retired or failed connection signals abort',await page.evaluate(()=>probe.streams[0].aborted),scenario!=='healthy');
  metric('a live recovered connection restores push health',await page.evaluate(()=>window.signalRef.current),scenario!=='retire');
  metric('poll cadence returns to the healthy watchdog',await page.evaluate(()=>window.interval()),scenario==='retire'?500:5000);
  metric('one new revision wakes a recovered match exactly once',await page.evaluate(()=>probe.notifications),scenario==='headers'?1:scenario==='healthy'||scenario==='retire'?1:2);
  const current=await page.evaluate(()=>({streams:probe.streams.length,notifications:probe.notifications,statuses:probe.statuses.length}));
  await page.evaluate(()=>probe.releases.forEach(release=>release()));await settle();
  metric('late obsolete headers or chunks cannot publish a revision',await page.evaluate(()=>probe.notifications),current.notifications);
  metric('late obsolete channels cannot change admitted health',await page.evaluate(()=>window.signalRef.current),scenario!=='retire');
  if(scenario==='pending'){metric('watchdog recovery does not displace the player command',await page.evaluate(()=>probe.calls.filter(x=>x==='poll').length),pendingPolls);metric('the held command keeps native drafting admitted',await page.locator('.race-native-answer-input').isEnabled(),true);metric('watchdog recovery does not resubmit a draft',await page.evaluate(()=>probe.calls.filter(x=>x==='guess').length),1);await page.evaluate(()=>probe.releaseCommand());await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));await settle();metric('a confirmed next question clears the prior held draft',await page.locator('.guess-row button:not([disabled])').allTextContents(),['','','','','']);}
  if(scenario!=='retire'){
   for(let i=0;i<8;i++)await page.locator('[data-parent]').click();metric('parent updates preserve the recovered connection',await page.evaluate(()=>probe.streams.length),current.streams);
   await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.waitForFunction(n=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes(n+' / 10'),scenario==='pending'?2:1);
   metric('native answer submission advances once',await page.evaluate(()=>probe.calls.filter(x=>x==='guess').length),scenario==='pending'?2:1);
   await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();
  }
  const retired=await page.evaluate(()=>({streams:probe.streams.length,notifications:probe.notifications,statuses:probe.statuses.length}));await page.waitForTimeout(400);await page.evaluate(()=>probe.releases.forEach(release=>release()));await settle();
  metric('retirement releases every SDK connection',await page.evaluate(()=>probe.streams.every(x=>x.aborted)),true);
  metric('retirement cancels future renewal',await page.evaluate(()=>probe.streams.length),retired.streams);metric('retirement cancels queued change callbacks',await page.evaluate(()=>probe.notifications),retired.notifications);metric('retirement cancels queued health callbacks',await page.evaluate(()=>probe.statuses.length),retired.statuses);
  metric('the owned seat leaves exactly once',await page.evaluate(()=>probe.calls.filter(x=>x==='leave').length),1);metric('browser errors',await page.evaluate(()=>probe.errors),[]);metric('unhandled rejections',await page.evaluate(()=>probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[scenario,width,height].join('-')+'.png')});await context.close();
 }
 const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.LIVE_WATCHDOG_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live signal watchdog recovery');
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.LIVE_WATCHDOG_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
