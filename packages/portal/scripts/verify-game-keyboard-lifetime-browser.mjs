import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.KEYBOARD_REACT_MODE??'development',baseline=process.env.KEYBOARD_BASELINE_DIR;
const output=path.resolve(process.env.KEYBOARD_REPORT_DIR??path.join(root,'../../artifacts/game-keyboard-lifetime-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/game-keyboard-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {LiveRaceGame} from ${JSON.stringify(path.join(root,'src/play/race/LiveRaceGame.tsx'))};
import {RACE_RULES} from '@qwordly/core/race';
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={adds:0,removes:0,saves:[],guesses:0,completions:0,requests:[],errors:[],unhandled:[]};window.retiredKeys=[];window.activeKeys=new Set();window.retiredDeletes=[];
window.keyboardObserveAdd=callback=>{window.probe.adds++;window.activeKeys.add(callback);};window.keyboardObserveRemove=callback=>{window.probe.removes++;window.activeKeys.delete(callback);window.retiredKeys.push(callback);};
window.deleteObserveRemove=(input,callback)=>window.retiredDeletes.push({input,callback});
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();const services={...service,submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};
const hosted=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,onPlayerDataChange:update=>window.probe.saves.push(update)});
window.pause=value=>dispatchLocalBridge(HOST_TO_GAME_EVENT,{type:value?'host:pause':'host:resume',payload:{}});
let correct=0;const start=Date.now()-1000;
const raceView=()=>{const now=Date.now();const player={displayName:'Alice',avatarUrl:null,bot:false,correctCount:correct},opponent={displayName:'Bob',avatarUrl:null,bot:false,correctCount:0};return {ticketId:'a'.repeat(64),phase:'racing',serverNowMs:now,searchEndsAtMs:now+60000,startsAtMs:start,player,opponent,result:null,rewardCoins:0,
 run:{runId:'a'.repeat(64),role:'creator',status:'active',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:correct,wallElapsedMs:now-start,totalPenaltyMs:0,adjustedElapsedMs:now-start,events:[],serverNowMs:now,startsAtMs:start,
 currentRiddle:{riddleId:'q'+correct,text:'What has keys but cannot open doors?',answerLength:5,position:correct,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Bob',avatarUrl:null,adjustedFinishMs:300000,events:[]}}};};
const transport={join:async()=>raceView(),update:async input=>{window.probe.requests.push(input);if(input.action==='guess'){window.probe.guesses++;if(input.guess==='piano')correct++;}return raceView();}};
const race=new URL(location.href).searchParams.has('race');
function App(){const [mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0);window.retire=()=>setMounted(false);window.refresh=()=>setEpoch(x=>x+1);return <div data-epoch={epoch}>{mounted?(race?<LiveRaceGame transport={transport} locale='en' categoryId='mixed' coins={100} ownerId='Alice' onClose={()=>setMounted(false)}/>:<PlayHostApp session={hosted}/>):<p data-testid='retired'>Retired fixture</p>}</div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
window.key=(key,keyCode=0,options={})=>{const event=new KeyboardEvent('keydown',{key,keyCode,bubbles:true,cancelable:true,...options});document.body.dispatchEvent(event);return event.defaultPrevented;};
window.replayKeys=()=>window.retiredKeys.map(callback=>{const event=new KeyboardEvent('keydown',{key:'x',cancelable:true});callback(event);return event.defaultPrevented;});
window.replayDeletes=()=>window.retiredDeletes.map(({callback})=>{const event=new InputEvent('beforeinput',{inputType:'deleteContentBackward',cancelable:true});callback(event);return event.defaultPrevented;});
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try {
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'observe-native-input-ownership',enforce:'pre',async load(id){
  if(!['/useAnswerKeyboard.ts','/NativeAnswerInput.tsx','/useNativeAnswerBackspace.ts'].some(name=>id.endsWith(name)))return;
  let code=await readFile(baseline?path.join(baseline,path.basename(id).replace(/\.tsx?$/,'.before.txt')):id,'utf8');
  if(id.endsWith('/useAnswerKeyboard.ts'))code=code.replace('window.addEventListener("keydown", handleKeyDown);','window.keyboardObserveAdd(handleKeyDown);window.addEventListener("keydown", handleKeyDown);').replace('window.removeEventListener("keydown", handleKeyDown)','(window.keyboardObserveRemove(handleKeyDown),window.removeEventListener("keydown", handleKeyDown))');
  if(id.endsWith('/useNativeAnswerBackspace.ts'))code=code.replace('input.removeEventListener("beforeinput", beforeInput)','(window.deleteObserveRemove(input,beforeInput),input.removeEventListener("beforeinput", beforeInput))');return code;
 }}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.KEYBOARD_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const width of [390,1280])for(const target of ['solo','race'])for(const scenario of ['lifetime','guards','retirement','ime-letter','ime-backspace','ime-enter',...(target==='race'?['native-ime','native-delete','composition']:[])]) {
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,target,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+(target==='race'?'?race=1':''));await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
  await page.waitForFunction(()=>window.activeKeys.size===1);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.waitForFunction(()=>window.draft()==='PIAN');
  metric('ordinary typing creates PIAN',await page.evaluate(()=>window.draft()),'PIAN');
  if(scenario==='lifetime') {
   const adds=await page.evaluate(()=>window.probe.adds);
   for(let i=0;i<10;i++){await page.keyboard.press('Backspace');await page.waitForFunction(()=>window.draft()==='PIA');await page.keyboard.type('n');await page.waitForFunction(()=>window.draft()==='PIAN');}
   await page.evaluate(()=>window.refresh());await page.waitForTimeout(250);
   metric('answer edits and clock rendering do not replace subscription',await page.evaluate(()=>window.probe.adds),adds);
   await page.evaluate(()=>window.replayKeys());await page.waitForTimeout(30);metric('retired listeners cannot edit current answer',await page.evaluate(()=>window.draft()),'PIAN');
   if(await page.evaluate(()=>window.draft())!=='PIAN'){for(let i=0;i<5;i++)await page.keyboard.press('Backspace');await page.keyboard.type('pian');await page.waitForFunction(()=>window.draft()==='PIAN');}
   const initial=await page.evaluate(()=>window.probe.guesses);await page.keyboard.type('o');await page.waitForFunction(()=>window.draft()==='PIANO');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(initial=>window.probe.guesses===initial+1,initial);metric('latest callback submits exactly once',await page.evaluate(()=>window.probe.guesses),initial+1);
  } else if(scenario==='guards') {
   await page.evaluate(()=>{for(const options of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true}])window.key('x',0,options);const event=new KeyboardEvent('keydown',{key:'x',bubbles:true,cancelable:true});event.preventDefault();document.body.dispatchEvent(event);});await page.waitForTimeout(30);
   metric('modifier/consumed/composing keys preserve answer',await page.evaluate(()=>window.draft()),'PIAN');
   await page.evaluate(()=>{const input=document.createElement('input');input.id='native-editor';input.value='hello';document.body.append(input);input.focus();});await page.keyboard.press('Backspace');
   metric('text field keeps native editing',await page.locator('#native-editor').inputValue(),'hell');metric('text field editing leaves answer intact',await page.evaluate(()=>window.draft()),'PIAN');
   await page.getByRole('button',{name:'Q',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.draft()==='PIANQ');metric('focused keyboard button activates once',await page.evaluate(()=>window.probe.guesses),0);
  } else if(scenario==='retirement') {
   await page.evaluate(()=>window.retire());await page.getByTestId('retired').waitFor();metric('unmounted editor removes current subscription',await page.evaluate(()=>window.activeKeys.size),0);
   metric('retained physical callbacks no longer consume events',await page.evaluate(()=>window.replayKeys().every(x=>x===false)),true);metric('retirement sends no mutation',await page.evaluate(()=>window.probe.guesses),0);
  } else if(scenario==='composition') {
   for(let i=0;i<4;i++)await page.keyboard.press('Backspace');await page.waitForFunction(()=>window.draft()==='');await page.locator('.race-native-answer-input').focus();
   await page.evaluate(()=>{const input=document.querySelector('.race-native-answer-input');input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));input.value='にほん';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'にほん',isComposing:true,inputType:'insertCompositionText'}));});
   metric('in-progress native composition stays in editor',await page.evaluate(()=>window.draft()),'');
   await page.evaluate(()=>{const input=document.querySelector('.race-native-answer-input');input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'にほん'}));input.value='にほん';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'にほん',inputType:'insertText'}));});await page.waitForFunction(()=>window.draft()==='にほん');
   metric('committed IME text is consumed once',await page.evaluate(()=>window.draft()),'にほん');
   metric('software-keyboard Backspace owns one deletion',await page.evaluate(()=>{const input=document.querySelector('.race-native-answer-input');const event=new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteContentBackward'});input.dispatchEvent(event);return event.defaultPrevented;}),true);await page.waitForFunction(()=>window.draft()==='にほ');metric('software deletion preserves remaining graphemes',await page.evaluate(()=>window.draft()),'にほ');
  } else if(scenario==='native-delete') {
   await page.evaluate(()=>window.replayDeletes());await page.waitForTimeout(30);metric('retired native delete callbacks leave current draft intact',await page.evaluate(()=>window.draft()),'PIAN');
   if(await page.evaluate(()=>window.draft())!=='PIAN'){await page.evaluate(()=>document.activeElement?.blur());for(let i=0;i<5;i++)await page.keyboard.press('Backspace');await page.keyboard.type('pian');await page.waitForFunction(()=>window.draft()==='PIAN');}
   const input=page.locator('.race-native-answer-input');await input.focus();await page.keyboard.press('Backspace');metric('ordinary native Backspace deletes once',await page.evaluate(()=>window.draft()),'PIA');
   await page.evaluate(()=>window.retire());await page.getByTestId('retired').waitFor();
   metric('retirement removes answer subscriptions',await page.evaluate(()=>window.activeKeys.size),0);await page.evaluate(()=>{window.replayKeys();window.replayDeletes();});metric('retired native callbacks no longer consume events',await page.evaluate(()=>window.replayDeletes().every(x=>x===false)),true);metric('retained input callbacks create no mutation',await page.evaluate(()=>window.probe.guesses),0);
  } else if(scenario==='native-ime') {
   await page.keyboard.type('o');await page.waitForFunction(()=>window.draft()==='PIANO');await page.locator('.race-native-answer-input').focus();
   await page.evaluate(()=>{const input=document.querySelector('.race-native-answer-input');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',keyCode:229,bubbles:true,cancelable:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,bubbles:true,cancelable:true}));});
   metric('native IME boundary does not delete or submit',await page.evaluate(()=>window.probe.guesses),0);metric('native IME boundary preserves answer',await page.evaluate(()=>window.draft()),'PIANO');
  } else {
   if(scenario==='ime-enter'){await page.keyboard.type('o');await page.waitForFunction(()=>window.draft()==='PIANO');}
   const expected=scenario==='ime-enter'?'PIANO':'PIAN',key=scenario==='ime-letter'?'x':scenario==='ime-backspace'?'Backspace':'Enter';
   metric('IME 229 key remains native',await page.evaluate(key=>window.key(key,229),key),false);await page.waitForTimeout(50);
   metric('IME 229 preserves answer',await page.evaluate(()=>window.draft()),expected);metric('IME boundary sends no answer mutation',await page.evaluate(()=>window.probe.guesses),0);
  }
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);
  if(!baseline&&scenario==='lifetime')await page.screenshot({path:path.join(output,`${target}-${width}.png`)});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
