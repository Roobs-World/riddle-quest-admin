import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.LIVE_SIGNAL_REACT_MODE??'development',baseline=process.env.LIVE_SIGNAL_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.LIVE_SIGNAL_REPORT_DIR??path.join(root,'../../builds/test-evidence/live-signal-failures-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-signal-failures-'));let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 const viewFixture="function view(seat){const now=Date.now();return LiveRaceViewSchema.parse({ticketId:seat.id,phase:seat.left?'cancelled':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,player:{displayName:seat.owner,avatarUrl:null,bot:false,correctCount:seat.correct},opponent:{displayName:'Rival',avatarUrl:null,bot:false,correctCount:0},result:null,rewardCoins:0,run:seat.left?null:{runId:seat.id,role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:now-seat.start,totalPenaltyMs:0,adjustedElapsedMs:now-seat.start,events:[],serverNowMs:now,startsAtMs:seat.start,currentRiddle:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Rival',avatarUrl:null,adjustedFinishMs:300000,events:[]}}});}\n";
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/play/race/LiveRaceGame.tsx'))};
import {RACE_RULES,LiveRaceViewSchema} from '@riddle-quest/core/race';
import {liveRacePollInterval} from ${JSON.stringify(path.join(root,'src/play/race/logic/liveRacePolling.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};import ${JSON.stringify(path.join(root,'src/styles.race-gameplay.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URL(location.href).searchParams.get('scenario')??'register';
window.probe={requests:[],joins:[],adds:[],removes:[],refreshes:[],retained:[],errors:[],unhandled:[],views:{}};window.signalRefs={};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
${viewFixture}
function adapter(owner){const seat={owner,id:(owner==='Alice'?'a':'b').repeat(64),start:Date.now()-1000,correct:0,left:false};const snapshot=()=>window.probe.views[owner]=view(seat);return {owner,
 join:async input=>{window.probe.joins.push({owner,...input});return snapshot();},
 update:async input=>{window.probe.requests.push({owner,...input});if(input.action==='leave')seat.left=true;if(input.action==='guess'){if(input.guess!=='piano')throw new Error('Unexpected fixture answer');seat.correct++;}return snapshot();},
 observe(ticketId,change,status){window.probe.adds.push(owner);window.probe.retained.push({owner,change,status});status(true);if(scenario==='register'&&owner==='Alice')throw Error('Injected push registration failure');return ()=>{window.probe.removes.push(owner);if(scenario==='cleanup'&&owner==='Alice')throw Error('Injected push cleanup failure');};}};}
const adapters={Alice:adapter('Alice'),Bob:adapter('Bob')};
window.interval=owner=>liveRacePollInterval(window.probe.views[owner],true,window.signalRefs[owner]?.current??false);
function App(){const [mounted,setMounted]=React.useState(true),[owner,setOwner]=React.useState('Alice'),[epoch,setEpoch]=React.useState(0);return <main data-owner={owner} data-epoch={epoch}>{mounted?<LiveRaceGame key={owner} transport={adapters[owner]} locale='en' categoryId='mixed' coins={100+epoch} ownerId={owner} onClose={()=>setMounted(false)}/>:<p data-retired>Race removed</p>}<button data-emit onClick={()=>{for(const x of window.probe.retained.filter(x=>x.owner==='Alice')){x.status(true);x.change();}}}>Emit retained signals</button><button data-disconnect onClick={()=>{for(const x of window.probe.retained.filter(x=>x.owner===owner))x.status(false);}}>Disconnect push</button><button data-retire onClick={()=>setMounted(false)}>Retire race</button><button data-replace onClick={()=>setOwner('Bob')}>Replace player</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></main>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'observe-real-signal-state',enforce:'pre',async load(id){if(!id.endsWith('/useLiveRaceSignals.ts'))return;let source=await readFile(baseline?path.join(baseline,'signals.before.txt'):id,'utf8');for(const [needle,replacement] of [['if (active) refresh();','if (active) {window.probe.refreshes.push(transport.owner); refresh();}'],['if (!status) refresh();','if (!status) {window.probe.refreshes.push(transport.owner); refresh();}'],['return connected;','window.signalRefs[transport.owner] = connected; return connected;']]){assert.equal(source.split(needle).length,2,needle);source=source.replace(needle,replacement);}return source;}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_SIGNAL_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.LIVE_SIGNAL_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_SIGNAL_SCENARIOS?.split(',')??['register','cleanup','normal','replace','retire']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});await page.goto(url+'/?scenario='+scenario);await page.locator('.race-native-answer-input').waitFor();await page.waitForFunction(()=>window.probe.adds.length>0);
  metric('initial push registration status matches its successful lifetime',await page.evaluate(()=>window.signalRefs.Alice.current),scenario!=='register');
  if(['cleanup','retire'].includes(scenario)){await page.locator('[data-retire]').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));metric('retirement keeps its parent intact',await page.locator('[data-retired]').count(),1);metric('retirement attempts the owned subscription cleanup',await page.evaluate(()=>window.probe.removes.filter(x=>x==='Alice').length),1);}
  if(scenario==='replace'){await page.locator('[data-replace]').click();await page.waitForFunction(()=>window.probe.joins.some(x=>x.owner==='Bob'));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));metric('replacement owns a connected subscription',await page.evaluate(()=>window.signalRefs.Bob.current),true);}
  const previous=await page.evaluate(()=>window.probe.refreshes.filter(x=>x==='Alice').length);
  if(await page.locator('[data-emit]').count())await page.locator('[data-emit]').click();
  metric('only a successfully mounted push lifetime delivers retained callbacks',await page.evaluate(n=>window.probe.refreshes.filter(x=>x==='Alice').length-n,previous),scenario==='normal'?1:0);
  metric('failed or retired callbacks cannot claim a healthy push connection',await page.evaluate(()=>window.signalRefs.Alice.current),scenario==='normal');
  if(['register','normal','replace'].includes(scenario)){
   const owner=scenario==='replace'?'Bob':'Alice';
   metric('poll cadence matches the admitted connection',await page.evaluate(x=>window.interval(x),owner),scenario==='register'?500:5000);
   if(process.env.LIVE_SIGNAL_SMOKE!=='1'){
    if(scenario==='normal'){await page.locator('[data-disconnect]').click();metric('disconnect promptly restores fast fallback cadence',await page.evaluate(()=>window.interval('Alice')),500);}
    if(scenario==='register'){const polls=await page.evaluate(()=>window.probe.requests.filter(x=>x.owner==='Alice'&&x.action==='poll').length);/* A 500 ms cadence must produce a new poll; allow slow runners' timer drift instead of a fixed 1.1 s sleep. */metric('failed push retains real foreground polling recovery',await page.waitForFunction(n=>window.probe.requests.filter(x=>x.owner==='Alice'&&x.action==='poll').length>n,polls,{timeout:5000}).then(()=>true,()=>false),true);}
    const adds=await page.evaluate(()=>window.probe.adds.length),removes=await page.evaluate(()=>window.probe.removes.length);for(let i=0;i<8;i++)await page.locator('[data-parent]').click();metric('ordinary parent updates preserve subscription registration',await page.evaluate(()=>window.probe.adds.length),adds);metric('ordinary parent updates do not clean up the current subscription',await page.evaluate(()=>window.probe.removes.length),removes);
    await page.locator('.race-native-answer-input').focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));metric('the current player can submit and advance once',await page.evaluate(x=>window.probe.requests.filter(r=>r.owner===x&&r.action==='guess').length,owner),1);
   }
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.LIVE_SIGNAL_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.LIVE_SIGNAL_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live race optional signal failures');
