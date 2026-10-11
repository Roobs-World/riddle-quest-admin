import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const fixtureRequire=createRequire('/home/craig-beswetherick/Documents/riddle-quest/packages/portal/package.json');
const {build}=await import(fixtureRequire.resolve('vite'));
const {chromium,firefox}=fixtureRequire('@playwright/test');
const root='/home/craig-beswetherick/Documents/riddle-quest/packages/portal',mode=process.env.HINT_CURSOR_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.HINT_CURSOR_REPORT_DIR??path.join(root,'../../artifacts/live-hint-cursor-recovery-2026-10-08/permanent',mode+'-'+(process.env.HINT_CURSOR_ENGINE??'chromium')));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-poll-scheduling-'));let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/play/race/LiveRaceGame.tsx'))};
import {RACE_RULES,LiveRaceViewSchema} from '@qwordly/core/race';
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};import ${JSON.stringify(path.join(root,'src/styles.race-gameplay.css'))};import ${JSON.stringify(path.join(root,'src/styles.race-lobby.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URL(location.href).searchParams.get('scenario')??'healthy';window.probe={requests:[],joins:[],ticks:[],tickDetails:[],timers:new Map(),triggered:false,errors:[],unhandled:[]};
const nativeClear=window.clearTimeout.bind(window);window.clearTimeout=id=>{window.probe.timers.delete(id);return nativeClear(id);};
window.pollTimeout=(owner,callback,delay)=>{const id=window.setTimeout(()=>{window.probe.timers.delete(id);window.probe.ticks.push(owner);window.probe.tickDetails.push({owner,at:performance.now(),delay});callback();},delay);window.probe.timers.set(id,{owner,delay});return id;};
window.pendingPolls=owner=>[...window.probe.timers.values()].filter(x=>x.owner===owner).length;
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
function view(seat){const now=Date.now();return LiveRaceViewSchema.parse({ticketId:seat.id,phase:seat.left?'cancelled':seat.terminal?'result':'racing',serverNowMs:now,searchEndsAtMs:seat.start+60000,startsAtMs:seat.start,player:{displayName:seat.owner,avatarUrl:null,bot:false,correctCount:seat.correct},opponent:{displayName:'Rival',avatarUrl:null,bot:false,correctCount:0},result:seat.terminal?'win':null,rewardCoins:seat.terminal?50:0,run:seat.left?null:{runId:seat.id,role:'creator',status:seat.terminal?'completed':'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:seat.correct,wallElapsedMs:now-seat.start,totalPenaltyMs:0,adjustedElapsedMs:now-seat.start,events:[],serverNowMs:now,startsAtMs:seat.start,currentRiddle:seat.terminal?null:{riddleId:'q'+seat.correct,text:'What has keys but cannot open doors?',answerLength:5,position:seat.correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:seat.revealed,confirmedGuesses:[]},opponent:{displayName:'Rival',avatarUrl:null,adjustedFinishMs:300000,events:[]}}});}
function adapter(owner){const seat={owner,id:(owner==='Alice'?'a':'b').repeat(64),start:Date.now()-1000,correct:0,left:false,terminal:false,failed:false,revealed:scenario==='new'?[]:[{index:0,letter:'P'}]};window.finish=()=>{seat.terminal=true;seat.correct=10;};return {blockOpponent:async()=>{throw new Error('unexpected block')},reportOpponent:async()=>{throw new Error('unexpected report')},observe:(ticket,changed,connected)=>{window.signal=changed;window.connection=connected;connected(true);if(scenario==='subscription-throw')throw new Error('Fixture subscription failed after connected');return()=>{};},join:async input=>{window.probe.joins.push({owner,at:performance.now(),...input});return view(seat);},update:async input=>{window.probe.requests.push({owner,at:performance.now(),...input});if(input.action==='poll'&&owner==='Alice'&&window.armed&&scenario!=='stable'){window.armed=false;window.probe.triggered=true;flushSync(()=>scenario==='replace'?window.replace():window.retire());}if(input.action==='leave')seat.left=true;if(input.action==='hint')seat.revealed=[{index:Number(new URL(location.href).searchParams.get('hintIndex')??0),letter:Number(new URL(location.href).searchParams.get('hintIndex')??0)===2?'A':'P'}];if(input.action==='skip'){seat.correct++;seat.revealed=[];}if(input.action==='guess'){if(scenario==='backoff'&&!seat.failed){seat.failed=true;throw new Error('Fixture command transport failed');}if(input.guess.toLowerCase()!=='piano')throw new Error('Unexpected fixture guess');seat.correct++;if(scenario==='held')return new Promise(resolve=>{window.releaseGuess=()=>resolve(view(seat));});}return view(seat);}};}
const bob=adapter('Bob'),alice=adapter('Alice');const adapters={Alice:alice,Bob:bob};
function App(){const [mounted,setMounted]=React.useState(true),[owner,setOwner]=React.useState('Alice');window.retire=()=>setMounted(false);window.replace=()=>setOwner('Bob');return <div data-owner={owner}>{mounted?<LiveRaceGame key={owner} transport={adapters[owner]} locale='en' categoryId='mixed' coins={100} ownerId={owner} onClose={()=>setMounted(false)}/>:<p data-retired>Race removed</p>}<button data-arm onClick={()=>{window.armed=true;}}>Arm transport retirement</button></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:process.env.HINT_CURSOR_BASELINE_FILE?[{name:'original-focus-hook',enforce:'pre',load(id){if(id.endsWith('/liveRaceDraft.ts'))return readFile(process.env.HINT_CURSOR_BASELINE_FILE,'utf8');}}]:[],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.LIVE_SCHEDULE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await (process.env.HINT_CURSOR_ENGINE==='firefox'?firefox:chromium).launch({headless:true,...(process.env.HINT_CURSOR_ENGINE==='firefox'?{...(process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH}:{})}:{})});
 for(const width of [390])for(const method of ['virtual'])for(const hintIndex of [0]){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url+'/?scenario=new&hintIndex='+hintIndex);await page.locator('.race-native-answer-input').waitFor();
 if(method==='physical')await page.locator('.race-native-answer-input').fill(hintIndex===2?'pia':'pi');
 else for(const letter of hintIndex===2?'PIA':'PI')await page.locator('.keyboard button').filter({hasText:new RegExp('^'+letter+'$')}).click();
 await page.waitForFunction(prefix=>document.querySelector('.guess-row')?.textContent.toLowerCase()===prefix,hintIndex===2?'pia':'pi');
 await page.locator('.guess-row').first().locator('.cell').nth(hintIndex).click();
 await page.locator('.race-actions button').first().click();
 await page.waitForFunction(index=>document.querySelectorAll('.guess-row .cell')[index]?.disabled,hintIndex);
 const slot=await page.locator('.guess-row').first().locator('.cell[aria-current="true"]').evaluate(el=>[...el.parentNode.children].indexOf(el));
 observations.push({width,method,hintIndex,name:'hint cursor skips populated cells',actual:slot,expected:hintIndex===2?3:2});
 await page.evaluate(()=>document.activeElement?.blur());
 if(method==='physical')await page.keyboard.type(hintIndex===2?'no':'ano');
 else for(const letter of hintIndex===2?'NO':'ANO')await page.locator('.keyboard button').filter({hasText:new RegExp('^'+letter+'$')}).click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal((await page.locator('.guess-row').first().textContent()).toLowerCase(),'piano');
 observations.push({width,method,hintIndex,name:'remaining input preserves the composed prefix',actual:(await page.locator('.guess-row').first().textContent()).toLowerCase(),expected:'piano'});
 await page.locator('.submit-action').click();await page.waitForFunction(()=>window.probe.requests.some(request=>request.action==='guess'));
 const guesses=await page.evaluate(()=>window.probe.requests.filter(request=>request.action==='guess').map(request=>request.guess.toLowerCase()));
 observations.push({width,method,hintIndex,name:'one complete word reaches the live transport',actual:guesses,expected:['piano']});assert.deepEqual(errors,[]);await context.close();
 }

 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.LIVE_SCHEDULE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>!x.diagnostic&&JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.filter(x=>!x.diagnostic).length,samples:observations.filter(x=>x.diagnostic).length,failures},null,2));if(process.env.LIVE_SCHEDULE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Live race confirmed hint keyboard feedback');
