import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),mode=process.env.MODAL_BOUNDARY_REACT_MODE??'development',baseline=process.env.MODAL_BOUNDARY_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.MODAL_BOUNDARY_REPORT_DIR??path.join(root,'builds/test-evidence/modal-keyboard-boundary-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/modal-keyboard-boundary-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,"src/app/modals/components/GameModalView.tsx"))};
import {GameSurfaceRecovery} from ${JSON.stringify(path.join(root,"src/app/components/recovery/GameSurfaceRecovery.tsx"))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,"src/gameplay/session/gameSession.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const params=new URL(location.href).searchParams,surface=params.get('surface')??'modal',scenario=params.get('scenario')??'pending-commit',noPending=params.has('noPending'),noEmit=params.has('noEmit'),noop=()=>{};
window.probe={closes:[],boundaries:[],listeners:new Set(),adds:0,removes:0,errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
document.addEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.adds++;window.probe.listeners.add(handler);}return add(type,handler,...rest);};document.removeEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.removes++;window.probe.listeners.delete(handler);}return remove(type,handler,...rest);};
function App(){const [stage,setStage]=React.useState(0),[epoch,setEpoch]=React.useState(0),boundary=React.useRef(false);
 const initialOnly=['first-open','first-tab'].includes(scenario),retired=scenario==='retire-commit'&&stage===1;
 const modal=(initialOnly&&stage===0)||retired?null:scenario==='victory-commit'?stage===0?'settings':'victory':scenario==='victory-unlock'?stage===0?'victory':'settings':scenario==='continue-page-commit'?stage===0?'settings':'continue':scenario.startsWith('pending')||scenario.startsWith('continuation')||scenario==='stable-locks'?'continue':'settings';
 const guessPending=noPending?false:scenario==='pending-commit'||scenario==='continue-page-commit'?stage===1:scenario==='pending-unlock'?stage===0:scenario==='stable-locks'?epoch%2===1:false,continuationPending=scenario==='continuation-commit'?stage===1:scenario==='continuation-unlock'?stage===0:false,blocked=scenario==='block-commit'?stage===1:scenario==='block-unlock'?stage===0:false;
 const state={...createInitialGameSession(),modal,guessPending};
 React.useLayoutEffect(()=>{if(stage!==1||boundary.current)return;boundary.current=true;const emit=()=>{const panel=document.querySelector('.game-modal,.surface-recovery'),controls=panel?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])');if(scenario==='first-tab')controls?.[controls.length-1]?.focus();const event=new KeyboardEvent('keydown',{key:scenario==='first-tab'?'Tab':'Escape',bubbles:true,cancelable:true});if(!noEmit)document.dispatchEvent(event);window.probe.boundaries.push({modal:panel?.className??null,prevented:event.defaultPrevented,listeners:window.probe.listeners.size,firstFocused:controls?.[0]===document.activeElement,closeVisible:surface==='modal'?!!panel?.querySelector('.modal-x'):!!panel?.querySelector('button:last-child:not(:disabled)'),closes:window.probe.closes.length});};if(params.has('late'))requestAnimationFrame(()=>requestAnimationFrame(emit));else emit();},[stage]);
 return <><nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white',display:'flex',flexWrap:'wrap',maxWidth:'100%'}}><button data-commit onClick={()=>setStage(1)}>Commit modal state</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></nav>
 <main inert={blocked||undefined} data-stage={stage} data-epoch={epoch}>
 {modal!==null?(surface==='recovery'?<GameSurfaceRecovery onClose={()=>window.probe.closes.push({stage,modal,guessPending,continuationPending})} closeBlocked={modal==='victory'||modal==='continue'&&(guessPending||continuationPending)} onNext={noop}/>:<GameModalView state={state} interactionBlocked={blocked} continuationPending={continuationPending} onClose={()=>window.probe.closes.push({stage,modal,guessPending,continuationPending})} onOpenModal={noop} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop} onCoinBalancePreview={noop}/>):<p data-retired>Modal absent</p>}
 </main></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,"src/commerce/components/ShopModalPage.tsx")}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/GameModalView.tsx'))return readFile(path.join(baseline,'modal.before.txt'),'utf8');if(baseline&&id.endsWith('/GameSurfaceRecovery.tsx'))return readFile(path.join(baseline,'recovery.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.MODAL_BOUNDARY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.MODAL_BOUNDARY_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const surface of process.env.MODAL_BOUNDARY_SURFACES?.split(',')??['modal','recovery'])for(const scenario of process.env.MODAL_BOUNDARY_SCENARIOS?.split(',')??['pending-commit','continuation-commit','continue-page-commit','victory-commit','pending-unlock','continuation-unlock','victory-unlock','first-open','first-tab','block-commit','block-unlock','retire-commit','stable-locks']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),dialog=page.locator(surface==='recovery'?'.surface-recovery':'.game-modal');const metric=(name,actual,expected)=>observations.push({width,height,surface,scenario,name,actual,expected});await page.goto(url+'/?surface='+surface+'&scenario='+scenario+(process.env.MODAL_BOUNDARY_NO_PENDING==='1'?'&noPending=1':'')+(process.env.MODAL_BOUNDARY_NO_EMIT==='1'?'&noEmit=1':'')+(process.env.MODAL_BOUNDARY_LATE_EVENT==='1'?'&late=1':''));await page.locator('[data-commit]').waitFor();
  if(!['first-open','first-tab'].includes(scenario))await dialog.waitFor();
  // Settle initial passive registration before the state-change boundary under test.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.locator('[data-commit]').click();await page.waitForFunction(()=>window.probe.boundaries.length===1);
  const active=!['block-commit','retire-commit'].includes(scenario),unlocked=['pending-unlock','continuation-unlock','victory-unlock','first-open','first-tab','block-unlock','stable-locks'].includes(scenario),boundaryCloses=process.env.MODAL_BOUNDARY_NO_EMIT==='1'?0:(unlocked||process.env.MODAL_BOUNDARY_NO_PENDING==='1')&&scenario!=='first-tab'?1:0;
  metric('parent layout key obeys committed dismissal readiness',await page.evaluate(()=>window.probe.closes.length),boundaryCloses);
  metric('active modal owns its first committed key',await page.evaluate(()=>window.probe.boundaries[0].prevented),active&&process.env.MODAL_BOUNDARY_NO_EMIT!=='1');
  metric('native listener is ready or retired at the parent boundary',await page.evaluate(()=>window.probe.boundaries[0].listeners),scenario==='retire-commit'?0:surface==='recovery'?1:active?1:0);
  if(scenario==='first-tab')metric('first committed Tab wraps to the active first control',await page.evaluate(()=>window.probe.boundaries[0].firstFocused),true);
  if(process.env.MODAL_BOUNDARY_SMOKE!=='1'){
   const before=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);for(let i=0;i<32;i++)await page.locator('[data-parent]').click();
   metric('parent renders and lock updates preserve native listener registration',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),before);
   // Ordinary post-update navigation starts after the retained focus frame; the layout-boundary probes above remain immediate.
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.keyboard.press('Escape');metric('fresh native Escape follows the same committed modal policy',await page.evaluate(()=>window.probe.closes.length),boundaryCloses+(unlocked?1:0));
   if(unlocked){const controls=dialog.locator('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])');await controls.last().focus();await page.keyboard.press('Tab');metric('normal Tab still wraps to the active first control',await controls.first().evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Shift+Tab');metric('normal reverse Tab still wraps to the active last control',await controls.last().evaluate(el=>el===document.activeElement),true);}
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[surface,scenario,width,height].join('-')+'.png')});await context.close();
 }
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.MODAL_BOUNDARY_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.MODAL_BOUNDARY_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Committed modal keyboard boundary');
