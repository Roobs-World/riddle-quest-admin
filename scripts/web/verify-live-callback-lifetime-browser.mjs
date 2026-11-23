import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.LIVE_CALLBACK_REACT_MODE??'development',baseline=process.env.LIVE_CALLBACK_BASELINE_DIR;
const output=path.resolve(process.env.LIVE_CALLBACK_REPORT_DIR??path.join(root,'builds/test-evidence/live-callback-lifetime-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-callback-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/web/play/race/LiveRaceGame.tsx'))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/web/play/race/RaceTo10Game.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import {RACE_RULES,LiveRaceViewSchema} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
import ${JSON.stringify(path.join(root,'src/web/styles.race-gameplay.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
window.probe={requests:[],joins:[],adds:0,removes:0,active:0,renderedEpochs:[],completions:[],closes:[],events:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:live-race-completed',e=>window.probe.events.push(e.detail));
const listeners=new Set(),query=new URLSearchParams(location.search),kind=query.get('kind')??'entry-parent';
function view(seat){const now=Date.now(),player={displayName:seat.owner,avatarUrl:null,bot:false,correctCount:seat.correct},opponent={displayName:'Bob',avatarUrl:null,bot:false,correctCount:0};
 return LiveRaceViewSchema.parse({ticketId:seat.id,phase:seat.left?'cancelled':seat.terminal?'result':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,player,opponent,result:seat.terminal?'win':null,rewardCoins:seat.terminal?50:0,...(seat.terminal?{newCoins:150}:{}),
 run:seat.left?null:{runId:seat.id,role:'creator',status:seat.terminal?'completed':'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:now-seat.start,totalPenaltyMs:0,adjustedElapsedMs:now-seat.start,events:[],serverNowMs:now,startsAtMs:seat.start,
 currentRiddle:seat.terminal?null:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Bob',avatarUrl:null,adjustedFinishMs:300000,events:[]}}});}
function adapter(owner){const seat={owner,id:(owner==='Alice'?'a':'c').repeat(64),start:Date.now()-1000,correct:0,left:false,terminal:false};
 return {join:async input=>{window.probe.joins.push({owner,...input});return view(seat);},update:async input=>{window.probe.requests.push({owner,...input});
 if(input.action==='guess'){if(input.guess.toLowerCase()!=='piano')throw Error('Unexpected fixture answer');seat.correct++;if(window.terminalNext){window.terminalNext=false;seat.correct=10;seat.terminal=true;}}
 if(input.action==='leave')seat.left=true;
 const result=view(seat);if(window.holdAction===input.action){window.holdAction=null;return new Promise(resolve=>{window.releaseReceipt=()=>{window.releaseReceipt=null;resolve(result);};});}return result;},
 observe(_ticket,refresh,status){window.probe.adds++;window.probe.active++;listeners.add(refresh);status(true);return ()=>{window.probe.removes++;window.probe.active--;listeners.delete(refresh);};}};}
const adapters={Alice:adapter('Alice'),Carol:adapter('Carol')},catalog=await createFakeRaceServices().listRaceCategories({locale:'en'});
window.notifyRace=()=>{for(const refresh of [...listeners])refresh();};
const pendingRender=new Promise(()=>{});function PendingRender(){throw pendingRender;}
function App(){const [mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0),[owner,setOwner]=React.useState('Alice');
 window.probe.renderedEpochs.push(epoch);window.speculate=()=>React.startTransition(()=>setEpoch(99));window.refresh=()=>setEpoch(x=>x+1);window.retire=()=>setMounted(false);window.replaceOwner=()=>setOwner('Carol');
 const stableClose=React.useCallback(()=>window.probe.closes.push(0),[]),stableCompleted=React.useCallback(()=>window.probe.completions.push(0),[]);
 const onClose=kind==='stable-parent'||kind==='stable-poll'||kind==='completed-parent'?stableClose:()=>window.probe.closes.push(epoch);
 const onCompleted=kind==='removed-result'&&epoch>0?undefined:kind==='stable-parent'||kind==='stable-poll'||kind==='close-parent'?stableCompleted:()=>window.probe.completions.push(epoch);
 const entry=kind.startsWith('entry-')||kind==='owner-change';return <React.Suspense fallback={<p>Pending fixture render</p>}><div data-epoch={epoch} data-owner={owner}>{mounted?(entry?<RaceTo10Game locale='en' ownerId={owner} coins={100+epoch} initialCategories={catalog.categories} postToHost={()=>{}} matchmaking={{live:adapters[owner]}} onLiveResult={onCompleted} onClose={onClose}/>:<LiveRaceGame key={owner} transport={adapters[owner]} locale='en' categoryId='mixed' ownerId={owner} coins={100+epoch} onCompleted={onCompleted} onClose={onClose}/>):<p data-testid='retired'>Retired fixture</p>}{epoch===99?<PendingRender/>:null}</div></React.Suspense>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'live-callback-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/LiveRaceGame.tsx'))return readFile(path.join(baseline,'LiveRaceGame.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_CALLBACK_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});const quick=process.env.LIVE_CALLBACK_QUICK==='1';
 for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.LIVE_CALLBACK_SCENARIOS?.split(',')??(quick?['entry-parent']:['entry-parent','entry-burst','entry-tab','stable-parent','close-parent','completed-parent','stable-poll','held-poll','held-guess','held-result','removed-result','speculative-result','held-leave','retired-result','owner-change'])) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,height,scenario,name,actual,expected});};
  await page.goto(url+'/?kind='+scenario);if(scenario.startsWith('entry-')||scenario==='owner-change')await page.getByRole('button',{name:'Start PvP match',exact:true}).click();
  await page.locator('.race-native-answer-input').waitFor();await page.waitForFunction(()=>window.probe.active===1);
  const input=page.locator('.race-native-answer-input'),letters=()=>page.locator('.guess-row:has([aria-current="true"]) button').allTextContents().then(values=>values.join('').toLowerCase());
  await input.focus();await page.keyboard.type('pian');metric('native typing prepares the draft',await letters(),'pian');
  if(scenario==='entry-tab')await page.keyboard.press('Tab');
  await page.evaluate(()=>{window.focused=document.activeElement;window.editor=document.querySelector('.race-native-answer-input');window.before={polls:window.probe.requests.filter(x=>x.action==='poll').length,adds:window.probe.adds,removes:window.probe.removes,joins:window.probe.joins.length};});
  if((scenario==='held-poll'||scenario==='stable-poll'))await page.evaluate(()=>{window.holdAction='poll';window.notifyRace();});
  if(['held-result','removed-result','speculative-result','retired-result','owner-change'].includes(scenario)){await page.evaluate(()=>{window.holdAction='guess';window.terminalNext=true;});await page.keyboard.type('o');await page.keyboard.press('Enter');}
  if(scenario==='held-guess'){await page.evaluate(()=>window.holdAction='guess');await page.keyboard.type('o');await page.keyboard.press('Enter');}
  if(scenario==='held-leave'){await page.evaluate(()=>window.holdAction='leave');await page.keyboard.press('Escape');}
  if(scenario.startsWith('held-')||scenario==='stable-poll'||scenario==='removed-result'||scenario==='speculative-result'||scenario==='retired-result'||scenario==='owner-change')await page.waitForFunction(()=>Boolean(window.releaseReceipt));
  if(scenario==='retired-result'){await page.evaluate(()=>window.retire());await page.getByTestId('retired').waitFor();}
  else if(scenario==='owner-change'){await page.evaluate(()=>window.replaceOwner());await page.getByRole('button',{name:'Start PvP match',exact:true}).waitFor();}
  else if(scenario==='speculative-result'){await page.evaluate(()=>window.speculate());await page.waitForFunction(()=>window.probe.renderedEpochs.includes(99));metric('speculative render does not commit the new callback',await page.locator('[data-epoch]').getAttribute('data-epoch'),'0');}
  else for(let i=0;i<(scenario==='entry-burst'?32:1);i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(epoch=>document.querySelector('[data-epoch]')?.getAttribute('data-epoch')===String(epoch),i+1);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
  if(!['retired-result','owner-change'].includes(scenario)){
   const counts=await page.evaluate(()=>({polls:window.probe.requests.filter(x=>x.action==='poll').length-window.before.polls,adds:window.probe.adds-window.before.adds,removes:window.probe.removes-window.before.removes}));
   metric('parent updates do not add observations',counts.polls,(scenario==='held-poll'||scenario==='stable-poll')?1:0);
   metric('parent updates retain the active subscription',counts.adds,0);metric('parent updates do not retire the subscription',counts.removes,0);
   metric('native editor is retained',await page.evaluate(()=>window.editor===document.querySelector('.race-native-answer-input')),true);
   if(!['held-result','removed-result','speculative-result','held-leave','held-guess'].includes(scenario)){metric('parent updates preserve the chosen focus',await page.evaluate(()=>document.activeElement===window.focused),true);metric('native input focus matches the player choice',await input.evaluate(el=>document.activeElement===el),scenario!=='entry-tab');metric('parent updates preserve the draft',await letters(),'pian');await page.keyboard.type('o');metric('typing continues without refocusing',await letters(),'piano');}
   metric('parent updates do not join another seat',await page.evaluate(()=>window.probe.joins.length-window.before.joins),0);
  }
  if(scenario.startsWith('held-')||scenario==='stable-poll'||scenario==='removed-result'||scenario==='speculative-result'||scenario==='retired-result'||scenario==='owner-change'){await page.evaluate(()=>window.releaseReceipt());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
  if(['held-result','removed-result','speculative-result'].includes(scenario)){await page.locator('.live-race-victory').waitFor();metric('pending terminal receipt uses the latest committed completion callback',await page.evaluate(()=>window.probe.completions),scenario==='removed-result'?[]:scenario==='speculative-result'?[0]:[1]);metric('terminal result dispatches one owned event',await page.evaluate(()=>window.probe.events),[{ownerId:'Alice'}]);metric('terminal result releases the subscription',await page.evaluate(()=>window.probe.active),0);}
  else if(scenario==='held-leave'){metric('pending retirement uses the latest committed close callback',await page.evaluate(()=>window.probe.closes),[1]);metric('explicit retirement sends one leave',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='leave').length),1);metric('confirmed retirement releases the subscription',await page.evaluate(()=>window.probe.active),0);}
  else if(scenario==='retired-result'||scenario==='owner-change'){metric('retired receipt does not invoke completion',await page.evaluate(()=>window.probe.completions),[]);metric('retired receipt does not dispatch an event',await page.evaluate(()=>window.probe.events),[]);metric('retired snapshot has no subscription',await page.evaluate(()=>window.probe.active),0);metric('real retirement leaves the owned seat once',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='leave').map(x=>x.owner)),['Alice']);if(scenario==='owner-change'){await page.getByRole('button',{name:'Start PvP match',exact:true}).click();await input.waitFor();metric('new account joins its own seat',await page.evaluate(()=>window.probe.joins.at(-1).owner),'Carol');metric('new account owns one fresh subscription',await page.evaluate(()=>window.probe.active),1);await input.focus();await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));metric('new account advances once',await page.evaluate(()=>window.probe.requests.filter(x=>x.owner==='Carol'&&x.action==='guess').length),1);}}
  else {if(scenario==='held-guess'){await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));await input.focus();await page.keyboard.type('piano');}if((scenario==='held-poll'||scenario==='stable-poll'))metric('held observation preserves the completed draft',await letters(),'piano');if(scenario==='entry-tab')await input.focus();await page.keyboard.press('Enter');await page.waitForFunction(count=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes(count+' / 10'),scenario==='held-guess'?2:1);metric('explicit native submission advances exactly once',await page.evaluate(()=>window.probe.requests.filter(x=>x.action==='guess').length),scenario==='held-guess'?2:1);metric('incomplete race does not invoke completion',await page.evaluate(()=>window.probe.completions),[]);}
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.LIVE_CALLBACK_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live race callback lifetime assertions');
