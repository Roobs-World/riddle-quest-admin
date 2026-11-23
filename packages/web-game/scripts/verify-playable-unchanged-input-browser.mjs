import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.PLAYABLE_UNCHANGED_REACT_MODE??'development';
const output=path.resolve(process.env.PLAYABLE_UNCHANGED_REPORT_DIR??path.join(root,'../../builds/test-evidence/playable-unchanged-input-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/playable-unchanged-input-'));
const repeats=Number(process.env.PLAYABLE_UNCHANGED_REPEATS??32);assert.ok(Number.isInteger(repeats)&&repeats>0&&repeats<=4096);let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {YouTubePlayableApp} from ${JSON.stringify(path.join(root,'src/playable/YouTubePlayableApp.tsx'))};
import ${JSON.stringify(path.join(root,'src/playable/styles.css'))};
window.probe={saves:[],loads:0,errors:[],unhandled:[],cloneCopies:0,readyRenders:0};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));

const sdk={inPlayablesEnvironment:true,firstFrameReady(){},gameReady(){},async loadData(){window.probe.loads++;return '';},async saveData(data){if(!window.probe.loads)throw Error('Save before load');window.probe.saves.push(data);if(window.holdSaveOnce){window.holdSaveOnce=false;await new Promise((resolve,reject)=>{window.releaseSave=resolve;window.rejectSave=()=>reject(Error('Injected save failure'));});}},async getLanguage(){return 'en';},isAudioEnabled(){return false;},onAudioEnabledChange(){return ()=>{};},onPause(fn){window.pauseGame=fn;return ()=>{delete window.pauseGame;};},onResume(fn){window.resumeGame=fn;return ()=>{delete window.resumeGame;};},logError(){},logWarning(){}};
createRoot(document.querySelector('#root')).render(<React.StrictMode><YouTubePlayableApp sdk={sdk}/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',resolve:{alias:{'#youtube-content':path.join(root,'../../firebase-functions/content/youtube-fixtures/youtube-content-fixture-v1.json')}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'playable-unchanged-instrumentation',enforce:'pre',async load(id){if(process.env.PLAYABLE_UNCHANGED_BASELINE_DIR&&id.endsWith('/LocalSoloAuthority.ts'))return readFile(path.join(process.env.PLAYABLE_UNCHANGED_BASELINE_DIR,'authority.before.txt'),'utf8');},transform(code,id){if(id.endsWith('/save.ts')&&code.includes('export function cloneYouTubeSave')){const needle='return JSON.parse(JSON.stringify(save)) as YouTubeSaveV1;';assert.ok(code.includes(needle));return code.replace(needle,'(globalThis as any).probe.cloneCopies++; '+needle);}if(id.endsWith('/YouTubePlayableApp.tsx')){const needle='const {locale, content, authority} = runtime;';assert.ok(code.includes(needle));return code.replace(needle,'(globalThis as any).probe.readyRenders++; '+needle);}}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch(error){res.writeHead(500).end(String(error));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.PLAYABLE_UNCHANGED_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});const quick=process.env.PLAYABLE_UNCHANGED_QUICK==='1';
 for(const [width,height] of quick?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.PLAYABLE_UNCHANGED_SCENARIOS?.split(',')??(quick?['rejected-text']:['rejected-text','empty-backspace','same-slot','same-letter','hinted-no-op'])){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected,measurement)=>{observations.push({width,height,scenario,name,actual,expected,...(measurement?{measurement}:{})});assert.deepEqual(actual,expected,name);};
  await page.goto(url);await page.getByRole('button',{name:/Classic/}).click();await page.locator('.yt-answer-native').waitFor();await page.waitForFunction(()=>window.probe.saves.length===1&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');
  if(scenario==='same-letter')await page.keyboard.type('rome');
  if(scenario==='hinted-no-op'){await page.getByRole('button',{name:/^Hint/}).click();await page.waitForFunction(()=>document.querySelector('.yt-tile.hinted')?.textContent.toLowerCase()==='r'&&document.querySelector('.yt-puzzle')?.getAttribute('aria-busy')!=='true');}
  const expectedDraft=scenario==='same-letter'?'rome':scenario==='hinted-no-op'?'r':'';
  const expectedCursor=scenario==='same-letter'?3:scenario==='hinted-no-op'?1:0;
  const work=await page.evaluate(async({scenario,expectedCursor,repeats})=>{await new Promise(requestAnimationFrame);window.probe.cloneCopies=0;window.probe.readyRenders=0;const input=document.querySelector('.yt-answer-native');for(let i=0;i<repeats;i++){if(scenario==='same-slot')document.querySelectorAll('.yt-guess-row.current .yt-tile')[expectedCursor].click();else if(scenario==='empty-backspace'||scenario==='hinted-no-op')input.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));else{input.value=scenario==='same-letter'?'e':'!? 123';input.dispatchEvent(new InputEvent('input',{data:input.value,inputType:'insertText',bubbles:true}));}await new Promise(requestAnimationFrame);}await new Promise(requestAnimationFrame);return {events:repeats,cloneCopies:window.probe.cloneCopies,readyRenders:window.probe.readyRenders};},{scenario,expectedCursor,repeats});
  const draft=()=>page.locator('.yt-guess-row.current .yt-tile').allTextContents().then(a=>a.join('').toLowerCase());
  metric('unchanged edits preserve the displayed answer',await draft(),expectedDraft);
  metric('unchanged edits preserve the active slot',await page.locator('.yt-guess-row.current .yt-tile').evaluateAll(a=>a.findIndex(e=>e.classList.contains('active'))),expectedCursor);
  metric('unchanged edits add no material save',await page.evaluate(()=>window.probe.saves.length),scenario==='hinted-no-op'?2:1);
  metric('unchanged edits avoid defensive save copies',work.cloneCopies,0,work);
  metric('unchanged edits avoid ready-view rendering',work.readyRenders,0);
  metric('consumed native value is empty',await page.locator('.yt-answer-native').inputValue(),'');
  if(scenario==='same-letter'){await page.keyboard.press('Backspace');metric('a real deletion reaches the projected answer',await draft(),'rom');await page.keyboard.type('e');}
  else{await page.keyboard.type(scenario==='hinted-no-op'?'o':'r');metric('a real edit reaches the projected answer',await draft(),scenario==='hinted-no-op'?'ro':'r');await page.keyboard.type(scenario==='hinted-no-op'?'me':'ome');}
  metric('real edits still publish defensive snapshots',await page.evaluate(()=>window.probe.cloneCopies>0),true);
  await page.keyboard.press('Enter');await page.locator('.yt-result').waitFor();metric('explicit native submission wins once',await page.evaluate(()=>JSON.parse(window.probe.saves.at(-1)).progression.totalWins),1);
  metric('no page errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[width,height,scenario,'settled.png'].join('-'))});await context.close();
 }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe})).catch(error=>({error:String(error)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
