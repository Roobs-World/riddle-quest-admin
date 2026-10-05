import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.PROFILE_RESTORE_REACT_MODE??'development',baseline=process.env.PROFILE_RESTORE_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.PROFILE_RESTORE_REPORT_DIR??path.join(root,'../../artifacts/profile-dismiss-focus-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/profile-dismiss-focus-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>nav button{font-size:9px!important;min-height:12px!important;padding:2px!important}</style></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,'src/play/GameModalView.tsx'))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,'src/play/gameSession.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const noop=()=>{};window.probe={closes:0,updates:[],deletes:0,focus:[],errors:[],unhandled:[],adds:0,removes:0};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const nativeFrame=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);let held=false,nextFrame=-1;const frames=new Map();window.probe.holdFrames=()=>{held=true;};window.requestAnimationFrame=callback=>{if(!held||!String(callback).includes("deleteTriggerRef.current"))return nativeFrame(callback);const id=nextFrame--;frames.set(id,callback);return id;};window.cancelAnimationFrame=id=>{if(frames.has(id))frames.delete(id);else nativeCancel(id);};window.probe.flushFrames=()=>new Promise(resolve=>{held=false;nativeFrame(time=>{const queued=[...frames.values()];frames.clear();if(!${process.env.PROFILE_RESTORE_DROP_FRAME === "1"})queued.forEach(callback=>callback(time));resolve();});});window.probe.pendingFrames=()=>frames.size;
document.addEventListener('focusin',event=>window.probe.focus.push({tag:event.target?.tagName,className:event.target?.className,placeholder:event.target?.getAttribute?.('placeholder')??null}));
window.probe.listeners=new Set();const nativeAdd=document.addEventListener.bind(document),nativeRemove=document.removeEventListener.bind(document);document.addEventListener=(type,listener,...rest)=>{if(type==='keydown'){window.probe.adds++;window.probe.listeners.add(listener);}return nativeAdd(type,listener,...rest);};document.removeEventListener=(type,listener,...rest)=>{if(type==='keydown'){window.probe.removes++;window.probe.listeners.delete(listener);}return nativeRemove(type,listener,...rest);};
function App(){const [state,setState]=React.useState(()=>({...createInitialGameSession(),user:{userId:'fixture',platformRegistered:true}})),[blocked]=React.useState(false),[commerce]=React.useState(true);const open=modal=>setState(s=>({...s,modal}));
 return <><main style={{paddingTop:100}} inert={state.modal!==null||undefined}><button data-profile onClick={()=>open('profile')}>Profile</button><button data-continue onClick={()=>open('continue')}>Continue fixture</button></main>
 <nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white'}}><button data-refresh onMouseDown={e=>e.preventDefault()} onClick={()=>setState(s=>({...s,guessPending:!s.guessPending}))}>Deliver game update</button></nav>
 <div data-surface inert={blocked||undefined}><GameModalView state={state} interactionBlocked={blocked} commerceAvailable={commerce} onClose={()=>{window.probe.closes++;open(null);}} onOpenModal={open} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={name=>window.probe.updates.push(name)} onUpdateAvatar={async()=>{}} onDeleteAccount={()=>window.probe.deletes++} onCoinBalancePreview={noop}/></div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/ProfileModalPage.tsx'))return readFile(path.join(baseline,'profile.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PROFILE_RESTORE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
  browser=await chromium.launch({headless:true});
  for(const [width,height] of process.env.PROFILE_RESTORE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])
  for(const method of process.env.PROFILE_RESTORE_METHODS?.split(',')??['escape','cancel'])
  for(const scenario of process.env.PROFILE_RESTORE_SCENARIOS?.split(',')??['early-tab','early-enter','late-tab','no-tab','reopen','outer-close']) {
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const metric=(name,actual,expected)=>observations.push({width,height,method,scenario,name,actual,expected});
   const dialog=page.locator('.game-modal'),confirmation=page.locator('.profile-delete-dialog');
   await page.goto(url);await page.locator('[data-profile]').click();await dialog.waitFor();await settle();
   await dialog.locator('.profile-danger-zone button').click();await confirmation.waitFor();await settle();
   await page.evaluate(()=>{window.probe.dialogBefore=document.querySelector('.game-modal');window.probe.triggerBefore=document.querySelector('.profile-danger-zone button');window.probe.holdFrames();});
   if(method==='escape')await page.keyboard.press('Escape');else await confirmation.locator('button').first().click();
   await confirmation.waitFor({state:'detached'});
   metric('dismissal commits focus return before a deferred restoration frame',await dialog.locator('.profile-danger-zone button').evaluate(el=>el===document.activeElement),true);
   metric('outer keyboard listener is present before subsequent input',await page.evaluate(()=>window.probe.listeners.size),1);
   metric('dismissal retains the same connected outer controls',await page.evaluate(()=>window.probe.dialogBefore===document.querySelector('.game-modal')&&window.probe.triggerBefore===document.querySelector('.profile-danger-zone button')&&window.probe.triggerBefore.isConnected),true);
   if(scenario==='late-tab')await page.evaluate(()=>window.probe.flushFrames());
   if(['early-tab','early-enter','late-tab'].includes(scenario)) {
    await page.keyboard.press('Tab');
    await page.evaluate(()=>window.probe.focusBeforeFrame=document.activeElement);
    metric('native Tab from dismissed Delete wraps to the outer Close control',await dialog.locator('.modal-x').evaluate(el=>el===document.activeElement),true);
   }
   if(scenario==='reopen') {
    await dialog.locator('.profile-danger-zone button').click();await confirmation.waitFor();
    metric('a reopened confirmation autofocuses its safe Cancel action',await confirmation.locator('button').first().evaluate(el=>el===document.activeElement),true);
   }
   if(scenario==='outer-close') {await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});}
   if(scenario!=='late-tab')await page.evaluate(()=>window.probe.flushFrames());await settle();
   if(scenario==='no-tab')metric('dismissal without later input keeps the Delete trigger',await dialog.locator('.profile-danger-zone button').evaluate(el=>el===document.activeElement),true);
   else if(scenario==='reopen')metric('a retired dismissal never steals focus from a reopened confirmation',await confirmation.locator('button').first().evaluate(el=>el===document.activeElement),true);
   else if(scenario==='outer-close')metric('a retired dismissal leaves focus on the game Profile trigger',await page.locator('[data-profile]').evaluate(el=>el===document.activeElement),true);
   else metric('dismissal restoration preserves later native Tab focus',await page.evaluate(()=>document.activeElement===window.probe.focusBeforeFrame),true);
   if(process.env.PROFILE_RESTORE_SMOKE!=='1'&&scenario!=='outer-close') {
    const registration=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);
    await page.evaluate(()=>window.probe.focusBeforeUpdates=document.activeElement);
    for(let i=0;i<32;i++)await page.locator('[data-refresh]').click();await settle();
    metric('32 game updates retain the same native focus',await page.evaluate(()=>document.activeElement===window.probe.focusBeforeUpdates),true);
    metric('32 game updates do not rebuild the keyboard subscription',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),registration);
    metric('one current outer keyboard subscription remains',await page.evaluate(()=>window.probe.listeners.size),1);
   }
   if(scenario==='early-enter') {await page.keyboard.press('Enter');await settle();}
   metric('outer Profile lifetime matches the requested native action',await dialog.count(),['early-enter','outer-close'].includes(scenario)?0:1);
   metric('outer Close runs exactly once only when requested',await page.evaluate(()=>window.probe.closes),['early-enter','outer-close'].includes(scenario)?1:0);
   metric('confirmation lifetime follows only the current native action',await confirmation.count(),scenario==='reopen'?1:0);
   metric('native dismissal never deletes an account',await page.evaluate(()=>window.probe.deletes),0);
   metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);
   metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);
   await page.screenshot({path:path.join(output,[method,scenario,width,height].join('-')+'.png')});await context.close();
  }
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.PROFILE_RESTORE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.PROFILE_RESTORE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Profile dismissal retains native focus');
