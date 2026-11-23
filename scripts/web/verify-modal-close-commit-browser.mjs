import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),mode=process.env.MODAL_CLOSE_REACT_MODE??'development',baseline=process.env.MODAL_CLOSE_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.MODAL_CLOSE_REPORT_DIR??path.join(root,'builds/test-evidence/modal-close-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/modal-close-commit-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>[data-fixture-controls]>button{pointer-events:auto}</style></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,'src/web/play/GameModalView.tsx'))};
import {GameSurfaceRecovery} from ${JSON.stringify(path.join(root,'src/web/play/GameSurfaceRecovery.tsx'))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,'src/hosted/play/gameSession.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URL(location.href).searchParams.get('scenario')??'callback',surface=new URL(location.href).searchParams.get('surface')??'recovery',noop=()=>{};
window.probe={closes:[],suspended:0,adds:0,removes:0,errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
document.addEventListener=(type,...args)=>{if(type==='keydown')window.probe.adds++;return add(type,...args);};document.removeEventListener=(type,...args)=>{if(type==='keydown')window.probe.removes++;return remove(type,...args);};
let unblock,pending=new Promise(resolve=>unblock=resolve);window.allow=false;function Pending(){window.probe.suspended++;if(!window.allow)throw pending;return null;}
function App(){const [visit,setVisit]=React.useState(0),[mounted,setMounted]=React.useState(false),[epoch,setEpoch]=React.useState(0);const owner=visit===1?'Bob':'Alice',blocked=scenario==='unlock'?visit===0:scenario==='lock'?visit===1:false;
 const close=()=>window.probe.closes.push(owner),state={...createInitialGameSession(),modal:scenario==='callback'?'settings':'continue',guessPending:blocked};
 return <><nav data-fixture-controls style={{position:'fixed',zIndex:10000,top:0,left:0,background:'transparent',pointerEvents:'none',display:'flex',flexWrap:'wrap',maxWidth:'100%'}}>
 <button data-open onClick={()=>setMounted(true)}>Open dialog</button><button data-prepare onClick={()=>{window.allow=false;pending=new Promise(resolve=>unblock=resolve);React.startTransition(()=>setVisit(1));}}>Prepare replacement</button><button data-commit onClick={()=>{window.allow=true;unblock();}}>Commit replacement</button><button data-abandon onClick={()=>{setVisit(0);window.allow=true;unblock();}}>Abandon replacement</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button><button data-retire onClick={()=>setMounted(false)}>Retire dialog</button></nav>
 <React.Suspense fallback={<p data-loading>Preparing fixture</p>}><main data-owner={owner} data-visit={visit} data-epoch={epoch}>
 {mounted?(surface==='recovery'?<GameSurfaceRecovery onClose={close} closeBlocked={blocked} onNext={noop}/>:<GameModalView state={state} onClose={close} onOpenModal={noop} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop} onCoinBalancePreview={noop}/>):<p data-retired>Dialog removed</p>}{visit===1?<Pending/>:null}
 </main></React.Suspense></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/web/play/modalPages/commerce/ShopModalPage.tsx')}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/GameModalView.tsx'))return readFile(path.join(baseline,'modal.before.txt'),'utf8');if(baseline&&id.endsWith('/GameSurfaceRecovery.tsx'))return readFile(path.join(baseline,'recovery.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.MODAL_CLOSE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.MODAL_CLOSE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const surface of process.env.MODAL_CLOSE_SURFACES?.split(',')??['recovery','modal'])for(const scenario of process.env.MODAL_CLOSE_SCENARIOS?.split(',')??['callback','unlock','lock']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),dialog=page.locator(surface==='recovery'?'.surface-recovery':'.game-modal');const metric=(name,actual,expected)=>observations.push({width,height,surface,scenario,name,actual,expected});await page.goto(url+'/?surface='+surface+'&scenario='+scenario);await page.locator('[data-open]').click();await dialog.waitFor();await page.waitForFunction(()=>document.querySelector('[role=dialog],[role=alertdialog]')?.contains(document.activeElement));
  await page.evaluate(()=>{window.visibleDialog=document.querySelector('[role=dialog],[role=alertdialog]');});
  if(process.env.MODAL_CLOSE_PREPARE!=='0'){await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.suspended>0);}metric('prepared replacement leaves Alice visible',await page.locator('[data-owner]').getAttribute('data-owner'),'Alice');
  if(process.env.MODAL_CLOSE_NATIVE_CLOSE==='1')await dialog.getByRole('button',{name:'Close',exact:true}).click();else await page.keyboard.press('Escape');metric('Escape uses only the visible callback and pending lock',await page.evaluate(()=>window.probe.closes),scenario==='unlock'?[]:['Alice']);
  if(process.env.MODAL_CLOSE_SMOKE!=='1'){
   const listeners=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);
   await page.locator('[data-abandon]').click();await page.locator('[data-parent]').click();await page.keyboard.press('Escape');metric('abandoned replacement cannot redirect a later Escape',await page.evaluate(()=>window.probe.closes),scenario==='unlock'?[]:['Alice','Alice']);metric('abandoning replacement preserves the existing dialog',await page.evaluate(()=>window.visibleDialog===document.querySelector('[role=dialog],[role=alertdialog]')),true);
   await page.locator('[data-prepare]').click();await page.locator('[data-commit]').click();await page.waitForFunction(()=>document.querySelector('[data-owner]')?.dataset.owner==='Bob');await page.keyboard.press('Escape');metric('committed replacement owns subsequent Escape',await page.evaluate(()=>window.probe.closes),scenario==='lock'?['Alice','Alice']:scenario==='unlock'?['Bob']:['Alice','Alice','Bob']);
   const before=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);for(let i=0;i<32;i++)await page.locator('[data-parent]').click();metric('ordinary parent renders do not rebuild the keyboard listener',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),before);
   if(scenario==='callback'){metric('callback changes do not rebuild the keyboard listener',before,listeners);const close=dialog.getByRole('button',{name:'Close',exact:true});await close.click();metric('native Close agrees with committed Escape owner',await page.evaluate(()=>window.probe.closes),['Alice','Alice','Bob','Bob']);}
   if(surface==='recovery'){const close=dialog.getByRole('button',{name:'Close',exact:true});metric('committed pending lock matches the visible Close control',await close.isDisabled(),scenario==='lock');await dialog.locator('button:not(:disabled)').last().focus();await page.keyboard.press('Tab');metric('Tab wraps to the first available dialog action',await dialog.locator('button:not(:disabled)').first().evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Shift+Tab');metric('reverse Tab wraps to the last available dialog action',await dialog.locator('button:not(:disabled)').last().evaluate(el=>el===document.activeElement),true);await page.evaluate(()=>document.querySelector('.surface-recovery-backdrop').inert=true);const old=await page.evaluate(()=>window.probe.closes.length);await page.keyboard.press('Escape');metric('inert recovery cannot dismiss beneath another overlay',await page.evaluate(()=>window.probe.closes.length),old);await page.evaluate(()=>document.querySelector('.surface-recovery-backdrop').inert=false);}
   await page.locator('[data-retire]').click();await dialog.waitFor({state:'detached'});metric('dismissal restores the connected original trigger',await page.locator('[data-open]').evaluate(el=>el===document.activeElement),true);const old=await page.evaluate(()=>window.probe.closes.length);await page.keyboard.press('Escape');metric('retired dialog cannot consume another Escape',await page.evaluate(()=>window.probe.closes.length),old);
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[surface,scenario,width,height].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.MODAL_CLOSE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.MODAL_CLOSE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Visible solo dialog close ownership');
