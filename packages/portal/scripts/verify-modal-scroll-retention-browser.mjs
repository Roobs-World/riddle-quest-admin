import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.MODAL_SCROLL_REACT_MODE??'development',baseline=process.env.MODAL_SCROLL_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.MODAL_SCROLL_REPORT_DIR??path.join(root,'../../artifacts/modal-scroll-retention-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/modal-scroll-retention-'));let server,browser;const observations=[];
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
const noop=()=>{};window.probe={closes:0,updates:[],deletes:0,scrollCalls:[],focus:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));

const nativeScrollTo=HTMLElement.prototype.scrollTo;HTMLElement.prototype.scrollTo=function(...args){if(this.matches('.game-modal,.game-modal-backdrop'))window.probe.scrollCalls.push({className:this.className});return nativeScrollTo.apply(this,args);};
document.addEventListener('focusin',event=>window.probe.focus.push({tag:event.target?.tagName,className:event.target?.className,placeholder:event.target?.getAttribute?.('placeholder')??null}));
function App(){const [state,setState]=React.useState(createInitialGameSession),[blocked,setBlocked]=React.useState(false),[commerce,setCommerce]=React.useState(true),[continuation,setContinuation]=React.useState(false);const open=modal=>setState(s=>({...s,modal}));
 return <><main style={{paddingTop:100}} inert={state.modal!==null||undefined}><button data-profile onClick={()=>open('profile')}>Profile</button><button data-instructions onClick={()=>open('instructions')}>Instructions</button><button data-credits onClick={()=>open('credits')}>Credits</button><button data-settings onClick={()=>open('settings')}>Settings</button></main>
 <nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white',display:'flex',flexWrap:'wrap',maxWidth:'100%'}}><button data-refresh onMouseDown={e=>e.preventDefault()} onClick={()=>setState(s=>({...s,guessPending:!s.guessPending}))}>Deliver game update</button><button data-cover onMouseDown={e=>e.preventDefault()} onClick={()=>setBlocked(true)}>Cover modal</button><button data-uncover onMouseDown={e=>e.preventDefault()} onClick={()=>setBlocked(false)}>Uncover modal</button><button data-switch onMouseDown={e=>e.preventDefault()} onClick={()=>open('instructions')}>Replace modal page</button><button data-rewards onMouseDown={e=>e.preventDefault()} onClick={()=>setState(s=>({...s,lastRewards:{coinsEarned:0,xpEarned:0,newlyUnlockedAchievementIds:[]}}))}>Deliver reward preview</button><button data-pending onMouseDown={e=>e.preventDefault()} onClick={()=>setContinuation(v=>!v)}>Deliver continuation readiness</button><button data-commerce onMouseDown={e=>e.preventDefault()} onClick={()=>setCommerce(false)}>Remove shop capability</button></nav>
 <div data-surface inert={blocked||undefined}><GameModalView state={state} interactionBlocked={blocked} continuationPending={continuation} commerceAvailable={commerce} onClose={()=>{window.probe.closes++;open(null);}} onOpenModal={open} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={name=>window.probe.updates.push(name)} onUpdateAvatar={async()=>{}} onDeleteAccount={()=>window.probe.deletes++} onCoinBalancePreview={noop}/></div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/GameModalView.tsx'))return readFile(path.join(baseline,'modal.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.MODAL_SCROLL_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 const scenarios=process.env.MODAL_SCROLL_SCENARIOS?.split(',')??['profile-guess','profile-rewards','profile-continuation','profile-cover','profile-switch','settings-guess','settings-work','credits-guess','credits-switch','instructions-guess'];
 for(const [width,height] of process.env.MODAL_SCROLL_QUICK==='1'?[[320,400]]:[[320,400],[390,400],[1280,400]])for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),dialog=page.locator('.game-modal');
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url);const kind=scenario.split('-')[0],trigger=page.locator('[data-'+kind+']');await trigger.click();await dialog.waitFor();await settle();
  const selector=kind==='instructions'?'.instructions-page':kind==='profile'?'.profile-page':'.game-modal',scroller=page.locator(selector);
  if(scenario==='profile-cover')await page.keyboard.press('Shift+Tab');
  const dimensions=await scroller.evaluate(el=>({height:el.clientHeight,content:el.scrollHeight}));metric('real content exceeds its scroll viewport',dimensions.content>dimensions.height,true);
  const box=await scroller.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,scenario==='profile-cover'?-180:180);
  await page.waitForFunction(selector=>document.querySelector(selector).scrollTop>30,selector);await settle();
  const before=await scroller.evaluate(el=>el.scrollTop);await dialog.evaluate(el=>{window.modalBefore=el;window.activeBefore=document.activeElement;window.callsBefore=window.probe.scrollCalls.length});metric('native wheel reaches a reading position',before>30,true);
  if(process.env.MODAL_SCROLL_NO_UPDATE!=='1'){
   if(scenario.endsWith('work')){for(let i=0;i<32;i++){await page.locator('[data-refresh]').click();await settle();}}
   else if(scenario.endsWith('rewards'))await page.locator('[data-rewards]').click();
   else if(scenario.endsWith('continuation'))await page.locator('[data-pending]').click();
   else if(scenario.endsWith('cover')){await page.locator('[data-cover]').click();await settle();await page.locator('[data-uncover]').click();}
   else if(scenario.endsWith('switch')){await page.locator('[data-switch]').click();}
   else await page.locator('[data-refresh]').click();
  }
  await settle();await writeFile(path.join(output,[scenario,width,height].join('-')+'-trace.json'),JSON.stringify({before,after:await (scenario.endsWith('switch')?dialog:scroller).evaluate(el=>el.scrollTop),sameFocus:await dialog.evaluate(()=>document.activeElement===window.activeBefore),dimensions,scrollCalls:await page.evaluate(()=>window.probe.scrollCalls.slice(window.callsBefore))},null,2));metric('the same committed shell survives the update',await dialog.evaluate(el=>el===window.modalBefore),true);
  if(scenario.endsWith('switch')&&process.env.MODAL_SCROLL_NO_UPDATE!=='1'){metric('a replacement page begins at the top',await dialog.evaluate(el=>el.scrollTop),0);metric('replacement Instructions starts at its own reading origin',await page.locator('.instructions-page').evaluate(el=>el.scrollTop),0);}
  else metric('the current page retains its native reading position',Math.abs(await scroller.evaluate(el=>el.scrollTop)-before)<1,true);
  if(scenario.endsWith('work'))metric('32 readiness updates perform no explicit scroll reset',await page.evaluate(()=>window.probe.scrollCalls.slice(window.callsBefore).length),0);
  if(process.env.MODAL_SCROLL_SMOKE!=='1'){
   metric('the existing focused control remains selected',await dialog.evaluate(()=>document.activeElement===window.activeBefore),true);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await settle();metric('Escape restores the surviving game trigger',await trigger.evaluate(el=>el===document.activeElement),true);metric('the modal closes once',await page.evaluate(()=>window.probe.closes),1);metric('no account deletion',await page.evaluate(()=>window.probe.deletes),0);
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[scenario,width,height].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.MODAL_SCROLL_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.MODAL_SCROLL_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Modal reading position');
