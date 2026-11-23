import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.MODAL_EDITOR_REACT_MODE??'development',baseline=process.env.MODAL_EDITOR_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.MODAL_EDITOR_REPORT_DIR??path.join(root,'../../builds/test-evidence/modal-editor-focus-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/modal-editor-focus-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,'src/play/GameModalView.tsx'))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,'../hosted/src/play/gameSession.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const holdFocus=new URL(location.href).searchParams.has('holdFocus'),noop=()=>{};window.probe={closes:0,updates:[],deletes:0,focus:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const nativeRaf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>holdFocus&&String(callback).includes('getModalFocusable')?-1:nativeRaf(callback);
document.addEventListener('focusin',event=>window.probe.focus.push({tag:event.target?.tagName,className:event.target?.className,placeholder:event.target?.getAttribute?.('placeholder')??null}));
function App(){const [state,setState]=React.useState(createInitialGameSession),[blocked,setBlocked]=React.useState(false),[commerce,setCommerce]=React.useState(true);const open=modal=>setState(s=>({...s,modal}));
 return <><main style={{paddingTop:100}} inert={state.modal!==null||undefined}><button data-profile onClick={()=>open('profile')}>Profile</button><button data-continue onClick={()=>open('continue')}>Continue fixture</button></main>
 <nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white',display:'flex',flexWrap:'wrap',maxWidth:'100%'}}><button data-refresh onMouseDown={e=>e.preventDefault()} onClick={()=>setState(s=>({...s,guessPending:!s.guessPending}))}>Deliver game update</button><button data-cover onMouseDown={e=>e.preventDefault()} onClick={()=>setBlocked(true)}>Cover modal</button><button data-uncover onMouseDown={e=>e.preventDefault()} onClick={()=>setBlocked(false)}>Uncover modal</button><button data-switch onMouseDown={e=>e.preventDefault()} onClick={()=>open('instructions')}>Replace modal page</button><button data-commerce onMouseDown={e=>e.preventDefault()} onClick={()=>setCommerce(false)}>Remove shop capability</button></nav>
 <div data-surface inert={blocked||undefined}><GameModalView state={state} interactionBlocked={blocked} commerceAvailable={commerce} onClose={()=>{window.probe.closes++;open(null);}} onOpenModal={open} onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={name=>window.probe.updates.push(name)} onUpdateAvatar={async()=>{}} onDeleteAccount={()=>window.probe.deletes++} onCoinBalancePreview={noop}/></div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/GameModalView.tsx'))return readFile(path.join(baseline,'modal.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.MODAL_EDITOR_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.MODAL_EDITOR_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.MODAL_EDITOR_SCENARIOS?.split(',')??['open','refresh-input','refresh-save','blocked-editor','switch-page','lost-control','confirmation']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),dialog=page.locator('.game-modal'),input=page.locator('.username-form input'),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});await page.goto(url+(process.env.MODAL_EDITOR_HOLD_FOCUS==='1'?'?holdFocus=1':''));const trigger=page.locator(scenario==='lost-control'?'[data-continue]':'[data-profile]');await trigger.click();await dialog.waitFor();await settle();
  if(scenario==='lost-control'){
   await page.keyboard.press('Tab');metric('ready loss prompt focuses its Shop control',await dialog.getByRole('button',{name:'Open Shop',exact:true}).evaluate(el=>el===document.activeElement),true);await page.locator('[data-commerce]').click();await page.locator('[data-refresh]').click();await settle();await page.locator('[data-refresh]').click();await settle();metric('removed control falls back when dismissal readiness returns',await dialog.locator('.modal-x').evaluate(el=>el===document.activeElement),true);
  }else if(scenario==='confirmation'){
   await dialog.getByRole('button',{name:'Delete Account',exact:true}).click();await page.getByRole('alertdialog').waitFor();await settle();await page.keyboard.press('Shift+Tab');const selected=page.getByRole('alertdialog').getByRole('button',{name:'Delete Account',exact:true});metric('nested confirmation has an explicit selected control',await selected.evaluate(el=>el===document.activeElement),true);await page.locator('[data-refresh]').click();await settle();metric('game update preserves the selected nested confirmation control',await selected.evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');await page.getByRole('alertdialog').waitFor({state:'detached'});await settle();metric('nested Escape preserves the profile page',await dialog.count(),1);metric('nested dismissal returns to its Delete trigger',await dialog.getByRole('button',{name:'Delete Account',exact:true}).evaluate(el=>el===document.activeElement),true);
  }else{
   await dialog.getByRole('button',{name:'Edit',exact:true}).click();await input.waitFor();await settle();
   if(scenario==='open'){metric('username editor remains focused after its deferred frame',await input.evaluate(el=>el===document.activeElement),true);await page.keyboard.type('Rival');}
   else {await input.click();await page.keyboard.type('Rival');}
   if(scenario==='refresh-input'||scenario==='blocked-editor'){await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');}
   if(['refresh-input','refresh-save','blocked-editor'].includes(scenario))await input.evaluate(el=>window.editorBefore=el);
   if(scenario==='refresh-input'){await page.locator('[data-refresh]').click();await settle();metric('game update preserves input focus and its caret',await input.evaluate(el=>({focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd})),{focused:true,start:3,end:3});}
   if(scenario==='refresh-save'){await page.keyboard.press('Tab');metric('player focuses enabled Save before update',await dialog.getByRole('button',{name:'Save',exact:true}).evaluate(el=>el===document.activeElement),true);await page.locator('[data-refresh]').click();await settle();metric('game update preserves the selected enabled Save control',await dialog.getByRole('button',{name:'Save',exact:true}).evaluate(el=>el===document.activeElement),true);}
   if(scenario==='blocked-editor'){await page.locator('[data-cover]').click();await settle();metric('covered editor yields focus outside the inert surface',await dialog.evaluate(el=>el.contains(document.activeElement)),false);await page.locator('[data-uncover]').click();await settle();metric('uncovering restores the previous editable input and caret',await input.evaluate(el=>({focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd})),{focused:true,start:3,end:3});}
   if(['refresh-input','refresh-save','blocked-editor'].includes(scenario))metric('update retains the same native editor node',await input.evaluate(el=>el===window.editorBefore),true);
   const expectedDraft=scenario==='refresh-input'||scenario==='blocked-editor'?'Rivxal':'Rival';
   if(expectedDraft==='Rivxal')await page.keyboard.type('x');
   if(scenario==='switch-page'){await page.locator('[data-switch]').click();await settle();metric('replacement page retires the username editor',await input.count(),0);metric('replacement page focuses its own Close control',await dialog.locator('.modal-x').evaluate(el=>el===document.activeElement),true);}
   else{
    metric('native typing retains the entire username draft',await input.inputValue(),expectedDraft);
    if(process.env.MODAL_EDITOR_SMOKE!=='1'){
     const intended=await (scenario==='refresh-save'?dialog.getByRole('button',{name:'Save',exact:true}):input).evaluate(el=>el===document.activeElement);
     if(intended)await page.keyboard.press(scenario==='refresh-save'?'Space':'Enter');
     metric('fresh native activation submits the username once',await page.evaluate(()=>window.probe.updates),[expectedDraft]);if(intended)metric('successful submission clears only the editable draft',await input.inputValue(),'');
    }
   }
  }
  if(process.env.MODAL_EDITOR_SMOKE!=='1'){
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});await settle();metric('outer dismissal restores the surviving gameplay trigger',await trigger.evaluate(el=>el===document.activeElement),true);metric('outer dismissal occurs once',await page.evaluate(()=>window.probe.closes),1);metric('focus changes never delete an account',await page.evaluate(()=>window.probe.deletes),0);
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[scenario,width,height].join('-')+'.png')});await context.close();
 }
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.MODAL_EDITOR_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.MODAL_EDITOR_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Modal editor focus ownership');
