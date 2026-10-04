import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.PLAYABLE_FOCUS_REACT_MODE??'development';
const output=path.resolve(process.env.PLAYABLE_FOCUS_REPORT_DIR??path.join(root,'../../artifacts/playable-action-focus-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/playable-action-focus-'));
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {YouTubePlayableApp} from ${JSON.stringify(path.join(root,'src/playable/YouTubePlayableApp.tsx'))};
import ${JSON.stringify(path.join(root,'src/playable/styles.css'))};
window.probe={saves:[],loads:0,errors:[],unhandled:[],focus:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
document.addEventListener('focusin',e=>window.probe.focus.push({tag:e.target.tagName,text:e.target.textContent,className:e.target.className}));
const sdk={inPlayablesEnvironment:true,firstFrameReady(){},gameReady(){},async loadData(){window.probe.loads++;return '';},async saveData(data){if(!window.probe.loads)throw Error('Save before load');window.probe.saves.push(data);if(window.holdSaveOnce){window.holdSaveOnce=false;await new Promise((resolve,reject)=>{window.releaseSave=resolve;window.rejectSave=()=>reject(Error('Injected save failure'));});}},async getLanguage(){return 'en';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(fn){window.pauseGame=fn;return ()=>{delete window.pauseGame;};},onResume(fn){window.resumeGame=fn;return ()=>{delete window.resumeGame;};},logError(){},logWarning(){}};
createRoot(document.querySelector('#root')).render(<React.StrictMode><YouTubePlayableApp sdk={sdk}/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',resolve:{alias:{'#youtube-content':path.join(root,'../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json')}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'playable-focus-baseline',async load(id){if(process.env.PLAYABLE_FOCUS_BASELINE_DIR&&id.endsWith('/YouTubePlayableApp.tsx'))return readFile(path.join(process.env.PLAYABLE_FOCUS_BASELINE_DIR,'app.before.txt'),'utf8');if(process.env.PLAYABLE_FOCUS_BASELINE_DIR&&id.endsWith('/useYouTubeReadySession.ts'))return readFile(path.join(process.env.PLAYABLE_FOCUS_BASELINE_DIR,'session.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch(error){res.writeHead(500).end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PLAYABLE_FOCUS_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});const quick=process.env.PLAYABLE_FOCUS_QUICK==='1';
 for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.PLAYABLE_FOCUS_SCENARIOS?.split(',')??(quick?['hint']:['hint','tab-hint','wrong-submit','shortcut','shortcut-delete','continue','held-hint-tab','held-hint-pause','failed-hint-retry'])){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({width,height,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
  await page.goto(url);await page.getByRole('button',{name:/Classic/}).click();await page.locator('.yt-answer-native').waitFor();await page.waitForFunction(()=>window.probe.saves.length===1&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');
  const draft=()=>page.locator('.yt-guess-row.current .yt-tile').allTextContents().then(a=>a.join('').toLowerCase());
  const focused=()=>page.evaluate(()=>document.activeElement===document.querySelector('.yt-answer-native'));
  const settled=()=>page.waitForFunction(()=>document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');
  const hint=page.getByRole('button',{name:/^Hint/});
  if(scenario==='continue'){
   for(let i=0;i<5;i++){await page.locator('.yt-answer-native').focus();await page.keyboard.type('zzzz');await page.keyboard.press('Enter');await settled();}
   metric('exhausted attempts disable the answer editor',await page.locator('.yt-answer-native').isDisabled(),true);
   await page.getByRole('button',{name:/^Use one more guess/}).click();await settled();
   await page.keyboard.type('rome');metric('physical typing resumes after a paid continue',await draft(),'rome');metric('continue restores usable native focus',await focused(),true);
  }else if(scenario==='wrong-submit'){
   await page.keyboard.type('zzzz');await page.getByRole('button',{name:'Submit',exact:true}).click();await settled();
   await page.keyboard.type('rome');metric('physical typing resumes after toolbar submission',await draft(),'rome');metric('wrong submit retains native focus',await focused(),true);
  }else if(scenario==='shortcut'||scenario==='shortcut-delete'){
   if(scenario==='shortcut'){await page.locator('.yt-keyboard button').filter({hasText:/^R$/}).click();await page.keyboard.type('ome');}
   else{await page.keyboard.type('rox');await page.locator('.yt-keyboard button').filter({hasText:/^⌫$/}).click();await page.keyboard.type('me');}
   metric('switching from shortcut buttons to physical input preserves the answer',await draft(),'rome');metric('shortcut returns focus to native entry',await focused(),true);
  }else{
   const held=scenario.startsWith('held-')||scenario==='failed-hint-retry';if(held)await page.evaluate(()=>{window.holdSaveOnce=true;});
   if(scenario==='tab-hint'){await page.keyboard.press('Tab');metric('Tab can reach the hint action',await hint.evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Enter');}
   else await hint.click();
   await page.waitForFunction(()=>document.querySelector('.yt-tile.hinted')?.textContent.toLowerCase()==='r');
   if(!held)await settled();
   if(scenario==='held-hint-tab'){
    metric('hint focuses input before a held save completes',await focused(),true);await page.keyboard.press('Shift+Tab');const owner=await page.evaluate(()=>{window.focusOwner=document.activeElement;return document.activeElement.className;});
    await page.evaluate(()=>window.releaseSave());await settled();metric('save receipt preserves subsequent Tab navigation',await page.evaluate(()=>document.activeElement===window.focusOwner),true);metric('Tab moved to another action',owner.includes('yt-tile'),true);await page.locator('.yt-answer-native').focus();
   }else if(scenario==='held-hint-pause'){
    await page.evaluate(()=>window.pauseGame());await page.waitForFunction(()=>document.querySelector('.yt-answer-native')?.disabled===true);metric('pause disables native entry',await page.locator('.yt-answer-native').isDisabled(),true);await page.evaluate(()=>window.releaseSave());metric('paused receipt cannot focus the disabled editor',await focused(),false);await page.evaluate(()=>window.resumeGame());await settled();await page.waitForFunction(()=>document.activeElement===document.querySelector('.yt-answer-native'));
   }else if(scenario==='failed-hint-retry'){
    await page.evaluate(()=>window.rejectSave());await page.locator('.yt-banner.error').waitFor();metric('save failure disables native entry',await page.locator('.yt-answer-native').isDisabled(),true);await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.yt-banner.error').waitFor({state:'detached'});await settled();metric('successful recovery focuses the usable editor',await focused(),true);
   }
   if(process.env.PLAYABLE_FOCUS_CONTROL_REFOCUS==='1')await page.locator('.yt-answer-native').focus();const focusBeforeTyping=await focused();await page.keyboard.type('ome');metric('physical typing continues after hint without an extra tap',await draft(),'rome');metric('hint leaves native input ready for typing',focusBeforeTyping,true);metric('hint lock is retained',await page.locator('.yt-tile.hinted').allTextContents(),['r']);
  }
  metric('typing does not add a material save',await page.evaluate(()=>window.probe.saves.length),scenario==='continue'?7:scenario==='hint'||scenario==='tab-hint'||scenario==='wrong-submit'||scenario.startsWith('held-')?2:scenario==='failed-hint-retry'?3:1);
  metric('consumed native text is empty',await page.locator('.yt-answer-native').inputValue(),'');await page.keyboard.press('Enter');await page.locator('.yt-result').waitFor();metric('native Enter completes one win',await page.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalWins),1);
  metric('no page errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[width,height,scenario,'settled.png'].join('-'))});await context.close();
 }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,active:{tag:document.activeElement.tagName,text:document.activeElement.textContent},probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
