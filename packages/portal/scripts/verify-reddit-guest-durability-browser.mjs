import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.GUEST_DURABILITY_REACT_MODE??'development';
const baseline=process.env.GUEST_DURABILITY_BASELINE_DIR;
const coldOnly=process.env.GUEST_DURABILITY_COLD_ONLY==='1';
const output=path.resolve(process.env.GUEST_DURABILITY_REPORT_DIR??path.join(root,'../../builds/test-evidence/reddit-guest-durability-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/reddit-guest-'));
const observations=[];let browser,server;
try {
 const source=`
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {setPlayerHighContrast} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {tr,LANGUAGE_OPTIONS,setLocaleAndWait} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
const locale=new URL(location.href).searchParams.get('locale')??'en';
const key='riddleQuestRedditGuestV1',storage=window.localStorage,nativeSet=Storage.prototype.setItem,nativeGet=Storage.prototype.getItem;
window.probe={fault:'none',writes:[],errors:[],unhandled:[],paths:[],sessions:0};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));
window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
if(!storage.getItem(key))storage.setItem(key,JSON.stringify({preferences:{locale,muted:true,reducedMotion:true,onboardingComplete:true},playerData:null}));
storage.setItem('appLanguage',locale);
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','reddit-guest'),'seen');
for(const tour of ['gameTour','profileTour'])storage.setItem(createTooltipTourStorageKey(tour,'reddit-guest'),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))storage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'reddit-guest'),'seen');
Object.defineProperty(window,'localStorage',{configurable:true,get(){if(window.probe.fault==='blocked')throw new DOMException('storage blocked','SecurityError');return storage;}});
Storage.prototype.setItem=function(k,v){if(this===storage&&k===key){const failed=window.probe.fault==='quota';window.probe.writes.push({failed,value:JSON.parse(v)});if(failed)throw new DOMException('storage full','QuotaExceededError');}return nativeSet.call(this,k,v);};
window.setFault=value=>window.probe.fault=value;
window.preference=()=>setPlayerHighContrast(true);
window.guestCopy=()=>[tr('RedditPlatform.GUEST_LIMITS'),tr('RedditPlatform.CONFIG_WARNING')];
window.supportedLocales=LANGUAGE_OPTIONS.map(x=>x.code);
window.durable=()=>JSON.parse(nativeGet.call(storage,key));
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url??String(input);if(url.startsWith('/api/')){window.probe.paths.push(url);if(url==='/api/session'){window.probe.sessions++;return Response.json({ok:true,authenticated:false});}throw new Error('unexpected-guest-gateway:'+url);}return nativeFetch(input,init);};
globalThis.devvit={context:{},entrypoints:{game:location.origin+'/game.html'},token:'injected-browser-fixture',webViewMode:2};
// Layout cases exercise a settled translated game; cold locale handoff is a separate input-ownership seam.
if(new URL(location.href).searchParams.has('locale')){
 await import(${JSON.stringify(path.join(root,'src/reddit/localeNamespace.ts'))});
 await setLocaleAndWait(locale);
}
window.probe.fault=new URL(location.href).searchParams.get('cold')??'none';
await import(${JSON.stringify(path.join(root,'src/reddit/main.tsx'))});
`;
 await writeFile(path.join(scratch,'main.ts'),source);
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.ts"></script></body></html>');
 await build({root:scratch,base:'./',configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-guest-storage',async load(id){if(baseline&&id.endsWith('/RedditPlatformBootstrap.ts'))return readFile(path.join(baseline,'RedditPlatformBootstrap.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.GUEST_DURABILITY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(r=>{process.once('SIGINT',r);process.once('SIGTERM',r);});}
 else {
 browser=await chromium.launch({headless:true});
 if(!coldOnly)for(const width of [390,1280])for(const fault of ['quota','blocked'])for(const recovery of baseline?['auto']:['auto','manual']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({width,fault,recovery,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  page.on('pageerror',e=>observations.push({width,fault,recovery,name:'page error',actual:String(e),expected:null}));
  await page.goto(url);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  await page.waitForFunction(()=>window.durable()?.playerData?.profile!=null);
  await page.locator('.keyboard .key:not(:disabled)').first().waitFor();
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pi');
  await page.waitForFunction(()=>window.durable()?.playerData?.activeGame?.currentLetters.join('')==='PI');
  const sessions=await page.evaluate(()=>window.probe.sessions);
  await page.evaluate(f=>window.setFault(f),fault);await page.keyboard.type('an');
  await page.waitForFunction(()=>window.draft()==='PIAN');await page.evaluate(()=>window.preference());
  // Keep the fault active until the actual preference subscription has attempted its write.
  await page.waitForTimeout(50);
  metric('accepted input remains playable during failed storage',await page.evaluate(()=>window.draft()),'PIAN');
  metric('failed write does not change durable draft',await page.evaluate(()=>window.durable().playerData.activeGame.currentLetters.join('')),'PI');
  if(recovery==='manual'){
   await page.locator('.player-save-notice button').waitFor({timeout:12000});
   await page.waitForTimeout(100);
   await page.screenshot({path:path.join(output,`${width}-${fault}-unsaved.png`)});
   const hit=await page.locator('.player-save-notice button').evaluate(b=>{const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
   metric('retry remains reachable beside the guest banner',hit,true);
   await page.evaluate(()=>window.setFault('none'));await page.locator('.player-save-notice button').click();
  }else await page.evaluate(()=>window.setFault('none'));
  if(baseline)await page.waitForTimeout(1500);else await page.waitForFunction(()=>window.durable()?.playerData?.activeGame?.currentLetters.join('')==='PIAN'&&window.durable().preferences.highContrast===true);
  metric('latest draft is recovered without another keystroke',await page.evaluate(()=>window.durable()?.playerData?.activeGame?.currentLetters.join('')),'PIAN');
  metric('preference change survives recovery with the draft',await page.evaluate(()=>window.durable()?.preferences.highContrast===true),true);
  if(!baseline){
   await page.locator('.player-save-notice').waitFor({state:'hidden'});
   metric('recovery does not restart provider initialization',await page.evaluate(()=>window.probe.sessions),sessions);
   if(width===390&&fault==='blocked'&&recovery==='auto'){
    const replacement=await browser.newContext({viewport:{width,height:844},storageState:await context.storageState()});
    const coldPage=await replacement.newPage();
    try{
     await coldPage.goto(url);await coldPage.waitForFunction(()=>window.draft()==='PIAN');
     await coldPage.locator('.keyboard .key:not(:disabled)').first().waitFor();
     metric('cold copied storage keeps the newer provider draft without pagehide',await coldPage.evaluate(()=>window.draft()),'PIAN');
     metric('cold recovery keeps the saved input cursor',await coldPage.evaluate(()=>window.durable().playerData.activeGame.activeSlotIndex),4);
    }finally{await replacement.close();}
   }
   await page.reload();await page.waitForFunction(()=>window.draft()==='PIAN');
   metric('reload restores the saved draft',await page.evaluate(()=>window.draft()),'PIAN');
   metric('reload restores the saved preference',await page.evaluate(()=>window.durable().preferences.highContrast),true);
   await page.locator('.keyboard .key:not(:disabled)').first().waitFor();
   await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('o');await page.keyboard.press('Enter');
   await page.waitForFunction(()=>window.durable().playerData.activeGame===null&&window.durable().playerData.profile.gamesPlayed===1);
   metric('one accepted guess completes once',await page.evaluate(()=>({games:window.durable().playerData.profile.gamesPlayed,wins:window.durable().playerData.profile.wins})),{games:1,wins:1});
   metric('guest play retains zero canonical currency',await page.evaluate(()=>({coins:window.durable().playerData.profile.coins,xp:window.durable().playerData.profile.xp})),{coins:0,xp:0});
  }
  metric('guest requests only the same-origin session gateway',await page.evaluate(()=>window.probe.paths.every(x=>x==='/api/session')),true);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);
  metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  await context.close();
 }
 // Exercise cold blocked getters separately from the normal durability and locale matrix.
 if(!baseline)for(const width of [390,1280])for(const fault of process.env.GUEST_DURABILITY_COLD_BLOCKED==='1'?['blocked']:['quota']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({width,fault,recovery:'cold-start',name,actual,expected});assert.deepEqual(actual,expected,name);};
  await page.goto(url+'?cold='+fault);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  // A genuinely blocked getter cannot read the preseeded onboarding preference. Complete the real introduction.
  for(let i=0;i<8;i++){
   const welcome=page.locator('.onboarding-card button').last(),tour=page.locator('.tooltip-card button').last();
   if(await welcome.isVisible())await welcome.click();else if(await tour.isVisible())await tour.click();else break;
   await page.waitForTimeout(50);
  }
  await page.locator('.keyboard .key:not(:disabled)').first().waitFor();
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');await page.evaluate(()=>window.preference());await page.waitForTimeout(50);
  metric('guest play starts with unavailable storage',await page.evaluate(()=>window.draft()),'PIAN');
  metric('cold failed progress has no durability acknowledgement',await page.evaluate(()=>window.durable().playerData),null);
  await page.evaluate(()=>window.setFault('none'));
  // Onboarding can outlast the bounded retry episode; use the real recovery control if it is already exhausted.
  if(fault==='blocked'&&await page.locator('.player-save-notice button').isVisible())await page.locator('.player-save-notice button').click();
  await page.waitForFunction(()=>window.durable()?.playerData?.activeGame?.currentLetters.join('')==='PIAN'&&window.durable().preferences.highContrast===true);
  metric('cold startup retries the latest complete guest record',await page.evaluate(()=>({draft:window.durable().playerData.activeGame.currentLetters.join(''),contrast:window.durable().preferences.highContrast})),{draft:'PIAN',contrast:true});
  metric('cold startup has no unhandled storage rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  // A restored getter must remain restored on the replacement view; the fault-bearing URL would block reads again.
  if(fault==='blocked')await page.goto(url);else await page.reload();
  await page.waitForFunction(()=>window.draft()==='PIAN');metric('cold recovery survives reload',await page.evaluate(()=>window.draft()),'PIAN');
  await context.close();
 }
 if(!baseline&&!coldOnly)for(const locale of ['en','ar','de','es','fr','hi','id','it','ja','ko','pt','ru','nl','tr','vi','pl'])for(const [width,height] of [[390,844],[390,568]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({locale,width,height,recovery:'localized-layout',name,actual,expected});assert.deepEqual(actual,expected,name+':'+locale+':'+height);};
  await page.goto(url+'?locale='+locale);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  await page.locator('.keyboard .key:not(:disabled)').first().waitFor();
  await page.evaluate(()=>{document.activeElement?.blur();window.setFault('quota');});await page.keyboard.type('pian');
  await page.locator('.player-save-notice button').waitFor();await page.waitForTimeout(150);
  const layout=await page.evaluate(()=>{const button=document.querySelector('.player-save-notice button'),r=button.getBoundingClientRect();const banner=document.querySelector('.reddit-guest-banner').getBoundingClientRect(),notice=document.querySelector('.player-save-notice').getBoundingClientRect();const controls=Array.from(document.querySelectorAll('.keyboard .key,.game-input-actions button,.game-bottom-navigation button'));return {language:document.documentElement.lang,reachable:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),separate:notice.top>=banner.bottom,minKeyHeight:Math.min(...Array.from(document.querySelectorAll('.keyboard .key')).map(k=>k.getBoundingClientRect().height)),controlsFit:controls.every(c=>{const r=c.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),scrollHeight:document.documentElement.scrollHeight,body:document.body.innerText};});
  metric('controls use the requested locale',layout.language,locale);
  metric('localized guest banner and recovery row do not overlap',layout.separate&&layout.reachable,true);
  metric('keyboard retains 32px minimum height',layout.minKeyHeight>=32,true);
  metric('all game controls fit the viewport',layout.controlsFit&&layout.scrollHeight<=height+1,true);
  metric('actual guest input remains accepted',await page.evaluate(()=>window.draft()),'PIAN');
  metric('all supported locale names match the real catalog',await page.evaluate(()=>window.supportedLocales.includes(document.documentElement.lang)),true);
  metric('the previous fixed guest warning is absent',await page.locator('.game-shell-alert').count(),0);
  await page.locator('.reddit-guest-banner summary').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.reddit-guest-banner details').open);
  metric('native disclosure preserves all translated guest information',await page.locator('.reddit-guest-details p').allTextContents(),await page.evaluate(()=>window.guestCopy()));
  metric('disclosure keyboard activation does not edit the answer',await page.evaluate(()=>window.draft()),'PIAN');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('.reddit-guest-banner details').open);
  await page.screenshot({path:path.join(output,`layout-${locale}-${width}-${height}.png`)});await context.close();
 }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({body:document.body.innerText,probe:window.probe,draft:window.draft?.(),durable:window.durable?.()})).catch(e=>({error:String(e)})),null,2));
 await browser?.close();if(server)await new Promise(r=>server.close(r));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
