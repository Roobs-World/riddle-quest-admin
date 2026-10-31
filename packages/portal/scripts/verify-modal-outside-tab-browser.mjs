import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.MODAL_OUTSIDE_REACT_MODE??'development',baseline=process.env.MODAL_OUTSIDE_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.MODAL_OUTSIDE_REPORT_DIR??path.join(root,'../../builds/test-evidence/modal-outside-tab-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/modal-outside-tab-'));let server,browser;const observations=[];
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
const requested=new URL(location.href).searchParams.get("page"),initialModal=requested==="settings"?"settings":requested==="instructions"?"instructions":"profile",noop=()=>{};window.probe={closes:0,updates:[],deletes:0,focus:[],errors:[],unhandled:[],adds:0,removes:0};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const nativeFrame=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);let held=false,nextFrame=-1;const frames=new Map();window.probe.holdFrames=()=>{held=true;};window.requestAnimationFrame=callback=>{if(!held||!String(callback).includes("lastFocusedControlRef.current"))return nativeFrame(callback);const id=nextFrame--;frames.set(id,callback);return id;};window.cancelAnimationFrame=id=>{if(frames.has(id))frames.delete(id);else nativeCancel(id);};window.probe.flushFrames=()=>new Promise(resolve=>{held=false;nativeFrame(time=>{const queued=[...frames.values()];frames.clear();if(!${process.env.MODAL_OUTSIDE_DROP_FRAME === "1"})queued.forEach(callback=>callback(time));resolve();});});window.probe.pendingFrames=()=>frames.size;
document.addEventListener('focusin',event=>window.probe.focus.push({tag:event.target?.tagName,className:event.target?.className,placeholder:event.target?.getAttribute?.('placeholder')??null}));
window.consumeKey=null;window.probe.nativeKeys=[];document.addEventListener('keydown',event=>{if(event.key==='Tab'){window.probe.nativeKeys.push(event);window.probe.focusAtKey={tag:document.activeElement.tagName,className:document.activeElement.className,inert:!!document.activeElement.closest('[inert]'),targetTag:event.target.tagName,targetClass:event.target.className};}if(event.key===window.consumeKey)event.preventDefault();},true);window.probe.listeners=new Set();const nativeAdd=document.addEventListener.bind(document),nativeRemove=document.removeEventListener.bind(document);document.addEventListener=(type,listener,...rest)=>{if(type==='keydown'){window.probe.adds++;window.probe.listeners.add(listener);}return nativeAdd(type,listener,...rest);};document.removeEventListener=(type,listener,...rest)=>{if(type==='keydown'){window.probe.removes++;window.probe.listeners.delete(listener);}return nativeRemove(type,listener,...rest);};
function App(){const [state,setState]=React.useState(()=>({...createInitialGameSession(),user:{userId:'fixture',platformRegistered:true}})),[blocked,setBlocked]=React.useState(false),[commerce]=React.useState(true);const open=modal=>setState(s=>({...s,modal}));
 return <><main style={{paddingTop:100}} inert={state.modal!==null||undefined}><button data-entry onClick={()=>open(initialModal)}>Open fixture dialog</button><button data-continue onClick={()=>open('continue')}>Continue fixture</button></main>
 <nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white'}}><button data-cover onMouseDown={e=>e.preventDefault()} onClick={()=>setBlocked(true)}>Cover dialog</button><button data-refresh onMouseDown={e=>e.preventDefault()} onClick={()=>setState(s=>({...s,guessPending:!s.guessPending}))}>Deliver game update</button></nav>
 <div data-surface inert={blocked||undefined}><GameModalView state={state} interactionBlocked={blocked} commerceAvailable={commerce} onClose={()=>{window.probe.closes++;open(null);}} onOpenModal={open} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={name=>window.probe.updates.push(name)} onUpdateAvatar={async()=>{}} onDeleteAccount={()=>window.probe.deletes++} onCoinBalancePreview={noop}/></div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/GameModalView.tsx'))return readFile(path.join(baseline,'modal.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.MODAL_OUTSIDE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
  browser=await chromium.launch({headless:true});
  for(const [width,height] of process.env.MODAL_OUTSIDE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])
  for(const surface of process.env.MODAL_OUTSIDE_PAGES?.split(',')??['profile','settings','instructions'])
  for(const direction of process.env.MODAL_OUTSIDE_DIRECTIONS?.split(',')??['forward','reverse'])
  for(const scenario of process.env.MODAL_OUTSIDE_SCENARIOS?.split(',')??['first-open','refocus-outside','claimed-native','covered','retired','nested-confirmation']) {
   if(scenario==='nested-confirmation'&&surface!=='profile')continue;
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const metric=(name,actual,expected)=>observations.push({width,height,surface,direction,scenario,name,actual,expected});
   const dialog=page.locator('.game-modal');await page.goto(url+'/?page='+surface);
   await page.locator('[data-entry]').waitFor();await settle();
   const early=['first-open','claimed-native'].includes(scenario)&&process.env.MODAL_OUTSIDE_LATE!=='1';
   if(early)await page.evaluate(()=>window.probe.holdFrames());
   await page.locator('[data-entry]').click();await dialog.waitFor();if(!early)await settle();
   let target=direction==='forward'?dialog.locator('.modal-x'):surface==='profile'?dialog.locator('.profile-danger-zone button'):surface==='settings'?dialog.locator('button.settings-row').last():dialog.locator('.play-primary');
   if(scenario==='nested-confirmation') {
    await dialog.locator('.profile-danger-zone button').click();await page.locator('.profile-delete-dialog').waitFor();
    target=direction==='forward'?page.locator('.profile-delete-dialog button').first():page.locator('.profile-delete-dialog button').last();
    // A provider or retained control can restore focus into the shell behind the nested confirmation.
    await dialog.locator('.modal-x').focus();
   }
   if(scenario==='refocus-outside')await page.locator('[data-refresh]').focus();
   if(scenario==='claimed-native') {
    await page.locator('[data-refresh]').focus();
    await page.evaluate(()=>{window.consumeKey='Tab';window.probe.beforeClaim=document.activeElement;window.probe.claimBefore={tag:document.activeElement.tagName,className:document.activeElement.className,inert:!!document.activeElement.closest('[inert]')};});
    metric('the earlier native key owner has a live outside control',await page.evaluate(()=>window.probe.beforeClaim.isConnected&&!window.probe.beforeClaim.closest('[inert]')),true);
   }
   if(scenario==='covered'){await page.locator('[data-cover]').click();await page.locator('[data-refresh]').focus();}
   if(scenario==='retired'){await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await page.locator('[data-refresh]').focus();}
   metric('keyboard ownership follows the committed visible state',await page.evaluate(()=>window.probe.listeners.size),['covered','retired'].includes(scenario)?0:1);
   metric('underlying game inertness follows dialog lifetime',await page.locator('main').evaluate(el=>el.inert),scenario!=='retired');
   if(process.env.MODAL_OUTSIDE_NO_KEY!=='1') {
    await page.keyboard.press(direction==='forward'?'Tab':'Shift+Tab');
    if(process.env.MODAL_OUTSIDE_TRACE==='1')await writeFile(path.join(output,[surface,direction,scenario,width,height].join('-')+'-native.json'),JSON.stringify(await page.evaluate(()=>({before:window.probe.claimBefore,atKey:window.probe.focusAtKey,after:{tag:document.activeElement.tagName,className:document.activeElement.className,inert:!!document.activeElement.closest('[inert]')},prevented:window.probe.nativeKeys.at(-1).defaultPrevented})),null,2));
    const admitted=!['claimed-native','covered','retired'].includes(scenario);
    if(scenario==='claimed-native')metric('an earlier native key claim retains its current focus',await page.evaluate(()=>document.activeElement===window.probe.beforeClaim),true);
    else if(admitted)metric('outside native Tab enters the current focus scope at its correct endpoint',await target.evaluate(el=>el===document.activeElement),true);
    else metric('covered or retired surfaces do not reclaim native Tab',await page.evaluate(()=>!document.querySelector('.game-modal')?.contains(document.activeElement)),true);
    metric('only an admitted or earlier-claimed native Tab is prevented',await page.evaluate(()=>window.probe.nativeKeys.at(-1).defaultPrevented),admitted||scenario==='claimed-native');
   }
   await page.evaluate(()=>window.probe.focusAfterKey=document.activeElement);
   await page.evaluate(()=>window.probe.flushFrames());await settle();
   if(['first-open','refocus-outside','nested-confirmation'].includes(scenario)&&process.env.MODAL_OUTSIDE_NO_KEY!=='1')metric('autofocus retains the latest admitted native endpoint',await page.evaluate(()=>document.activeElement===window.probe.focusAfterKey),true);
   if(!['covered','retired'].includes(scenario))metric('focus stays inside the visible modal after frame release',await dialog.evaluate(el=>el.contains(document.activeElement)),true);
   if(process.env.MODAL_OUTSIDE_SMOKE!=='1'&&!['covered','retired'].includes(scenario)) {
    const registration=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);
    await page.evaluate(()=>window.probe.focusBeforeUpdates=document.activeElement);
    for(let i=0;i<32;i++)await page.locator('[data-refresh]').click();await settle();
    metric('32 parent updates preserve the current native focus',await page.evaluate(()=>document.activeElement===window.probe.focusBeforeUpdates),true);
    metric('32 parent updates do not rebuild keyboard ownership',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),registration);
    metric('one current subscription remains after parent updates',await page.evaluate(()=>window.probe.listeners.size),1);
   }
   const activatesClose=direction==='forward'&&['first-open','refocus-outside'].includes(scenario)&&process.env.MODAL_OUTSIDE_NO_KEY!=='1';
   if(activatesClose){await page.keyboard.press('Enter');await settle();}
   metric('native Close activation happens exactly once only when requested',await page.evaluate(()=>window.probe.closes),scenario==='retired'||activatesClose?1:0);
   metric('remaining dialog lifetime matches the requested action',await dialog.count(),scenario==='retired'||activatesClose?0:1);
   metric('navigation never deletes an account',await page.evaluate(()=>window.probe.deletes),0);
   metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);
   metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);
   await page.screenshot({path:path.join(output,[surface,direction,scenario,width,height].join('-')+'.png')});await context.close();
  }
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.MODAL_OUTSIDE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.MODAL_OUTSIDE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Modal contains outside native Tab');
