import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.PLAYABLE_ADMISSION_REACT_MODE??'development';
const output=path.resolve(process.env.PLAYABLE_ADMISSION_REPORT_DIR??path.join(root,'../../artifacts/playable-input-admission-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/playable-input-admission-'));
const fixture=path.join(root,'../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json');
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {YouTubePlayableApp} from ${JSON.stringify(path.join(root,'src/playable/YouTubePlayableApp.tsx'))};
import ${JSON.stringify(path.join(root,'src/playable/styles.css'))};
window.probe={loads:0,saves:[],ready:0,errors:[],unhandled:[]};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const sdk={inPlayablesEnvironment:true,firstFrameReady(){},gameReady(){window.probe.ready++;},async loadData(){window.probe.loads++;return '';},async saveData(data){if(!window.probe.loads)throw Error('Save before load');window.probe.saves.push(data);if(window.rejectSaveOnce){window.rejectSaveOnce=false;throw Error('Injected save failure');}if(window.holdSaveOnce){window.holdSaveOnce=false;await new Promise(resolve=>window.releaseSave=resolve);}},async getLanguage(){return 'en';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(callback){window.pausePlayable=callback;return ()=>{};},onResume(callback){window.resumePlayable=callback;return ()=>{};},logError(){},logWarning(){}};
createRoot(document.querySelector('#root')).render(<React.StrictMode><YouTubePlayableApp sdk={sdk}/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,logLevel:'error',resolve:{alias:{'#youtube-content':fixture}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'playable-ime-baseline',async load(id){if(process.env.PLAYABLE_ADMISSION_BASELINE_FILE&&id.endsWith('/playable/LocalSoloAuthority.ts'))return readFile(process.env.PLAYABLE_ADMISSION_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PLAYABLE_ADMISSION_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});const quick=process.env.PLAYABLE_ADMISSION_QUICK==='1';

  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of quick?['continue']:['continue','paused','blocked','writing']){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
   await page.goto(url);await page.getByRole('button',{name:/Classic/}).click();await page.locator('.yt-answer-native').waitFor();await page.waitForFunction(()=>window.probe.saves.length===1&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')==='false');
   const letters=()=>page.locator('.yt-guess-row.current .yt-tile').allTextContents().then(values=>values.join(''));
   if(scenario==='continue'){
    for(let attempt=0;attempt<5;attempt++){
     await page.locator('.yt-answer-native').focus();await page.keyboard.type('xxxx');
     if(attempt===4)await page.evaluate(()=>{const input=document.querySelector('.yt-answer-native');input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));input.value='rome';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'rome',isComposing:true,inputType:'insertCompositionText'}));});
     await page.getByRole('button',{name:'Submit',exact:true}).click();await page.waitForFunction(count=>window.probe.saves.length===count&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')==='false',attempt+2);
    }
    await page.locator('.yt-continue-panel').waitFor();metric('exhausted attempts disable native input',await page.locator('.yt-answer-native').isDisabled(),true);
   }else if(scenario==='paused'){
    await page.locator('.yt-answer-native').focus();await page.keyboard.type('ro');await page.evaluate(()=>window.pausePlayable());await page.waitForFunction(()=>document.querySelector('.yt-answer-native').disabled);
   }else{
    await page.locator('.yt-answer-native').focus();await page.keyboard.type('xxxx');await page.evaluate(scenario=>{if(scenario==='blocked')window.rejectSaveOnce=true;else window.holdSaveOnce=true;},scenario);await page.getByRole('button',{name:'Submit',exact:true}).click();
    if(scenario==='blocked')await page.locator('.yt-banner.error').waitFor();else await page.waitForFunction(()=>typeof window.releaseSave==='function');
   }
   const before=await letters(),writes=await page.evaluate(()=>window.probe.saves.length);
   await page.evaluate(()=>{const input=document.querySelector('.yt-answer-native');input.value='rome';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'rome'}));input.value='rome';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'rome',inputType:'insertText'}));});
   metric('late input produces no browser exception',await page.evaluate(()=>window.probe.errors),[]);
   metric('draft admission follows the current state',await letters(),scenario==='writing'?'rome':before);
   metric('ephemeral input creates no material save',await page.evaluate(()=>window.probe.saves.length),writes);
   if(scenario==='continue'){await page.locator('.yt-continue-panel button').first().click();await page.waitForFunction(()=>!document.querySelector('.yt-answer-native').disabled);}
   if(scenario==='paused')await page.evaluate(()=>window.resumePlayable());
   if(scenario==='blocked'){await page.locator('.yt-banner.error button').click();await page.waitForFunction(()=>!document.querySelector('.yt-banner.error'));}
   if(scenario==='writing'){await page.evaluate(()=>window.releaseSave());await page.waitForFunction(()=>document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')==='false');}
   await page.locator('.yt-answer-native').focus();for(let index=0;index<4;index++)await page.keyboard.press('Backspace');await page.locator('.yt-guess-row.current .yt-tile').first().click();await page.keyboard.type('rome');
   metric('resumed native typing remains usable',await letters(),'rome');
   await page.getByRole('button',{name:'Submit',exact:true}).click();await page.locator('.yt-result').waitFor();
   metric('resumed command records exactly one win',await page.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalWins),1);
   metric('no page errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
   await page.screenshot({path:path.join(output,[width,height,scenario,'settled.png'].join('-'))});await context.close();
  }

 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
