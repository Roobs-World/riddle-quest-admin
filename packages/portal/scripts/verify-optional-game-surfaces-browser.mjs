import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reactMode=process.env.OPTIONAL_SURFACES_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const baseline=process.env.OPTIONAL_SURFACES_BASELINE_DIR;
const output=path.resolve(process.env.OPTIONAL_SURFACES_REPORT_DIR??path.join(root,'../../builds/test-evidence/game-optional-surfaces-2026-10-03',reactMode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/optional-surfaces-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {FatalErrorBoundary} from ${JSON.stringify(path.join(root,'src/FatalErrorBoundary.tsx'))};
import {useGameSurfaces} from ${JSON.stringify(path.join(root,'src/play/game/hooks/useGameSurfaces.ts'))};
import {applyPlayerPreferences,setPlayerReducedMotion} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {configureBrowserErrorReporter} from ${JSON.stringify(path.join(root,'src/observability/browserErrorReporter.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={errors:[],unhandled:[],saves:[],guesses:0,completions:0,sceneRenders:0,raceImports:0,hookRenders:0,playable:0};
window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
configureBrowserErrorReporter((error,context)=>{window.probe.errors.push({...context,error:String(error)});});
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:false,onboardingComplete:true});window.setMotion=setPlayerReducedMotion;
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const pendingIdle=new Map();let nextIdle=0;
window.requestIdleCallback=callback=>{const id=++nextIdle;pendingIdle.set(id,callback);return id;};
window.cancelIdleCallback=id=>pendingIdle.delete(id);
window.releaseScene=()=>{const callbacks=[...pendingIdle.values()];pendingIdle.clear();callbacks.forEach(callback=>callback({didTimeout:false,timeRemaining:()=>5}));};
window.pause=paused=>dispatchLocalBridge(HOST_TO_GAME_EVENT,{type:paused?'host:pause':'host:resume',payload:{}});
const source=createFakeHostServices();
const services={...source,submitGuess:async input=>{window.probe.guesses++;return source.submitGuess(input);},completeGame:async input=>{
 window.probe.completions++;const result=await source.completeGame(input);window.probe.authorityCoins=(await source.loadProfile('jest-guest'))?.coins;return result;}};
const params=new URL(location.href).searchParams;
function ProviderRace({onClose}){return <section data-testid='provider-race'><button onClick={onClose}>Return to puzzle</button></section>;}
const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:params.has('custom'),raceLocalePolicy:'all',onPlayerDataChange:update=>window.probe.saves.push(update)});
function HookProbe(){const [enabled,setEnabled]=React.useState(true);window.disableRace=()=>setEnabled(false);window.probe.hookRenders++;
 const {RaceTo10Game,GameModalView}=useGameSurfaces(enabled);return <output data-enabled={enabled?'yes':'no'} data-ready={typeof RaceTo10Game==='function'?'yes':'no'} data-modal-ready={typeof GameModalView==='function'?'yes':'no'}>Preload fixture</output>;}
const app=createRoot(document.querySelector('#root'));
app.render(<React.StrictMode><FatalErrorBoundary>{params.has('probe')?<HookProbe/>:<PlayHostApp session={session} raceSurface={params.has('custom')?ProviderRace:undefined} onPlayable={()=>window.probe.playable++}/>}</FatalErrorBoundary></React.StrictMode>);
window.loaded=true;
`);
let browser,server;const observations=[];
try{
 browser=await chromium.launch({headless:true});
 for(const variant of ['download','render','healthy']){
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},
   plugins:[{name:'optional-surface-fixture',enforce:'pre',async load(id){
    if(baseline&&id===path.join(root,'src/play/GameFrameApp.tsx'))return readFile(path.join(baseline,'GameFrameApp.before.txt'),'utf8');
    if(baseline&&id===path.join(root,'src/play/game/hooks/useGameSurfaces.ts'))return readFile(path.join(baseline,'useGameSurfaces.before.txt'),'utf8');
    if(id===path.join(root,'src/play/race/RaceTo10Game.tsx'))return `window.probe.raceImports++;export function RaceTo10Game(){return null;}`;
    if(id===path.join(root,'src/play/SolarSystem.tsx')&&variant!=='download')return variant==='render'
     ?`export function SolarSystem(){window.probe.sceneRenders++;throw Error('decorative-render-failed');}`
     :`import React from 'react';export function SolarSystem({paused}){window.probe.sceneRenders++;return React.createElement('div',{'data-testid':'solar-system','data-paused':paused?'yes':'no'});}`;
   }}],build:{outDir:'dist',minify:false}});
  const assets=await readdir(path.join(scratch,'dist/assets'));
  const sceneAsset=assets.find(file=>file.startsWith('SolarSystem-')&&file.endsWith('.js'));
  const raceAsset=assets.find(file=>file.startsWith('RaceTo10Game-')&&file.endsWith('.js'));
  assert.ok(sceneAsset&&raceAsset,'lazy scene and shared multiplayer assets remain separate');
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname),body=await readFile(file);
   response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(body);}catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  for(const width of [1280,390]){
   const metric=async(name,actual,expected)=>{observations.push({variant,width,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
   await page.addInitScript(()=>{Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:8});Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});});
   let sceneRequests=0,releaseScene,sceneRequested;
   const sceneGate=new Promise(resolve=>releaseScene=resolve),sceneReached=new Promise(resolve=>sceneRequested=resolve);
   await page.route(`**/assets/${sceneAsset}`,async route=>{sceneRequests++;sceneRequested();await sceneGate;if(variant==='download')await route.abort('failed');else await route.continue();});
   await page.goto(url);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
   if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
   await waitForAnswerInputReady(page);
   await page.keyboard.type('pia');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIA'));
   const draft=await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame);
   await metric('scene preparation waits until idle is explicitly released',sceneRequests,0);
   await page.evaluate(()=>window.releaseScene());await sceneReached;await page.keyboard.type('n');
   await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('').toUpperCase()==='PIAN'));
   await metric('a pending decoration download leaves typing usable',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.currentLetters.join('').toUpperCase()),'PIAN');
   releaseScene();
   if(variant==='healthy')await page.locator('[data-testid=solar-system]').waitFor({state:'attached'});
   else await page.waitForFunction(()=>window.probe.errors.length>0);
   await metric('decorative failures preserve the game frame',await page.locator('.game-app').count(),1);
   await metric('the same authoritative riddle stays visible',await page.getByText('What has keys but cannot open doors?',{exact:true}).count(),1);
   await metric('decoration does not submit an answer',await page.evaluate(()=>window.probe.guesses),0);
   await metric('decoration does not deliver a reward',await page.evaluate(()=>window.probe.completions),0);
   await metric('saved draft keeps its server session token',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.sessionToken),draft.sessionToken);
   await metric('saved draft survives decorative resolution',await page.evaluate(()=>window.probe.saves.findLast(row=>row.activeGame)?.activeGame.currentLetters.join('').toUpperCase()),'PIAN');
   const reports=await page.evaluate(()=>window.probe.errors.filter(row=>row.component==='solar_system').length);
   await metric('decoration failure is isolated and reported once',reports,variant==='healthy'?0:1);
   await metric('no fatal page diagnostic is emitted',await page.evaluate(()=>window.probe.errors.filter(row=>row.errorKind==='react_render').length),0);
   await page.evaluate(()=>window.pause(true));await page.waitForTimeout(30);await page.evaluate(()=>window.pause(false));await page.waitForTimeout(30);
   await metric('pause and resume do not retry a failed scene import',sceneRequests,1);
   await metric('pause and resume do not repeat its diagnostic',await page.evaluate(()=>window.probe.errors.filter(row=>row.component==='solar_system').length),reports);
   if(variant==='healthy')await metric('healthy decoration follows resume state',await page.locator('[data-testid=solar-system]').getAttribute('data-paused'),'no');
   await page.evaluate(()=>window.setMotion(true));await page.waitForTimeout(30);
   await metric('reduced motion removes healthy and failed decorative children',await page.locator('[data-testid=solar-system]').count(),0);
   await page.evaluate(()=>window.setMotion(false));await page.waitForTimeout(30);
   await metric('motion changes retain native import ownership',sceneRequests,1);
   await metric('motion changes preserve retired failure diagnostics',await page.evaluate(()=>window.probe.errors.filter(row=>row.component==='solar_system').length),reports);
   await metric('only healthy decoration returns when motion is enabled',await page.locator('[data-testid=solar-system]').count(),variant==='healthy'?1:0);
   if(await page.locator('.game-app').count()){
    await page.keyboard.type('o');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.probe.completions===1);
    await page.waitForFunction(()=>window.probe.saves.findLast(row=>row.profile)?.profile.coins===window.probe.authorityCoins);
   }
   await metric('the player can finish after decorative resolution',await page.evaluate(()=>window.probe.guesses),1);
   await metric('completion still delivers one authoritative result',await page.evaluate(()=>window.probe.completions),1);
   await metric('scene resolution produces no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
   if(!baseline)await page.screenshot({path:path.join(output,`${variant}-${width}.png`)});
   await context.close();
   if(variant==='download'){
    for(const outcome of ['active-failure','retired-failure','retired-success']){
     const hookContext=await browser.newContext(),hookPage=await hookContext.newPage();let releaseRace,raceRequested,raceRequests=0;
     const gate=new Promise(resolve=>releaseRace=resolve),reached=new Promise(resolve=>raceRequested=resolve);
     await hookPage.route(`**/assets/${raceAsset}`,async route=>{raceRequests++;raceRequested();await gate;if(outcome==='retired-success')await route.continue();else await route.abort('failed');});
     await hookPage.goto(`${url}?probe=1`);await reached;await hookPage.locator('output[data-modal-ready=yes]').waitFor();
     if(outcome!=='active-failure'){await hookPage.evaluate(()=>window.disableRace());await hookPage.locator('output[data-enabled=no]').waitFor();}
     const renders=await hookPage.evaluate(()=>window.probe.hookRenders);releaseRace();
     if(outcome==='retired-success')await hookPage.waitForFunction(()=>window.probe.raceImports===1);
     else if(outcome==='active-failure')await hookPage.waitForFunction(()=>window.probe.errors.length>0||window.probe.unhandled.length>0);
     await hookPage.waitForTimeout(60);
     await metric(`${outcome}: shared preparation makes one native request`,raceRequests,1);
     await metric(`${outcome}: rejected preparation stays handled`,await hookPage.evaluate(()=>window.probe.unhandled),[]);
     await metric(`${outcome}: diagnostics belong to the current effect`,await hookPage.evaluate(()=>window.probe.errors.filter(row=>row.operation==='preload_multiplayer_surface').length),outcome==='active-failure'?1:0);
     await metric(`${outcome}: retired preparation cannot publish a race component`,await hookPage.locator('output').getAttribute('data-ready'),'no');
     await metric(`${outcome}: retired resolution adds no render`,(await hookPage.evaluate(()=>window.probe.hookRenders))-renders,0);
     await hookContext.close();
    }
    const customContext=await browser.newContext(),customPage=await customContext.newPage();let sharedRequests=0;
    await customPage.route(`**/assets/${raceAsset}`,async route=>{sharedRequests++;await route.abort('failed');});
    await customPage.goto(`${url}?custom=1&harness=race`);await customPage.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();await customPage.waitForTimeout(60);
    await metric('target-provided multiplayer avoids the unused shared chunk',sharedRequests,0);
    await metric('target-provided multiplayer has no unrelated preload rejection',await customPage.evaluate(()=>window.probe.unhandled),[]);
    await customPage.getByRole('button',{name:'Multiplayer',exact:true}).click();await customPage.locator('[data-testid=provider-race]').waitFor();
    await metric('target-provided multiplayer remains reachable',await customPage.locator('[data-testid=provider-race]').count(),1);
    await customPage.getByRole('button',{name:'Return to puzzle',exact:true}).click();
    await metric('closing the target surface preserves the puzzle',await customPage.getByText('What has keys but cannot open doors?',{exact:true}).count(),1);
    await metric('opening the target surface still avoids shared code',sharedRequests,0);
    await customContext.close();
   }
  }
  await new Promise(resolve=>server.close(resolve));server=null;
 }
 await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
 console.log(JSON.stringify({reactMode,baseline:!!baseline,checks:observations.length,failures:observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected))},null,2));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
