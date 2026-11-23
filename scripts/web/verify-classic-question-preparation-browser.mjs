import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.CLASSIC_PREPARATION_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const baseline=process.env.CLASSIC_PREPARATION_BASELINE_DIR;
const sessionBaseline=process.env.CLASSIC_PREPARATION_SESSION_BASELINE_DIR;
const guidanceBaseline=process.env.CLASSIC_PREPARATION_GUIDANCE_BASELINE_DIR;
const output=path.resolve(process.env.CLASSIC_PREPARATION_REPORT_DIR??path.join(root,'builds/test-evidence/classic-question-preparation-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/classic-preparation-'));
let server,browser;const observations=[];
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,"src/app/components/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
import {createNotificationOperationGate} from ${JSON.stringify(path.join(root,'platforms/web/jest/src/notifications/operationGate.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
const scenario=new URL(location.href).searchParams.get('scenario')??'ready';
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
for(const uid of ['jest-guest']){sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');for(const id of Object.keys(TOOLTIP_KEYS))if(scenario!=='guidance'||id!=='leaderboardFifthCorrectAnswer')localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,uid),'seen');}
window.probe={outbound:[],inbound:[],reads:[],locks:[],guesses:[],spends:[],completions:[],saves:[],errors:[],unhandled:[],epochs:0};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
const locks=navigator.locks,request=locks.request.bind(locks);locks.request=(name,options,callback)=>{window.probe.locks.push({name,mode:options.mode,time:performance.now()});return request(name,options,callback);};
const gate=createNotificationOperationGate();window.closeGate=()=>gate.close();
const source=createFakeHostServices(),first=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1}),next=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2}),before=await source.loadProfile('jest-guest');
window.probe.before=before;window.profile=()=>source.loadProfile('jest-guest');let optionalReads=0;
const services={...source,loadRiddle:async input=>{
 window.probe.reads.push(input);if(input.classicIndex===2){optionalReads++;
 if(optionalReads===1&&['pending','retire-pending'].includes(scenario))await new Promise(resolve=>window.releasePreparation=resolve);
 if(optionalReads===1&&scenario==='failed')throw new Error('Optional fixture read failed');
 if(optionalReads===1&&scenario==='wrong')return {...next,index:3};
 return next;}return first;},submitGuess:input=>{window.probe.guesses.push(input);return new Promise(()=>{});},
 completeGame:input=>{window.probe.completions.push(input);return source.completeGame(input);},spendCoins:input=>{window.probe.spends.push(input);return source.spendCoins(input);}};
const sessionInput={hostServices:services,accountDeletionServiceGate:gate,economyAvailable:false,raceAvailable:false,initialPlayerData:{schemaVersion:1,updatedAt:1,profile:before,activeGame:null},onPlayerDataChange:update=>window.probe.saves.push(update)};
let gameRoot=createRoot(document.querySelector('#root'));window.retire=()=>gameRoot.unmount();
function App(){const [epoch,setEpoch]=React.useState(0);window.refresh=()=>setEpoch(x=>x+1);const session=createHostedPlaySession({...sessionInput,...(scenario==='stable'?{platformPurchase:async productId=>({success:true,productId})}:{})});return <div data-epoch={epoch}><PlayHostApp session={session}/></div>;}
gameRoot.render(<React.StrictMode><App/></React.StrictMode>);
window.expire=()=>{const now=Date.now.bind(Date);Date.now=()=>now()+15_001;};
`);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'classic-preparation-original',enforce:'pre',async load(id){if(sessionBaseline&&id.endsWith('/HostedPlaySession.ts'))return readFile(path.join(sessionBaseline,'session-pre-stable.txt'),'utf8');if(guidanceBaseline&&id.endsWith('/GuidanceOverlay.tsx'))return readFile(path.join(guidanceBaseline,'guidance.before.txt'),'utf8');if(!baseline)return;const name=id.endsWith('/useHostRiddleLifecycle.ts')?'lifecycle.before.txt':id.endsWith('/GameFrameApp.tsx')?'frame.before.txt':null;if(name)return readFile(path.join(baseline,name),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.webm':'audio/webm','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 if(process.env.CLASSIC_PREPARATION_SERVE_ONLY==='1'){console.log(JSON.stringify({url:origin,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.CLASSIC_PREPARATION_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.CLASSIC_PREPARATION_SCENARIOS?.split(',')??['ready','guidance','stable','pending','failed','wrong','expired','closed','retire','retire-pending']) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const external=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();external.push(url.origin);return route.abort();});
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(origin+'/?scenario='+scenario);await page.getByRole('heading',{name:'What has keys but cannot open doors?',exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  metric('no successor read before a Classic win',await page.evaluate(()=>window.probe.reads.filter(x=>x.classicIndex===2).length),0);
  await waitForAnswerInputReady(page);
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('piano');await page.keyboard.press('Enter');await page.locator('.modal-victory').waitFor();
  await page.waitForTimeout(100);
  metric('one read-only preparation during victory',await page.evaluate(()=>window.probe.reads.filter(x=>x.classicIndex===2).length),1);
  metric('strict schema preserves the bound prepare flag',await page.evaluate(()=>window.probe.outbound.filter(x=>x.payload?.prepareNext).map(x=>({gameMode:x.payload.gameMode,index:x.payload.classicIndex,riddleId:x.payload.riddleId,sessionToken:x.payload.sessionToken}))),[{gameMode:'classic',index:2,riddleId:'classic-fake-1',sessionToken:'00000000-0000-4000-8000-000000000001'}]);
  metric('preparation origin is stripped before the provider read',await page.evaluate(()=>window.probe.reads.filter(x=>x.classicIndex===2).every(x=>!x.prepareNext&&!x.sessionToken&&!x.riddleId)),true);
  metric('prepared successor is not published early',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded'&&x.payload.riddle.index===2).length),0);
  metric('optional preparation changes no authority progression or balance',await page.evaluate(async()=>JSON.stringify(await window.profile())===JSON.stringify(window.probe.before)),true);
  metric('held native submission is delivered once',await page.evaluate(()=>window.probe.guesses.length),1);
  metric('no speculative paid action or completion grant',await page.evaluate(()=>[window.probe.spends.length,window.probe.completions.length]),[0,0]);
  metric('optional failures do not show a host alert',await page.locator('.play-alert').count(),0);
  if(scenario==='stable'){for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-epoch]')?.dataset.epoch===String(i+1),i);}metric('parent renders preserve a single preparation',await page.evaluate(()=>window.probe.outbound.filter(x=>x.payload?.prepareNext).length),1);}
  if(scenario.startsWith('retire')){await page.evaluate(()=>window.retire());const before=await page.evaluate(()=>window.probe.inbound.length);await page.evaluate(()=>window.releasePreparation?.());await page.waitForTimeout(50);metric('retired game removes visible content',await page.locator('.play-game-shell').count(),0);metric('late preparation cannot post to a retired game',await page.evaluate(()=>window.probe.inbound.length),before);metric('no browser error after retirement',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise after retirement',await page.evaluate(()=>window.probe.unhandled),[]);metric('no provider traffic after retirement',external,[]);await context.close();continue;}
  for(let step=0;step<10&&await page.getByRole('button',{name:/next level/i}).count()===0;step++){metric('unconfirmed victory cannot grant a reward chest',await page.locator('.modal-victory .reward-chest').count(),0);await page.locator('.modal-victory .reward-continue').click();await page.waitForTimeout(35);}
  await page.getByRole('button',{name:/next level/i}).waitFor();
  if(scenario==='expired')await page.evaluate(()=>window.expire());if(scenario==='closed')await page.evaluate(()=>window.closeGate());
  const beforeNext=await page.evaluate(()=>({reads:window.probe.reads.length,locks:window.probe.locks.length}));
  await page.getByRole('button',{name:/next level/i}).click();
  if(scenario==='closed'){await page.locator('.play-alert').waitFor();metric('closed gate cannot publish previously prepared content',await page.locator('.riddle-card h1').textContent(),'What has keys but cannot open doors?');metric('closed gate prevents provider work',await page.evaluate(()=>window.probe.reads.length),beforeNext.reads);}
  else {await page.locator('.riddle-card h1').filter({hasText:'What has a face and hands but no arms?'}).waitFor();const ready=['ready','guidance','stable'].includes(scenario);metric('Next reads through authority only when preparation is unavailable',(await page.evaluate(()=>window.probe.reads.length))-beforeNext.reads,ready?0:1);metric('ready Next acquires no additional native shared lock',(await page.evaluate(()=>window.probe.locks.length))-beforeNext.locks,ready?0:1);metric('explicit Next publishes its successor once',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded'&&x.payload.riddle.index===2).length),1);if(scenario==='pending'){await page.evaluate(()=>window.releasePreparation?.());await page.waitForTimeout(50);metric('late prepared result cannot redeliver or reset the current board',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded'&&x.payload.riddle.index===2).length),1);}}
  if(scenario==='guidance'){await page.waitForTimeout(50);metric('ready Next preserves unseen winning milestone guidance',await page.evaluate(()=>document.querySelector('.tooltip-backdrop')?.getAttribute('data-tooltip-id')??null),'leaderboardFifthCorrectAnswer');if(await page.getByRole('button',{name:/got it/i}).count())await page.getByRole('button',{name:/got it/i}).click();metric('acknowledged guidance permits the next question',await page.locator('.riddle-card h1').textContent(),'What has a face and hands but no arms?');}
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);metric('no provider traffic',external,[]);await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.CLASSIC_PREPARATION_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.CLASSIC_PREPARATION_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Classic preparation and native lock ownership');
