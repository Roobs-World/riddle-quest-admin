import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.PLAYABLE_CAPACITY_REACT_MODE??'development';
const output=path.resolve(process.env.PLAYABLE_CAPACITY_REPORT_DIR??path.join(root,'../../builds/test-evidence/playable-text-capacity-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/playable-text-capacity-'));
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
const sdk={inPlayablesEnvironment:true,firstFrameReady(){},gameReady(){window.probe.ready++;},async loadData(){window.probe.loads++;return '';},async saveData(data){if(!window.probe.loads)throw Error('Save before load');window.probe.saves.push(data);},async getLanguage(){return 'en';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(callback){window.pausePlayable=callback;return ()=>{};},onResume(callback){window.resumePlayable=callback;return ()=>{};},logError(){},logWarning(){}};
createRoot(document.querySelector('#root')).render(<React.StrictMode><YouTubePlayableApp sdk={sdk}/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,logLevel:'error',resolve:{alias:{'#youtube-content':fixture}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'playable-ime-baseline',async load(id){if(process.env.PLAYABLE_CAPACITY_BASELINE_FILE&&id.endsWith('/playable/input.ts'))return readFile(process.env.PLAYABLE_CAPACITY_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PLAYABLE_CAPACITY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
  browser=await chromium.launch({headless:true});const quick=process.env.PLAYABLE_CAPACITY_QUICK==='1';
  for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.PLAYABLE_CAPACITY_MEASURE==='1'?['long-paste']:quick?['paste']:['paste','composition','occupied-slot','hinted','separate-keys','long-paste']){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const metric=(name,actual,expected)=>{observations.push({width,height,scenario,name,actual,expected});assert.deepEqual(actual,expected,name);};
   await page.goto(url);await page.getByRole('button',{name:/Classic/}).click();await page.locator('.yt-answer-native').waitFor();
   await page.waitForFunction(()=>window.probe.saves.length===1&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');
   const letters=()=>page.locator('.yt-guess-row.current .yt-tile').allTextContents().then(values=>values.join('').toLowerCase());
   let text='romeEXTRAS';
   if(scenario==='occupied-slot'){
    await page.locator('.yt-answer-native').focus();await page.keyboard.type('romx');await page.locator('.yt-guess-row.current .yt-tile').last().click();text='eEXTRAS';
   } else if(scenario==='hinted'){
    await page.getByRole('button',{name:/Hint/}).click();await page.waitForFunction(()=>window.probe.saves.length===2&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');text='omeEXTRAS';metric('paid hint locks the first answer slot',await page.locator('.yt-guess-row.current .yt-tile').first().isDisabled(),true);
   }
   const before=await page.evaluate(()=>window.probe.saves.length);await page.locator('.yt-answer-native').focus();
   if(scenario==='long-paste'){
    const samples=[];
    for(let sample=0;sample<13;sample++){
     const duration=await page.evaluate(()=>{const input=document.querySelector('.yt-answer-native'),text='rome'+'Z'.repeat(5000);input.value=text;const start=performance.now();input.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertFromPaste'}));return performance.now()-start;});
     await page.waitForFunction(()=>[...document.querySelectorAll('.yt-guess-row.current .yt-tile')].every(e=>e.textContent));
     if(sample>=3)samples.push(duration);
     if(sample<12){for(let index=0;index<4;index++)await page.keyboard.press('Backspace');}
    }
    await writeFile(path.join(output,[width,height,'paste-timing.json'].join('-')),JSON.stringify({mode,width,height,inputCharacters:5004,warmup:3,samples,median:[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)],scope:'Synchronous native input-event dispatch; excludes asynchronous React commit and production network.'},null,2));
   }
   if(scenario==='long-paste'){}else if(scenario==='separate-keys'){
    await page.keyboard.type('romx');await page.keyboard.type('e');
   }else await page.evaluate(({text,composition})=>{
    const input=document.querySelector('.yt-answer-native');
    if(composition){input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));input.value=text;input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:text,inputType:'insertCompositionText'}));input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:text}));input.value=text;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'}));}
    else {input.value=text;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertFromPaste'}));}
   },{text,composition:scenario==='composition'});
   metric('one committed unit respects initially available answer slots',await letters(),'rome');
   metric('editing does not add a material write',await page.evaluate(()=>window.probe.saves.length),before);
   metric('editing does not submit a guess',await page.locator('.yt-result').count(),0);
   metric('consumed native text does not remain in the editor',await page.locator('.yt-answer-native').inputValue(),'');
   await page.keyboard.press('Enter');await page.locator('.yt-result').waitFor();
   metric('explicit Enter records one win',await page.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalWins),1);
   metric('explicit Enter makes one additional save',await page.evaluate(()=>window.probe.saves.length),before+1);
   metric('answer is scored on the first attempt',await page.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalGuessesInWins),1);
   metric('no page errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
   await page.screenshot({path:path.join(output,[width,height,scenario,'settled.png'].join('-'))});await context.close();
  }

 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
