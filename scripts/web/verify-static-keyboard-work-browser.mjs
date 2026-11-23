import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.STATIC_KEYBOARD_REACT_MODE??'development',baseline=process.env.STATIC_KEYBOARD_BASELINE_DIR;
const output=path.resolve(process.env.STATIC_KEYBOARD_REPORT_DIR??path.join(root,'builds/test-evidence/static-keyboard-work-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/static-keyboard-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {YouTubePlayableApp} from ${JSON.stringify(path.join(root,"src/gameplay/components/local/LocalGameApp.tsx"))};import ${JSON.stringify(path.join(root,"src/gameplay/styles/local-game.css"))};
import {PlayHostApp} from ${JSON.stringify(path.join(root,"src/app/components/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
import {LiveRaceGame} from ${JSON.stringify(path.join(root,"src/races/components/live/LiveRaceGame.tsx"))};
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};import {computeFeedback} from ${JSON.stringify(path.join(root, "src/gameplay/rules/computeFeedback.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,"src/platform/bridge/browser/localBridge.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={keyboardSegments:0,keyboardSplits:0,saves:[],guesses:0,completions:0,requests:[],errors:[],unhandled:[]};const fixedRows=new Set(['QWERTYUIOP','ASDFGHJKL','ZXCVBNM','QWERTYUIOPASDFGHJKLZXCVBNM']);
const segment=Intl.Segmenter.prototype.segment;Intl.Segmenter.prototype.segment=function(value,...args){if(fixedRows.has(String(value)))window.probe.keyboardSegments++;return segment.call(this,value,...args);};
const split=String.prototype.split;String.prototype.split=function(separator,...args){if(fixedRows.has(String(this)))window.probe.keyboardSplits++;return split.call(this,separator,...args);};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();const services={...service,submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};
const hosted=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,onPlayerDataChange:update=>window.probe.saves.push(update)});
window.pause=value=>dispatchLocalBridge(HOST_TO_GAME_EVENT,{type:value?'host:pause':'host:resume',payload:{}});
let correct=0,confirmed=[];const start=Date.now()-1000;
const raceView=()=>{const now=Date.now();const player={displayName:'Alice',avatarUrl:null,bot:false,correctCount:correct},opponent={displayName:'Bob',avatarUrl:null,bot:false,correctCount:0};return {ticketId:'a'.repeat(64),phase:'racing',serverNowMs:now,searchEndsAtMs:now+60000,startsAtMs:start,player,opponent,result:null,rewardCoins:0,
 run:{runId:'a'.repeat(64),role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:correct,wallElapsedMs:now-start,totalPenaltyMs:0,adjustedElapsedMs:now-start,events:[],serverNowMs:now,startsAtMs:start,
 currentRiddle:{riddleId:'q'+correct,text:'What has keys but cannot open doors?',answerLength:5,position:correct,guessesUsed:confirmed.length,guessesRemaining:5-confirmed.length,hintAvailable:true,revealedLetters:[],confirmedGuesses:confirmed},opponent:{displayName:'Bob',avatarUrl:null,adjustedFinishMs:300000,events:[]}}};};
const transport={join:async()=>raceView(),update:async input=>{window.probe.requests.push(input);if(input.action==='guess'){window.probe.guesses++;if(input.guess.toLowerCase()==='piano'){correct++;confirmed=[];}else confirmed=[...confirmed,{guess:[...input.guess.toLowerCase()],feedback:computeFeedback(input.guess,'piano','en')}];}return raceView();}};
const target=new URL(location.href).searchParams.get('target')??'solo';
const sdk={inPlayablesEnvironment:true,firstFrameReady(){},gameReady(){},async loadData(){return '';},async saveData(data){window.probe.saves.push(data);},async getLanguage(){return 'en';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(fn){window.pausePlayable=fn;return ()=>{};},onResume(fn){window.resumePlayable=fn;return ()=>{};},logError(){},logWarning(){}};
function App(){const [mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0);window.retire=()=>setMounted(false);window.refresh=()=>setEpoch(x=>x+1);return <div data-epoch={epoch}>{mounted?(target==='playable'?<YouTubePlayableApp sdk={sdk}/>:target==='race'?<LiveRaceGame transport={transport} locale='en' categoryId='mixed' coins={100} ownerId='Alice' onClose={()=>setMounted(false)}/>:<PlayHostApp session={hosted}/>):<p data-testid='retired'>Retired fixture</p>}</div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',resolve:{alias:{'#youtube-content':path.join(root,'firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json')}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'static-keyboard-baseline',enforce:'pre',async load(id){if(!baseline)return;if(id.endsWith('/GameFrameControls.tsx'))return readFile(path.join(baseline,'controls.before.txt'),'utf8');if(id.endsWith('/LocalGameApp.tsx'))return readFile(path.join(baseline,'playable.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.STATIC_KEYBOARD_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});const quick=process.env.STATIC_KEYBOARD_QUICK==='1';
 for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const target of process.env.STATIC_KEYBOARD_TARGETS?.split(',')??(quick?['race']:['solo','race','playable']))for(const scenario of process.env.STATIC_KEYBOARD_SCENARIOS?.split(',')??(quick?['typing']:['typing','parent','shortcut',...(target==='playable'?[]:['feedback'])])) {
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected,measurement)=>{observations.push({width,height,target,scenario,name,actual,expected,...(measurement?{measurement}: {})});if(!(process.env.STATIC_KEYBOARD_MEASURE_ONLY==='1'&&name==='fixed keyboard preparation adds no repeated work'))assert.deepEqual(actual,expected,name);};
  await page.goto(url+'/?target='+target);
  if(target==='playable'){await page.getByRole('button',{name:/Classic/}).click();await page.locator('.yt-answer-native').waitFor();await page.waitForFunction(()=>window.probe.saves.length===1&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');}
  else {await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();}
  const answer=target==='playable'?'rome':'piano',prefix=answer.slice(0,-1),suffix=answer.slice(-1),keyboard=page.locator(target==='playable'?'.yt-keyboard':'.keyboard');
  const letters=()=>page.locator(target==='playable'?'.yt-guess-row.current .yt-tile':'.guess-row:has([aria-current="true"]) button').allTextContents().then(values=>values.join('').toLowerCase());
  const focus=async()=>{if(target==='playable'||target==='race')await page.locator(target==='playable'?'.yt-answer-native':'.race-native-answer-input').focus();else await page.evaluate(()=>document.activeElement?.blur());};
  if(target==='solo')await waitForAnswerInputReady(page);
  await focus();await page.keyboard.type(prefix);await page.waitForFunction(({target,prefix})=>[...document.querySelectorAll(target==='playable'?'.yt-guess-row.current .yt-tile':'.guess-row:has([aria-current="true"]) button')].map(x=>x.textContent).join('').toLowerCase()===prefix,{target,prefix});
  metric('physical input starts the correct draft',await letters(),prefix);
  metric('fixed key order is unchanged',await keyboard.locator('button').evaluateAll(buttons=>buttons.map(b=>b.textContent.trim()).filter(text=>/^[A-Z]$/.test(text)).join('')),'QWERTYUIOPASDFGHJKLZXCVBNM');
  let initialGuesses=0;if(scenario==='feedback'){await focus();for(let i=0;i<prefix.length;i++)await page.keyboard.press('Backspace');await page.keyboard.type('zzzzz');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.keyboard button')].some(b=>b.textContent.trim()==='Z'&&b.classList.contains('red')));metric('confirmed feedback updates the fixed Z key',await keyboard.locator('button').filter({hasText:/^Z$/}).getAttribute('class'),'key red');initialGuesses=1;await focus();await page.keyboard.type(prefix);}
  await page.evaluate(()=>{window.probe.keyboardSegments=window.probe.keyboardSplits=0;window.firstFixedKey=document.querySelector('.keyboard button,.yt-keyboard button');});
  if(scenario==='typing'){for(let i=0;i<(quick?1:16);i++){await page.keyboard.press('Backspace');await page.keyboard.type(prefix.slice(-1));}}
  else if(scenario==='parent'||scenario==='feedback'){for(let i=0;i<(quick?1:32);i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(index=>document.querySelector('[data-epoch]')?.getAttribute('data-epoch')===String(index+1),i);}}
  else {await page.keyboard.press('Backspace');await keyboard.locator('button').filter({hasText:new RegExp('^'+prefix.slice(-1).toUpperCase()+'$')}).click();}
  metric('edited draft is preserved',await letters(),prefix);const work=await page.evaluate(()=>({segments:window.probe.keyboardSegments,splits:window.probe.keyboardSplits}));
  metric('fixed keyboard preparation adds no repeated work',work,{segments:0,splits:0},{transitions:scenario==='typing'?(quick?2:32):(scenario==='parent'||scenario==='feedback')?(quick?1:32):2});
  metric('fixed keyboard DOM identity survives updates',await page.evaluate(()=>window.firstFixedKey===document.querySelector('.keyboard button,.yt-keyboard button')),true);
  metric('editing does not submit',await page.evaluate(()=>window.probe.guesses),initialGuesses);if(scenario==='feedback')metric('cached letters retain current confirmed feedback',await keyboard.locator('button').filter({hasText:/^Z$/}).getAttribute('class'),'key red');
  await focus();await page.keyboard.type(suffix);metric('fresh suffix completes the answer',await letters(),answer);await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(({target,expected})=>target==='playable'?document.querySelector('.yt-result')!==null:window.probe.guesses===expected,{target,expected:initialGuesses+1});
  metric('explicit submission completes once',await page.evaluate(({target,initialGuesses})=>target==='playable'?JSON.parse(window.probe.saves.at(-1)).progression.totalWins:window.probe.guesses-initialGuesses,{target,initialGuesses}),1);if(target==='solo'){await page.waitForFunction(()=>window.probe.completions===1);metric('hosted answer completes once',await page.evaluate(()=>window.probe.completions),1);}if(target==='race')await page.waitForFunction(()=>document.querySelector('.race-progress > div:first-child strong')?.textContent.includes('1 / 10'));
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[target,width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
