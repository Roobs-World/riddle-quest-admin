import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),mode=process.env.PROFILE_KEYS_REACT_MODE??'development',baseline=process.env.PROFILE_KEYS_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.PROFILE_KEYS_REPORT_DIR??path.join(root,'builds/test-evidence/profile-confirmation-keyboard-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/profile-confirmation-keyboard-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>nav button{font-size:9px!important;min-height:12px!important;padding:2px!important}</style></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,'src/web/play/GameModalView.tsx'))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,'src/hosted/play/gameSession.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const params=new URL(location.href).searchParams,scenario=params.get('scenario')??'escape-cancelled',noop=()=>{};window.probe={closes:0,updates:[],deletes:0,consumed:[],metadata:[],focus:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.consumeKey=null;
document.addEventListener('keydown',event=>{if(event.key===window.consumeKey){event.preventDefault();window.probe.consumed.push({key:event.key,defaultPrevented:event.defaultPrevented,target:event.target?.className});}},true);
window.metadataKey=()=>{const dialog=document.querySelector('.profile-delete-dialog'),buttons=dialog.querySelectorAll('button'),target=scenario.startsWith('tab')?buttons[1]:buttons[0];target.focus();const event=new KeyboardEvent('keydown',{key:scenario.startsWith('escape')?'Escape':'Tab',shiftKey:scenario.startsWith('reverse'),bubbles:true,cancelable:true,isComposing:scenario.endsWith('composing'),keyCode:scenario.endsWith('legacy')?229:0});target.dispatchEvent(event);window.probe.metadata.push({key:event.key,shiftKey:event.shiftKey,isComposing:event.isComposing,keyCode:event.keyCode,defaultPrevented:event.defaultPrevented});};
document.addEventListener('focusin',event=>window.probe.focus.push({tag:event.target?.tagName,className:event.target?.className,placeholder:event.target?.getAttribute?.('placeholder')??null}));
function App(){const [state,setState]=React.useState(()=>({...createInitialGameSession(),user:{userId:'fixture',platformRegistered:true}})),[blocked,setBlocked]=React.useState(false),[commerce,setCommerce]=React.useState(true);const open=modal=>setState(s=>({...s,modal}));
 return <><main style={{paddingTop:100}} inert={state.modal!==null||undefined}><button data-profile onClick={()=>open('profile')}>Profile</button><button data-continue onClick={()=>open('continue')}>Continue fixture</button></main>
 <nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white',display:'flex',flexWrap:'wrap',maxWidth:'100%'}}><button data-arm onMouseDown={e=>e.preventDefault()} onClick={()=>window.consumeKey=scenario.startsWith('escape')?'Escape':'Tab'}>Claim native key</button><button data-release onMouseDown={e=>e.preventDefault()} onClick={()=>window.consumeKey=null}>Release native key</button><button data-metadata onMouseDown={e=>e.preventDefault()} onClick={()=>window.metadataKey()}>Send IME-marked key</button><button data-refresh onMouseDown={e=>e.preventDefault()} onClick={()=>setState(s=>({...s,guessPending:!s.guessPending}))}>Deliver game update</button><button data-cover onMouseDown={e=>e.preventDefault()} onClick={()=>setBlocked(true)}>Cover modal</button><button data-uncover onMouseDown={e=>e.preventDefault()} onClick={()=>setBlocked(false)}>Uncover modal</button><button data-switch onMouseDown={e=>e.preventDefault()} onClick={()=>open('instructions')}>Replace modal page</button><button data-commerce onMouseDown={e=>e.preventDefault()} onClick={()=>setCommerce(false)}>Remove shop capability</button></nav>
 <div data-surface inert={blocked||undefined}><GameModalView state={state} interactionBlocked={blocked} commerceAvailable={commerce} onClose={()=>{window.probe.closes++;open(null);}} onOpenModal={open} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={name=>window.probe.updates.push(name)} onUpdateAvatar={async()=>{}} onDeleteAccount={()=>window.probe.deletes++} onCoinBalancePreview={noop}/></div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/web/play/modalPages/commerce/ShopModalPage.tsx')}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/ProfileModalPage.tsx'))return readFile(path.join(baseline,'profile.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PROFILE_KEYS_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 const scenarios=process.env.PROFILE_KEYS_SCENARIOS?.split(',')??['escape-cancelled','tab-cancelled','reverse-cancelled','escape-composing','tab-composing','reverse-composing','escape-legacy','tab-legacy','reverse-legacy'];
 for(const [width,height] of process.env.PROFILE_KEYS_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),dialog=page.locator('.game-modal'),confirmation=page.locator('.profile-delete-dialog'),trigger=page.locator('[data-profile]');const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))),metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await trigger.click();await dialog.waitFor();await settle();
  const deleteTrigger=dialog.locator('.profile-danger-zone button');await deleteTrigger.click();await confirmation.waitFor();await settle();
  const target=scenario.startsWith('tab')?confirmation.locator('button').last():confirmation.locator('button').first();await target.focus();await target.evaluate(el=>window.focusBefore=el);
  if(scenario.endsWith('cancelled')){
   if(process.env.PROFILE_KEYS_ARM!=='0')await page.locator('[data-arm]').click();await page.keyboard.press(scenario.startsWith('escape')?'Escape':scenario.startsWith('reverse')?'Shift+Tab':'Tab');
   if(process.env.PROFILE_KEYS_ARM!=='0')metric('earlier owner cancels the real native key',await page.evaluate(()=>window.probe.consumed.map(x=>({key:x.key,defaultPrevented:x.defaultPrevented}))),[{key:scenario.startsWith('escape')?'Escape':'Tab',defaultPrevented:true}]);
  }else await page.locator('[data-metadata]').click();
  await settle();const admitted=process.env.PROFILE_KEYS_ARM==='0'&&scenario.startsWith('escape');metric('claimed or IME-marked key leaves confirmation open',await confirmation.count(),admitted?0:1);metric('the outer Profile page stays open',await dialog.count(),1);metric('ignored key preserves the selected confirmation control',await page.evaluate(()=>document.activeElement===window.focusBefore),!admitted);
  if(!scenario.endsWith('cancelled'))metric('IME-marked event stays uncancelled for its owner',await page.evaluate(()=>window.probe.metadata.at(-1).defaultPrevented),false);
  if(process.env.PROFILE_KEYS_SMOKE!=='1'){
   await page.locator('[data-release]').click();
   if(await confirmation.count()===0){await deleteTrigger.click();await confirmation.waitFor();await settle();}
   await confirmation.locator('button').last().focus();await page.keyboard.press('Tab');metric('fresh forward Tab wraps inside confirmation',await confirmation.locator('button').first().evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Shift+Tab');metric('fresh reverse Tab wraps inside confirmation',await confirmation.locator('button').last().evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Escape');await confirmation.waitFor({state:'detached'});await settle();metric('fresh Escape closes only the nested confirmation',await dialog.count(),1);metric('nested dismissal restores its Delete trigger',await deleteTrigger.evaluate(el=>el===document.activeElement),true);metric('nested Escape never calls outer Close',await page.evaluate(()=>window.probe.closes),0);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await settle();metric('outer Escape closes once',await page.evaluate(()=>window.probe.closes),1);metric('outer dismissal restores the game trigger',await trigger.evaluate(el=>el===document.activeElement),true);
  }
  metric('keyboard navigation never deletes an account',await page.evaluate(()=>window.probe.deletes),0);metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[scenario,width,height].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.PROFILE_KEYS_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.PROFILE_KEYS_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Profile confirmation keyboard admission');
