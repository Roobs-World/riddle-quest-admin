import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const browserScope=process.env.PORTAL_BROWSER_SCOPE;
assert.ok(browserScope===undefined||browserScope==='jest-facebook','PORTAL_BROWSER_SCOPE must be jest-facebook or unset');
const providers=browserScope==='jest-facebook'?['facebook']:['facebook','reddit'];
if(browserScope&&process.env.PROVIDER_RECOVERY_ONLY)assert.ok(providers.includes(process.env.PROVIDER_RECOVERY_ONLY.split(':')[0]),'PROVIDER_RECOVERY_ONLY is outside PORTAL_BROWSER_SCOPE');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.PROVIDER_RECOVERY_REACT_MODE??'development',baseline=process.env.PROVIDER_RECOVERY_BASELINE_DIR,wakeBaseline=process.env.PROVIDER_RECOVERY_WAKE_BASELINE_DIR;
const output=path.resolve(process.env.PROVIDER_RECOVERY_REPORT_DIR??path.join(root,'builds/test-evidence/provider-save-recovery-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/provider-save-'));
let server,browser;const observations=[];
try {
 for(const provider of providers){
  const dir=path.join(scratch,provider);await mkdir(dir);
  const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {${provider==='facebook'?'FacebookPlatformBootstrap':'RedditPlatformBootstrap'}} from ${JSON.stringify(path.join(root,'src',provider,provider==='facebook'?'FacebookPlatformBootstrap.ts':'RedditPlatformBootstrap.ts'))};
${provider==='reddit'?"import {getWebViewMode} from '@devvit/client';":''}
import {PlayerProjectionPersistence} from ${JSON.stringify(path.join(root,"src/accounts/browser/playerState/PlayerProjectionPersistence.ts"))};
import {usePlayerProjectionRecovery} from ${JSON.stringify(path.join(root,"src/accounts/hooks/usePlayerProjectionRecovery.ts"))};
import {PlayerSaveRecoveryLayout} from ${JSON.stringify(path.join(root,"src/accounts/components/recovery/PlayerSaveRecoveryLayout.tsx"))};
import {PlayHostApp} from ${JSON.stringify(path.join(root,"src/app/components/PlayHostApp.tsx"))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,"src/app/session/HostedPlaySession.ts"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,"src/gameplay/fixtures/fakeServices.ts"))};
import {LocalAccountDeletionGate} from ${JSON.stringify(path.join(root,"src/accounts/browser/deletion/LocalAccountDeletionGate.ts"))};
import {applyPlayerPreferences,subscribeToPlayerPreferenceChanges,setPlayerReducedMotion} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,"src/onboarding/browser/guidanceConfig.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={writes:[],preferences:[],failures:[],errors:[],unhandled:[],flushes:0,guesses:0,completions:0,pauseConsumers:0,resumeConsumers:0,initializations:0,nativePauseRegistrations:0,nativeResumeRegistrations:0,paths:[],failDraft:0,failPreferences:0,holdNext:false,holding:false};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const preferences={locale:'en',muted:true,reducedMotion:true,onboardingComplete:true};applyPlayerPreferences(preferences);
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
let stored={riddleQuestPreferences:preferences},durable=structuredClone(stored),pauseNative,resumeNative,release;
const failed=counter=>{if(window.probe[counter]===0)return false;if(window.probe[counter]>0)window.probe[counter]--;return true;};
async function save(key,value){const copy=structuredClone(value);if(key==='riddleQuestPlayerState')window.probe.writes.push(copy);else window.probe.preferences.push(copy);
 if(window.probe.holdNext&&value?.activeGame){window.probe.holdNext=false;window.probe.holding=true;await new Promise(r=>release=r);window.probe.holding=false;}
 if((key==='riddleQuestPlayerState'&&value?.activeGame?.currentLetters.join('')==='PIAN'&&failed('failDraft'))||(key==='riddleQuestPreferences'&&value?.reducedMotion===false&&failed('failPreferences'))){if(key==='riddleQuestPlayerState'&&!('rejectedDraftDurable' in window.probe)){window.probe.firstRejectedWrite=window.probe.writes.length-1;window.probe.rejectedDraftDurable=durable.riddleQuestPlayerState?.activeGame?.currentLetters.join('')==='PIAN';}if(!window.probe.faultSignaled){window.probe.faultSignaled=true;const scenario=new URL(location.href).searchParams.get('scenario');if(scenario==='offline')window.online(false);if(scenario==='hidden'||scenario==='wake-budget')window.visible(false);}throw new Error('injected-provider-write-failure');}
 stored[key]=copy;
}
window.durableData=()=>structuredClone(durable.riddleQuestPlayerState??null);window.durablePreferences=()=>structuredClone(durable.riddleQuestPreferences??{});window.release=()=>release?.();
const sdk={initializeAsync:async()=>window.probe.initializations++,setLoadingProgress:()=>{},startGameAsync:async()=>{},getSupportedAPIs:()=>[],onPause:fn=>{window.probe.nativePauseRegistrations++;pauseNative=fn;},onResume:fn=>{window.probe.nativeResumeRegistrations++;resumeNative=fn;},player:{getID:()=> 'fixture-facebook-player',getDataAsync:async keys=>Object.fromEntries(keys.map(k=>[k,structuredClone(stored[k])])),setDataAsync:async value=>{for(const [key,data]of Object.entries(value))await save(key,data);},flushDataAsync:async()=>{window.probe.flushes++;durable=structuredClone(stored);}}};
if(new URL(location.href).searchParams.get('scenario')==='wake-budget')sdk.onResume=undefined;
globalThis.devvit={context:{},entrypoints:{game:location.origin+'/game.html'},token:'injected-browser-fixture',webViewMode:2};
${provider==='reddit'?`window.fetch=async(input,init)=>{const pathname=new URL(typeof input==='string'?input:input.url,location.origin).pathname;window.probe.paths.push(pathname);let value;
try {if(pathname==='/api/session')value={ok:true,authenticated:true,accountGeneration:1,features:{identity:true,gameplay:true,commerce:false,referrals:false,notifications:false,matchmaking:false,tournaments:false,presence:false}};
else if(pathname==='/api/storage/read')value={ok:true,preferences:stored.riddleQuestPreferences,playerData:stored.riddleQuestPlayerState??null};
else if(pathname==='/api/storage/write'){const input=JSON.parse(init.body);if(input.playerData)await save('riddleQuestPlayerState',input.playerData);if(input.preferences)await save('riddleQuestPreferences',input.preferences);durable=structuredClone(stored);value={ok:true};}
else if(pathname==='/api/storage/clear'){stored={};durable={};value={ok:true};}else throw new Error('unexpected-gateway-path');return Response.json(value);}catch(error){return Response.json({ok:false,error:String(error)},{status:503});}};`:''}
window.nativePause=()=>{${provider==='facebook'?'pauseNative?.();':"devvit.webViewMode=1;window.dispatchEvent(new Event('focus'));"}};
window.nativeResume=()=>{${provider==='facebook'?'resumeNative?.();':"devvit.webViewMode=2;window.dispatchEvent(new Event('focus'));"}};
window.online=value=>{Object.defineProperty(navigator,'onLine',{configurable:true,value});window.dispatchEvent(new Event(value?'online':'offline'));};
window.visible=value=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:value?'visible':'hidden'});document.dispatchEvent(new Event('visibilitychange'));};
const service=createFakeHostServices(),services={...service,submitGuess:async input=>{window.probe.guesses++;return service.submitGuess(input);},completeGame:async input=>{window.probe.completions++;return service.completeGame(input);}};
const gate=new LocalAccountDeletionGate({crossContextLock:null,requireCrossContextLock:false,readEpoch:()=>null,writeEpoch:()=>{}});window.closeGate=()=>gate.close();
function App(){const [current,setCurrent]=React.useState(null);window.retire=()=>setCurrent(null);const owner=current?.owner??null;
 const recovery=usePlayerProjectionRecovery(owner,{lifecycle:current?.session.capabilities.lifecycle,canRecover:()=>gate.isOpen()${provider==='reddit'?"&&getWebViewMode()==='expanded'":''}});window.recovery=recovery;
 React.useEffect(()=>{let active=true;void new ${provider==='facebook'?'FacebookPlatformBootstrap(()=>sdk)':'RedditPlatformBootstrap()'}.initialize(()=>{}).then(async result=>{if(result.status!=='success')throw new Error('bootstrap-failed');const initial=await result.value.storage.readPlayerData();if(!active)return;const next=new PlayerProjectionPersistence(result.value.storage,initial,preferences,${provider==='facebook'?'gate':'undefined'});window.owner=next;setCurrent({owner:next,session:result.value});});return()=>{active=false;};},[]);
 React.useEffect(()=>owner?subscribeToPlayerPreferenceChanges(change=>{void owner.updatePreferences(change).catch(e=>window.probe.failures.push(String(e)));}):undefined,[owner]);
 React.useEffect(()=>{if(!current)return;const lifecycle=current.session.capabilities.lifecycle;const stopPause=lifecycle?.onPause(()=>{window.probe.pauseConsumers++;});const stopResume=lifecycle?.onResume?.(()=>{window.probe.resumeConsumers++;});return()=>{stopPause?.();stopResume?.();};},[current]);
 const write=update=>{void owner.update(update).catch(e=>window.probe.failures.push(String(e)));};
 return current?<PlayerSaveRecoveryLayout recovery={recovery}><PlayHostApp session={createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,onPlayerDataChange:write})}/></PlayerSaveRecoveryLayout>:<p data-testid='initializing'>Initializing injected provider</p>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
window.preference=()=>setPlayerReducedMotion(false);window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
`;
  await writeFile(path.join(dir,'main.tsx'),source);await writeFile(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(dir,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await build({root:dir,base:"./",configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-provider-owner',async load(id){if(browserScope==='jest-facebook')assert.ok(!/(?:\/src\/reddit\/|\/@devvit\/)/u.test(id),'Reddit modules are outside PORTAL_BROWSER_SCOPE');if(wakeBaseline&&id.endsWith('/usePlayerProjectionRecovery.ts'))return readFile(path.join(wakeBaseline,'usePlayerProjectionRecovery.uncoalesced.txt'),'utf8');if(!baseline)return;if(id.endsWith('/PlayerProjectionPersistence.ts'))return readFile(path.join(baseline,'PlayerProjectionPersistence.before.txt'),'utf8');if(id.endsWith('/usePlayerProjectionRecovery.ts'))return `import {useMemo} from 'react';import {PlayerSaveRecovery} from ${JSON.stringify(path.join(root,"src/accounts/browser/playerState/PlayerSaveRecovery.ts"))};export function usePlayerProjectionRecovery(){return useMemo(()=>new PlayerSaveRecovery(async()=>{},()=>false),[]);}`;}}],build:{outDir:'dist',minify:false}});
 }
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,parts=pathname.split('/').filter(Boolean),provider=parts.shift();if(!providers.includes(provider))throw new Error('unknown-fixture');const file=path.join(scratch,provider,'dist',parts.join('/')||'index.html');res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PROVIDER_RECOVERY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(r=>{process.once('SIGINT',r);process.once('SIGTERM',r);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const provider of providers)for(const width of [390,1280])for(const scenario of (baseline?['auto']:['auto','offline','hidden','pause','wake-budget','manual','preferences','healthy','retire','deletion'])){
  if(process.env.PROVIDER_RECOVERY_ONLY&&process.env.PROVIDER_RECOVERY_ONLY!==provider+':'+scenario)continue;
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({provider,width,scenario,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+'/'+provider+'/?scenario='+scenario);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();await page.evaluate(()=>document.activeElement?.blur());
  await page.waitForFunction(()=>window.durableData()?.profile!=null);
  const initializations=await page.evaluate(()=>window.probe.initializations);
  if(scenario==='preferences'){
   await page.evaluate(()=>{window.probe.failPreferences=1;window.preference();});await page.waitForFunction(()=>window.probe.failures.length>0);await page.waitForFunction(()=>window.durablePreferences().reducedMotion===false);
   metric('rejected preference recovers without another change',await page.evaluate(()=>window.durablePreferences().reducedMotion),false);metric('other initialized preferences remain saved',await page.evaluate(()=>window.durablePreferences().locale),'en');
  }else{
   await waitForAnswerInputReady(page);
   await page.evaluate(persistent=>window.probe.failDraft=persistent?-1:1,['offline','hidden','manual','pause','wake-budget','retire','deletion'].includes(scenario));
   await page.keyboard.type('pian');await page.waitForFunction(()=>window.draft()==='PIAN'&&window.probe.failures.length>0);
   const count=()=>page.evaluate(()=>window.probe.writes.filter(x=>x?.activeGame?.currentLetters.join('')==='PIAN').length);
   metric('failed draft remains playable',await page.evaluate(()=>window.draft()),'PIAN');metric('initial rejected draft is not durable',await page.evaluate(()=>window.probe.rejectedDraftDurable),false);
   if(['offline','hidden','pause','retire','deletion','healthy'].includes(scenario)){
    if(scenario==='pause')await page.evaluate(()=>window.nativePause());
    if(scenario==='retire')await page.evaluate(()=>window.retire());
    if(scenario==='deletion')await page.evaluate(async()=>{window.probe.failDraft=0;await window.owner.closeAndFlush();await window.owner.clear();window.closeGate();});
    if(scenario==='healthy'){await page.evaluate(()=>window.probe.holdNext=true);await page.keyboard.press('Backspace');await page.waitForFunction(()=>window.probe.holding);}
    const before=await count();await page.waitForTimeout(1250);metric('unavailable or held owner does not start another draft write',await count(),before);
    if(scenario==='offline'){metric('offline notice disables retry',await page.locator('.player-save-notice button').isDisabled(),true);await page.evaluate(()=>{window.probe.failDraft=0;window.online(true);});}
    if(scenario==='hidden')await page.evaluate(()=>{window.probe.failDraft=0;window.visible(true);});
    if(scenario==='pause'){metric('other pause consumer retains delivery',await page.evaluate(()=>window.probe.pauseConsumers),1);await page.evaluate(()=>{window.probe.failDraft=0;window.nativeResume();});metric('other resume consumer retains delivery',await page.evaluate(()=>window.probe.resumeConsumers),1);}
    if(scenario==='healthy'){await page.evaluate(()=>window.release());await page.waitForFunction(()=>window.durableData()?.activeGame?.currentLetters.join('')==='PIA'&&window.recovery.getSnapshot()==='quiet');metric('healthy newest snapshot cancels redundant retry',await page.evaluate(()=>window.probe.writes.slice(window.probe.firstRejectedWrite).filter(x=>['PIAN','PIA'].includes(x?.activeGame?.currentLetters.join(''))).length),2);}
    if(scenario==='retire'||scenario==='deletion'){await page.evaluate(()=>window.recovery.wake());metric('retired/deleted notice remains quiet',await page.evaluate(()=>window.recovery.getSnapshot()),'quiet');if(scenario==='deletion')metric('deletion does not resurrect the projection',await page.evaluate(()=>window.durableData()),null);}
   }
   if(scenario==='wake-budget'){await page.waitForTimeout(50);const beforeWake=await count();await page.evaluate(()=>window.visible(true));await page.waitForFunction(()=>window.recovery.getSnapshot()==='unsaved');metric('one visibility signal grants three recovery attempts',(await count())-beforeWake,3);}
   if(scenario==='manual'){
    await page.waitForFunction(()=>window.recovery.getSnapshot()==='unsaved');metric('automatic attempt budget stays bounded',await count(),4);
    await page.waitForTimeout(1250);metric('exhausted episode does not keep polling',await count(),4);
    await page.screenshot({path:path.join(output,`${provider}-${width}-unsaved.png`)});
    await page.evaluate(()=>{window.probe.failDraft=0;window.probe.holdNext=true;});await page.locator('.player-save-notice button').click();await page.waitForFunction(()=>window.probe.holding);
    metric('manual retry exposes busy acknowledgement',await page.locator('.player-save-notice button').getAttribute('aria-busy'),'true');metric('manual retry prevents duplicate clicks',await page.locator('.player-save-notice button').isDisabled(),true);
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Backspace');await page.waitForFunction(()=>window.draft()==='PIA');metric('typing continues while retry is held',await page.evaluate(()=>window.draft()),'PIA');
    await page.evaluate(()=>window.release());await page.waitForFunction(()=>window.durableData()?.activeGame?.currentLetters.join('')==='PIA'&&window.recovery.getSnapshot()==='quiet');
    metric('latest accepted draft settles before notice disappears',await page.evaluate(()=>window.durableData().activeGame.currentLetters.join('')),'PIA');
    await page.keyboard.type('no');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.probe.completions===1&&window.durableData()?.activeGame===null);
    metric('recovery does not duplicate guess authority',await page.evaluate(()=>window.probe.guesses),1);metric('recovery does not duplicate completion authority',await page.evaluate(()=>window.probe.completions),1);
   }
   if(['auto','offline','hidden','pause'].includes(scenario)){
    if(baseline)await page.waitForTimeout(1400);else await page.waitForFunction(()=>window.durableData()?.activeGame?.currentLetters.join('')==='PIAN');
    metric('draft recovers without another keystroke',await page.evaluate(()=>window.durableData()?.activeGame?.currentLetters.join('')==='PIAN'),true);
    if(!baseline)await page.waitForFunction(()=>window.recovery.getSnapshot()==='quiet');
   }
  }
  metric('save health does not restart initialization',await page.evaluate(()=>window.probe.initializations),initializations);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  if(provider==='reddit')metric('Reddit adapter stays in same-origin gateway paths',await page.evaluate(()=>window.probe.paths.every(x=>x.startsWith('/api/'))),true);
  if(provider==='facebook')metric('native listeners share one pause registration',await page.evaluate(()=>window.probe.nativePauseRegistrations),1);
  await context.close();
 }
 }
}finally{if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({url:location.href,body:document.body.innerText,probe:window.probe,draft:window.draft?.(),status:window.recovery?.getSnapshot(),durable:window.durableData?.()})).catch(e=>({error:String(e)})),null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
