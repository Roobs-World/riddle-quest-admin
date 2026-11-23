import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {SOLO_COIN_COSTS}=await import(path.join(root,"src/progression/economy/rewardRules.ts"));
const continueCost=SOLO_COIN_COSTS.continue;
const mode=process.env.INTERACTIVE_RECOVERY_REACT_MODE??'development';
const baseline=process.env.INTERACTIVE_RECOVERY_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.INTERACTIVE_RECOVERY_REPORT_DIR??path.join(root,'builds/test-evidence/game-interactive-recovery-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/interactive-recovery-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,"src/app/components/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
import {FatalErrorBoundary} from ${JSON.stringify(path.join(root,"src/app/components/recovery/FatalErrorBoundary.tsx"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {configureBrowserErrorReporter} from ${JSON.stringify(path.join(root,"src/observability/browserErrorReporter.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={errors:[],unhandled:[],windowErrors:[],saves:[],guesses:0,completions:0,completionRequests:[],completionReceipts:[],guessReceipts:[],spends:[],skips:[],hints:[],loads:[],sceneRenders:0,customRenders:0};
window.addEventListener('riddle-quest:game-to-host',event=>{const m=event.detail;if(m?.type==='game:completeGame')window.probe.completionRequests.push({requestId:m.requestId,payload:m.payload});});
window.addEventListener('riddle-quest:host-to-game',event=>{const m=event.detail;if(m?.type==='host:operationResult'&&m.payload.operation==='completeGame'&&m.payload.ok===true)window.probe.completionReceipts.push({requestId:m.requestId});if(m?.type==='host:operationResult'&&m.payload.operation==='guess'&&m.payload.ok===true)window.probe.guessReceipts.push({requestId:m.requestId});});
window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
window.addEventListener('error',event=>window.probe.windowErrors.push(String(event.error??event.message)));
configureBrowserErrorReporter((error,context)=>window.probe.errors.push({...context,error:String(error)}));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:false,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
window.requestIdleCallback=()=>1;window.cancelIdleCallback=()=>{};
const source=createFakeHostServices();
const originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.blockGuessJournal&&key.includes('pendingPlay:v1:'))throw Error('injected journal write failure');return originalSetItem.call(this,key,value);};
const services={...source,skipRiddle:async input=>{window.probe.skips.push(input);return source.skipRiddle(input);},requestHint:async input=>{window.probe.hints.push(input);return source.requestHint(input);},loadRiddle:async input=>{window.probe.loads.push(input);return source.loadRiddle(input);},submitGuess:async input=>{window.probe.guesses++;if(window.holdGuess)await new Promise(resolve=>window.releaseGuess=resolve);return source.submitGuess(input);},completeGame:async input=>{
 window.probe.completions++;if(window.holdCompletion)await new Promise(resolve=>window.releaseCompletion=resolve);const result=await source.completeGame(input);window.probe.authorityCoins=(await source.loadProfile('jest-guest'))?.coins;return result;},spendCoins:async input=>{window.probe.spends.push(input);if(window.holdSpend)await new Promise(resolve=>window.releaseSpend=resolve);return source.spendCoins(input);}};
const params=new URL(location.href).searchParams;
function ProviderRace(){window.probe.customRenders++;throw Error('provider surface render failed');}
const session=createHostedPlaySession({hostServices:services,economyAvailable:true,raceAvailable:params.has('race'),raceLocalePolicy:'all',initialGameMode:params.has('daily')?'challenge':'classic',onPlayerDataChange:update=>window.probe.saves.push(update)});
createRoot(document.querySelector('#root')).render(<React.StrictMode><FatalErrorBoundary><PlayHostApp session={session} raceSurface={params.has('provider')?ProviderRace:undefined}/></FatalErrorBoundary></React.StrictMode>);
window.profile=()=>source.loadProfile('jest-guest');
window.loaded=true;
`);
let browser,server;const observations=[];
try{
 browser=process.env.INTERACTIVE_RECOVERY_SERVE_ONLY==='1'?undefined:await chromium.launch({headless:true});
 for(const variant of (process.env.INTERACTIVE_RECOVERY_SERVE_ONLY==='1'?['modal-download']:['modal-download','modal-render','race-download','race-render','provider-render'])){
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'interactive-recovery-fixture',enforce:'pre',async load(id){
   if(baseline&&id===path.join(root,"src/gameplay/components/GameFrameApp.tsx"))return readFile(path.join(baseline,'GameFrameApp.before.txt'),'utf8');
   if(variant==='modal-render'&&id===path.join(root,"src/app/modals/components/GameModalView.tsx"))return `export function GameModalView(){throw Error('modal surface render failed');}`;
   if(variant==='race-render'&&id===path.join(root,"src/races/components/recorded/RaceTo10Game.tsx"))return `export function RaceTo10Game(){throw Error('race surface render failed');}`;
  }}],build:{outDir:'dist',minify:false}});
  const assets=await readdir(path.join(scratch,'dist/assets'));
  const modalAsset=assets.find(file=>file.startsWith('GameModalView-')&&file.endsWith('.js'));
  const raceAsset=assets.find(file=>file.startsWith('RaceTo10Game-')&&file.endsWith('.js'));
  assert.ok(modalAsset&&raceAsset,'both optional surfaces remain separate lazy modules');
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname;
   if(process.env.INTERACTIVE_RECOVERY_SERVE_ONLY==='1'&&pathname.endsWith(modalAsset)){response.writeHead(503).end('injected modal asset failure');return;}
   const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname),body=await readFile(file);response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(body);}catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  if(process.env.INTERACTIVE_RECOVERY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode,modalAsset}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});break;}
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();let modalRequests=0,raceRequests=0;
   // Each document creates a new fake authority, so its client journal must also start fresh.
   await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear();});
   await page.route(`**/assets/${modalAsset}`,async route=>{modalRequests++;if(variant==='modal-download')await route.abort('failed');else await route.continue();});
   await page.route(`**/assets/${raceAsset}`,async route=>{raceRequests++;if(variant==='race-download')await route.abort('failed');else await route.continue();});
   const metric=async(name,actual,expected)=>{observations.push({variant,width,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
   const value=field=>page.evaluate(field=>window.probe[field],field);
   const solarReports=()=>page.evaluate(()=>window.probe.errors.filter(row=>row.operation==='render_interactive_surface').length);
   const start=async(gameMode='classic')=>{const query=variant.startsWith('race')?'?race=1&harness=race':variant==='provider-render'?'?race=1&provider=1&harness=race':gameMode==='challenge'?'?daily=1':'';await page.goto(url+query);await page.getByText(gameMode==='challenge'?'I speak without a mouth and hear without ears. What am I?':'What has keys but cannot open doors?',{exact:true}).waitFor();if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();await page.locator('.keyboard .key:not(:disabled)').first().waitFor();};
   const failure=async()=>{await page.waitForFunction(()=>window.probe.errors.some(row=>row.operation==='render_interactive_surface'||row.errorKind==='react_render'));};
   await start();await page.keyboard.type('pian');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIAN'));
   const token=await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.sessionToken);
   await page.getByRole('button',{name:variant.startsWith('modal')?'Hint':'Multiplayer',exact:true}).click();await failure();
   await metric('optional failure preserves the frame',await page.locator('.game-app').count(),1);
   await metric('optional failure leaves the same authoritative token',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.sessionToken),token);
   await metric('optional failure preserves the PIAN draft',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.currentLetters.join('').toUpperCase()),'PIAN');
   await metric('one local surface failure is reported',await solarReports(),1);
   await metric('local failure never reaches the fatal page boundary',await page.evaluate(()=>window.probe.errors.filter(row=>row.errorKind==='react_render').length),0);
   await metric('failure exposes one accessible recovery dialog',await page.getByRole('alertdialog').count(),1);
   await metric('failure does not issue a guess',await value('guesses'),0);
   await metric('failure does not spend coins',await value('spends'),[]);
   await metric('failure does not infer a completion',await value('completions'),0);
   const canRecover=await page.getByRole('alertdialog').count();
   if(canRecover){
    if(!baseline)await page.screenshot({path:path.join(output,`${variant}-recovery-${width}.png`)});
    await metric('underlying game is inert during recovery',await page.locator('.game-content').evaluate(element=>element.inert),true);
    await metric('focus starts inside the recovery panel',await page.getByRole('alertdialog').evaluate(element=>element.contains(document.activeElement)),true);
    await page.keyboard.press('Tab');await page.keyboard.press('Tab');await metric('forward Tab stays inside recovery',await page.getByRole('alertdialog').evaluate(element=>element.contains(document.activeElement)),true);
    await page.keyboard.press('Shift+Tab');await metric('reverse Tab stays inside recovery',await page.getByRole('alertdialog').evaluate(element=>element.contains(document.activeElement)),true);
    await metric('recovery buttons meet the 48px touch target',await page.getByRole('button',{name:'Close',exact:true}).evaluate(element=>element.getBoundingClientRect().height>=48),true);
    await context.setOffline(true);await page.locator('.offline-backdrop').waitFor();
    await page.keyboard.press('Escape');await metric('offline Escape cannot dismiss the underlying recovery',await page.locator('.surface-recovery').count(),1);
    await context.setOffline(false);await page.locator('.offline-backdrop').waitFor({state:'detached'});
    await metric('connectivity recovery returns to the same surface dialog',await page.getByRole('alertdialog').count(),1);
    await page.keyboard.press('Escape');await page.getByRole('alertdialog').waitFor({state:'detached'});
    await metric('Escape restores the puzzle interaction',await page.locator('.game-content').evaluate(element=>element.inert),false);
    await page.getByRole('button',{name:variant.startsWith('modal')?'Hint':'Multiplayer',exact:true}).click();await page.getByRole('alertdialog').waitFor();
    await metric('reopening does not repeat the surface diagnostic',await solarReports(),1);
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1);
    if(variant.startsWith('modal')){await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForFunction(()=>window.probe.loads.length===2);}
   }
   await metric('player submits one answer after recovering',await value('guesses'),1);
   await metric('player receives one authoritative completion',await value('completions'),1);
   if(variant.startsWith('modal'))await metric('terminal fallback can load the next riddle',await page.evaluate(()=>window.probe.loads.length),2);
   await metric('failed scene does not create an unhandled promise',await value('unhandled'),[]);
   if(variant==='provider-render')await metric('provider surface never loads unused shared multiplayer',raceRequests,0);
   if(!baseline)await page.screenshot({path:path.join(output,`${variant}-${width}.png`)});

   if(variant.startsWith('modal')){
    await start();await page.evaluate(async()=>{window.probe.beforeProfile=await window.profile();window.holdCompletion=true;});await page.keyboard.type('piano');await page.getByRole('button',{name:/^submit$/i}).click();await failure();
    await page.waitForFunction(()=>window.probe.guessReceipts.length===1&&typeof window.releaseCompletion==='function');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const hasNext=await page.getByRole('button',{name:'Next',exact:true}).count();
    await metric('winning fallback exposes Next',hasNext,1);
    if(hasNext){
     await metric('ordinary Classic Next stays available while completion settles',await page.getByRole('button',{name:'Next',exact:true}).isDisabled(),false);
     await metric('terminal failure cannot dismiss its only Next action',await page.getByRole('button',{name:'Close',exact:true}).isDisabled(),true);
     await page.keyboard.press('Escape');await metric('Escape retains the explicit terminal Next action',await page.getByRole('alertdialog').count(),1);
     await page.waitForFunction(()=>typeof window.releaseCompletion==='function');
     await metric('held Classic has no successful completion receipt',await page.evaluate(()=>window.probe.completionReceipts.length),0);
     await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForFunction(()=>window.probe.loads.length===2);await page.getByText('What has a face and hands but no arms?',{exact:true}).waitFor();
     await metric('provisional Classic requests exactly the adjacent issued question without old locators',await page.evaluate(()=>{const x=window.probe.loads[1];return[x.gameMode,x.classicIndex,x.riddleId??null,x.sessionToken??null];}),['classic',2,null,null]);
     await metric('provisional Next clears the recovery dialog before acknowledgement',await page.getByRole('alertdialog').count(),0);
     await page.keyboard.type('cl');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('')==='CL'));
     await page.evaluate(()=>window.releaseCompletion());await page.waitForFunction(()=>window.probe.completionReceipts.length===1);await page.waitForFunction(()=>window.probe.saves.some(row=>row.profile?.classicIndex===2));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await metric('Classic receives exactly one successful receipt for the completed round',await page.evaluate(()=>{const q=window.probe.completionRequests,r=window.probe.completionReceipts;return[q.length,r.length,q[0]?.payload.riddleId,q[0]?.payload.sessionToken,q[0]?.payload.gameMode,Boolean(q[0]?.requestId)&&q[0]?.requestId===r[0]?.requestId];}),[1,1,'classic-fake-1','00000000-0000-4000-8000-000000000001','classic',true]);
     await metric('Classic fallback has one answer one completion and no spend',await page.evaluate(()=>[window.probe.guesses,window.probe.completions,window.probe.spends]),[1,1,[]]);
     await metric('late completion preserves the latest durable successor draft and identity',await page.evaluate(()=>{const x=window.probe.saves.findLast(row=>Object.hasOwn(row,'activeGame'))?.activeGame;return[x?.riddleId,x?.sessionToken,x?.currentLetters,x?.activeSlotIndex];}),['classic-fake-2','00000000-0000-4000-8000-000000000002',['C','L','','',''],2]);
     await metric('late completion keeps the visible successor draft', (await page.locator('.guess-row').first().locator('.cell').allTextContents()).join('').toUpperCase(),'CL');
     await metric('late completion cannot reopen the old recovery',await page.getByRole('alertdialog').count(),0);
     await metric('Classic authority applies the original win exactly once',await page.evaluate(async()=>{const p=await window.profile();return[p.gamesPlayed-window.probe.beforeProfile.gamesPlayed,p.wins-window.probe.beforeProfile.wins,p.classicIndex];}),[1,1,2]);
    }
    await metric('winning fallback never duplicates rewards',await value('completions'),1);
    await metric('winning fallback advances once',await page.evaluate(()=>window.probe.loads.length),2);

    await start('challenge');await page.evaluate(async()=>{window.probe.beforeProfile=await window.profile();window.holdCompletion=true;});await page.keyboard.type('echo');await page.getByRole('button',{name:/^submit$/i}).click();await failure();
    await page.waitForFunction(()=>window.probe.guessReceipts.length===1&&typeof window.releaseCompletion==='function');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await metric('held Daily has no successful completion receipt',await page.evaluate(()=>window.probe.completionReceipts.length),0);
    const dailyNext=page.getByRole('button',{name:'Next',exact:true});await dailyNext.waitFor();
    await metric('Daily Next still waits for authoritative completion',await dailyNext.isDisabled(),true);
    await metric('Daily terminal recovery cannot dismiss the win',await page.getByRole('button',{name:'Close',exact:true}).isDisabled(),true);
    await page.keyboard.press('Escape');await metric('Daily Escape cannot bypass acknowledgement',await page.getByRole('alertdialog').count(),1);
    await dailyNext.evaluate(button=>button.click());await page.waitForTimeout(50);
    await metric('disabled Daily Next issues no successor request',await page.evaluate(()=>window.probe.loads.length),1);
    await metric('held Daily completion grants nothing early',await page.evaluate(async()=>{const p=await window.profile();const b=window.probe.beforeProfile;return[p.gamesPlayed-b.gamesPlayed,p.wins-b.wins,(p.dailyPuzzlesCompleted??0)-(b.dailyPuzzlesCompleted??0)];}),[0,0,0]);
    await page.evaluate(()=>window.releaseCompletion());await page.waitForFunction(()=>window.probe.completionReceipts.length===1);await page.waitForFunction(()=>!document.querySelector('.surface-recovery .play-primary')?.disabled);
    await metric('Daily receives exactly one successful receipt for its completed round',await page.evaluate(()=>{const q=window.probe.completionRequests,r=window.probe.completionReceipts;return[q.length,r.length,q[0]?.payload.riddleId,q[0]?.payload.sessionToken,q[0]?.payload.gameMode,Boolean(q[0]?.requestId)&&q[0]?.requestId===r[0]?.requestId];}),[1,1,'daily-fake-1','00000000-0000-4000-8000-000000000003','challenge',true]);
    await dailyNext.click();await page.waitForFunction(()=>window.probe.loads.length===2);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
    await metric('acknowledged Daily resumes Classic without the completed Daily locators',await page.evaluate(()=>{const x=window.probe.loads[1];return[x.gameMode,x.classicIndex,x.riddleId??null,x.sessionToken??null];}),['classic',1,null,null]);
    await metric('Daily authority completes exactly once without advancing Classic',await page.evaluate(async()=>{const p=await window.profile();const b=window.probe.beforeProfile;return[p.gamesPlayed-b.gamesPlayed,p.wins-b.wins,(p.dailyPuzzlesCompleted??0)-(b.dailyPuzzlesCompleted??0),p.classicIndex];}),[1,1,1,1]);
    await metric('Daily fallback has one answer one completion and no spend',await page.evaluate(()=>[window.probe.guesses,window.probe.completions,window.probe.spends]),[1,1,[]]);
    await metric('acknowledged Daily clears its recovery dialog',await page.getByRole('alertdialog').count(),0);

    for(const paidSurface of (variant==='modal-download'?['recovery','healthy']:['recovery'])) {
    if(paidSurface==='healthy')await page.unroute(`**/assets/${modalAsset}`);
    for(const pendingMode of ['direct','journaled']) {
    await start();
    for(let attempt=1;attempt<=5;attempt++){if(attempt===5)await page.evaluate(pendingMode=>{window.blockGuessJournal=pendingMode==='direct';window.holdGuess=true;},pendingMode);await page.keyboard.type(['aaaaa','bbbbb','ccccc','ddddd','eeeee'][attempt-1]);await page.getByRole('button',{name:/^submit$/i}).click();try{await page.waitForFunction(({attempt,baseline})=>window.probe.guesses===attempt||(baseline&&window.probe.errors.some(row=>row.errorKind==='react_render')),{attempt,baseline:!!baseline},{timeout:5000});}catch(error){await writeFile(path.join(output,'continue-debug.json'),JSON.stringify(await page.evaluate(attempt=>({attempt,probe:window.probe,text:document.body.innerText}),attempt),null,2));throw error;}if(attempt<5)await page.waitForFunction(attempt=>window.probe.saves.some(row=>row.activeGame?.engineSnapshot.attemptsUsed===attempt),attempt);}
    if(paidSurface==='recovery')await failure();
    const continueButton=page.getByRole('button',{name:`Use ${continueCost} Coins to Try Again`,exact:true});
    if(!baseline||paidSurface==='healthy')await continueButton.waitFor({state:'visible'});
    await metric(paidSurface+' retains the existing priced Continue control',await continueButton.count(),1);
    await metric('a failed continue surface does not auto-complete a loss',await value('completions'),0);
    await metric('a failed continue surface does not auto-spend',await value('spends'),[]);
    if(await continueButton.count()){
     await metric(pendingMode+' fifth guess keeps Continue readiness consistent',await continueButton.isDisabled(),pendingMode==='direct');
     await metric(pendingMode+' fifth guess keeps Skip readiness consistent',await page.locator('.loss-skip-action').isDisabled(),pendingMode==='direct');
     await metric(pendingMode+' fifth guess has the expected durable record',await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('pendingPlay:v1:'))),pendingMode==='journaled');
     await page.evaluate(()=>window.holdSpend=true);
     if(pendingMode==='direct'){
      await continueButton.evaluate(element=>element.click());await metric('disabled Continue cannot send an early spend',await value('spends'),[]);
      await page.waitForFunction(()=>typeof window.releaseGuess==='function');await page.evaluate(()=>{window.blockGuessJournal=false;window.holdGuess=false;window.releaseGuess();});
      await page.waitForFunction(()=>!document.querySelector('.continue-actions .loss-continue-action')?.disabled);
      await continueButton.evaluate(element=>{element.click();element.click();});
     }else{
      await continueButton.evaluate(element=>{element.click();element.click();});
      await page.waitForFunction(()=>Object.keys(localStorage).some(key=>key.includes('pendingPlay:v1:')&&JSON.parse(localStorage.getItem(key)).coinAction));
      await metric('durably queued Continue cannot overtake the held fifth guess',await value('spends'),[]);
      await page.waitForFunction(()=>typeof window.releaseGuess==='function');await page.evaluate(()=>{window.holdGuess=false;window.releaseGuess();});
     }
     try{await page.waitForFunction(()=>window.probe.spends.length===1,{},{timeout:5000});}catch(error){await writeFile(path.join(output,'spend-debug.json'),JSON.stringify(await page.evaluate(()=>({probe:window.probe,text:document.body.innerText,journal:Object.fromEntries(Object.entries(localStorage)),online:navigator.onLine})),null,2));throw error;}
     await metric('rapid Continue activation sends one authoritative spend',await page.evaluate(()=>window.probe.spends.length),1);
     await page.waitForFunction(()=>typeof window.releaseSpend==='function');await page.evaluate(()=>window.releaseSpend());await page.waitForFunction(balance=>window.probe.saves.some(row=>row.profile?.coins===balance),300-continueCost);
     await metric(pendingMode+' paid continuation clears the prompt',await page.locator('.continue-actions').count(),0);
     await page.keyboard.type('piano');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.guesses===6&&window.probe.completions===1);
    }
    await metric('continued puzzle accepts the sixth answer',await value('guesses'),6);
    await metric('continued puzzle delivers one authoritative result',await value('completions'),1);
    }
    }
    if(!baseline){
     if(variant==='modal-download')await page.route(`**/assets/${modalAsset}`,route=>route.abort('failed'));
     await start();
     for(let attempt=1;attempt<=5;attempt++){
      await page.keyboard.type(['aaaaa','bbbbb','ccccc','ddddd','eeeee'][attempt-1]);await page.getByRole('button',{name:/^submit$/i}).click();
      await page.waitForFunction(attempt=>window.probe.saves.some(row=>row.activeGame?.engineSnapshot.attemptsUsed===attempt),attempt);
     }
     await failure();await page.evaluate(()=>window.holdCompletion=true);await page.getByRole('button',{name:'Close',exact:true}).click();await page.waitForFunction(()=>window.probe.completions===1);await page.locator('.surface-recovery').waitFor({state:'detached'});
     await writeFile(path.join(output,'decline-debug.json'),JSON.stringify(await page.evaluate(()=>({probe:window.probe,text:document.body.innerText,journal:Object.fromEntries(Object.entries(localStorage))})),null,2));
     await metric('declined continuation leaves the game controls accessible',await page.locator('.game-content').evaluate(element=>element.inert),false);
     await metric('declined continuation does not offer an invalid Next',await page.getByRole('button',{name:'Next',exact:true}).count(),0);
     await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('alertdialog').waitFor();
     await metric('lost Classic can still confirm Skip after modal failure',await page.locator('.surface-recovery .modal-actions .play-primary').count(),1);
     await page.locator('.surface-recovery .modal-actions .play-primary').click();await page.getByText('What has a face and hands but no arms?',{exact:true}).waitFor();
     await metric('recovered Classic Skip sends one authority request',await page.evaluate(()=>window.probe.skips.length),1);
     await page.waitForFunction(balance=>window.probe.saves.some(row=>row.profile?.coins===balance),300-SOLO_COIN_COSTS.skip);
     await metric('recovered Classic Skip never rewards the lost puzzle',await value('completions'),1);
     await metric('recovered Classic Skip makes the successor playable',await page.locator('.game-content').evaluate(element=>element.inert),false);
     await page.waitForFunction(()=>typeof window.releaseCompletion==='function');await page.evaluate(()=>window.releaseCompletion());await page.waitForFunction(()=>window.probe.authorityCoins!==undefined);

     await start();await page.getByRole('button',{name:'Hint',exact:true}).click();await failure();
     await page.locator('.surface-recovery .modal-actions .play-primary').click();await page.waitForFunction(()=>window.probe.hints.length===1);
     await page.waitForFunction(balance=>window.probe.saves.some(row=>row.profile?.coins===balance),300-SOLO_COIN_COSTS.hint);
     await metric('recovered Hint uses one authoritative request',await page.evaluate(()=>window.probe.hints.length),1);
     await metric('recovered Hint closes its confirmation',await page.locator('.surface-recovery').count(),0);
     await page.keyboard.type('iano');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1);
     await metric('paid Hint leaves the answer playable',await value('guesses'),1);
    }
   }
   await context.close();
  }
  await new Promise(resolve=>server.close(resolve));server=null;
 }
 await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected))},null,2));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
