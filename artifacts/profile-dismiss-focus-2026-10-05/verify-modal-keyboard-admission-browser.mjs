import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.MODAL_KEYS_REACT_MODE??'development',baseline=process.env.MODAL_KEYS_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.MODAL_KEYS_REPORT_DIR??path.join(root,'../../artifacts/modal-keyboard-admission-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/modal-keyboard-admission-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,'src/play/GameModalView.tsx'))};
import {GameSurfaceRecovery} from ${JSON.stringify(path.join(root,'src/play/GameSurfaceRecovery.tsx'))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,'src/play/gameSession.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const params=new URL(location.href).searchParams,surface=params.get('surface')??'modal',scenario=params.get('scenario')??'escape-cancelled',noop=()=>{};
window.probe={closes:0,updates:[],consumed:[],metadata:[],errors:[],unhandled:[]};window.consumeKey=null;
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
document.addEventListener('keydown',event=>{if(window.consumeKey===event.key){event.preventDefault();window.probe.consumed.push({key:event.key,defaultPrevented:event.defaultPrevented,target:event.target?.tagName});}},true);
window.metadataKey=()=>{const dialog=document.querySelector('.game-modal,.surface-recovery'),controls=dialog?.querySelectorAll('button:not(:disabled),input:not(:disabled)'),target=scenario.startsWith('tab')?controls?.[controls.length-1]:dialog?.querySelector('input')??dialog?.querySelector('button:last-child');target?.focus();const event=new KeyboardEvent('keydown',{key:scenario.startsWith('tab')?'Tab':'Escape',bubbles:true,cancelable:true,isComposing:scenario.endsWith('composing'),keyCode:scenario.endsWith('legacy')?229:0});target.dispatchEvent(event);window.probe.metadata.push({key:event.key,isComposing:event.isComposing,keyCode:event.keyCode,defaultPrevented:event.defaultPrevented});};
function App(){const [mounted,setMounted]=React.useState(false),[opened,setOpened]=React.useState(false),[inert,setInert]=React.useState(false);const state={...createInitialGameSession(),modal:'username'};
 React.useLayoutEffect(()=>{if(opened&&!mounted&&scenario==='retired-layout'){const event=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});document.dispatchEvent(event);window.probe.metadata.push({key:event.key,defaultPrevented:event.defaultPrevented,retired:true});}},[opened,mounted]);
 return <><nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white',display:'flex',flexWrap:'wrap',maxWidth:'100%'}}>
 <button data-open onClick={()=>{setOpened(true);setMounted(true);}}>Open dialog</button><button data-arm onClick={()=>window.consumeKey=scenario.startsWith('tab')?'Tab':'Escape'}>Let child handle key</button><button data-clear onClick={()=>window.consumeKey=null}>Release child key</button><button data-metadata onClick={()=>window.metadataKey()}>Send composition key</button><button data-inert onClick={()=>setInert(true)}>Cover dialog</button><button data-uncover onClick={()=>setInert(false)}>Uncover dialog</button><button data-retire onClick={()=>setMounted(false)}>Retire dialog</button></nav>
 <main inert={inert||undefined} data-covered={inert}>
 {mounted?(surface==='recovery'?<GameSurfaceRecovery onClose={()=>window.probe.closes++} onNext={noop}/>:<GameModalView state={state} onClose={()=>window.probe.closes++} onOpenModal={noop} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={name=>window.probe.updates.push(name)} onUpdateAvatar={async()=>{}} onDeleteAccount={noop} onCoinBalancePreview={noop}/>):<p data-retired>Dialog removed</p>}
 </main></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},plugins:[{name:'captured-modal-keyboard-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/GameModalView.tsx'))return readFile(path.join(baseline,'modal.before.txt'),'utf8');if(baseline&&id.endsWith('/GameSurfaceRecovery.tsx'))return readFile(path.join(baseline,'recovery.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.MODAL_KEYS_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.MODAL_KEYS_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const surface of process.env.MODAL_KEYS_SURFACES?.split(',')??['modal','recovery'])for(const scenario of process.env.MODAL_KEYS_SCENARIOS?.split(',')??['escape-cancelled','tab-cancelled','escape-composing','escape-legacy','tab-composing','tab-legacy','inert','retired-layout']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),dialog=page.locator(surface==='recovery'?'.surface-recovery':'.game-modal');const metric=(name,actual,expected)=>observations.push({width,height,surface,scenario,name,actual,expected});await page.goto(url+'/?surface='+surface+'&scenario='+scenario);await page.locator('[data-open]').click();await dialog.waitFor();await page.waitForFunction(()=>document.querySelector('[role=dialog],[role=alertdialog]')?.contains(document.activeElement));
  if(surface==='modal'&&process.env.MODAL_KEYS_SMOKE!=='1')await dialog.locator('input').fill('Rival');
  if(scenario==='retired-layout'){await page.locator('[data-retire]').click();await dialog.waitFor({state:'detached'});metric('removed dialog cannot consume a parent layout Escape',await page.evaluate(()=>window.probe.closes),0);metric('removed dialog cannot prevent a later owner key',await page.evaluate(()=>window.probe.metadata.at(-1).defaultPrevented),false);}
  else if(scenario==='inert'){await page.locator('[data-inert]').click();await page.keyboard.press('Escape');metric('inert dialog cannot dismiss beneath another surface',await page.evaluate(()=>window.probe.closes),0);await page.locator('[data-uncover]').click();}
  else{
   if(scenario.endsWith('cancelled')&&process.env.MODAL_KEYS_ARM!=='0')await page.locator('[data-arm]').click();
   const target=scenario.startsWith('tab')?dialog.locator('button:not(:disabled),input:not(:disabled)').last():surface==='modal'?dialog.locator('input'):dialog.getByRole('button',{name:'Close',exact:true});await target.focus();
   if(scenario.endsWith('cancelled')){await page.keyboard.press(scenario.startsWith('tab')?'Tab':'Escape');if(process.env.MODAL_KEYS_ARM!=='0')metric('child consumes the real native key',await page.evaluate(()=>window.probe.consumed.map(x=>({key:x.key,defaultPrevented:x.defaultPrevented}))),[{key:scenario.startsWith('tab')?'Tab':'Escape',defaultPrevented:true}]);}
   else await page.evaluate(()=>window.metadataKey());
   const admitted=process.env.MODAL_KEYS_ARM==='0'&&scenario==='escape-cancelled';
   metric('owned or composing key cannot dismiss the dialog',await page.evaluate(()=>window.probe.closes),admitted?1:0);
   if(scenario.startsWith('tab'))metric('owned or composing Tab preserves native focus',await target.evaluate(el=>el===document.activeElement),true);
   if(!scenario.endsWith('cancelled'))metric('composing event stays uncancelled for its owner',await page.evaluate(()=>window.probe.metadata.at(-1).defaultPrevented),false);
   await page.locator('[data-clear]').click();
  }
  if(process.env.MODAL_KEYS_SMOKE!=='1'&&scenario!=='retired-layout'){
   if(surface==='modal'){metric('ignored keys preserve the username draft',await dialog.locator('input').inputValue(),'Rival');await dialog.locator('input').focus();await page.keyboard.press('Enter');metric('fresh native form submission updates the username once',await page.evaluate(()=>window.probe.updates),['Rival']);}
   const before=await page.evaluate(()=>window.probe.closes);await page.keyboard.press('Escape');metric('fresh unclaimed Escape still dismisses once',await page.evaluate(()=>window.probe.closes),before+1);
   const controls=dialog.locator('button:not(:disabled),input:not(:disabled)');await controls.last().focus();await page.keyboard.press('Tab');metric('fresh Tab still traps focus at the first control',await controls.first().evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Shift+Tab');metric('fresh reverse Tab still traps focus at the last control',await controls.last().evaluate(el=>el===document.activeElement),true);
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[surface,scenario,width,height].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.MODAL_KEYS_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.MODAL_KEYS_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Dialog keyboard admission');
