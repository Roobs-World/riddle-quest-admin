import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.COMPLETION_WORK_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const baseline=process.env.COMPLETION_WORK_BASELINE_DIR;
const output=path.resolve(process.env.COMPLETION_WORK_REPORT_DIR??path.join(root,'builds/test-evidence/completion-container-work-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/completion-work-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/web/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/web/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/web/play/fakeServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/web/play/guidance/guidanceConfig.ts'))};
import {GAME_TO_HOST_EVENT,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/web/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;window.probe={allocations:{set:0,map:0},guesses:0,completions:0,completionIds:[],receipts:[],errors:[],unhandled:[],hold:false};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
window.addEventListener(GAME_TO_HOST_EVENT,event=>{if(event.detail.type==='game:completeGame')window.probe.completionIds.push(event.detail.requestId);});
window.addEventListener(HOST_TO_GAME_EVENT,event=>{if(event.detail.type==='host:operationResult'&&event.detail.payload.operation==='completeGame')window.probe.receipts.push(event.detail);});
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const base=createFakeHostServices(),services={...base,submitGuess:async input=>{window.probe.guesses++;return base.submitGuess(input);},completeGame:async input=>{window.probe.completions++;if(window.probe.hold)await new Promise(resolve=>window.release=resolve);return base.completeGame(input);}};
const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false});
function App(){const [mounted,setMounted]=React.useState(true),[epoch,setEpoch]=React.useState(0);window.refresh=()=>setEpoch(x=>x+1);return <div data-epoch={epoch}>{mounted?<PlayHostApp session={session}/>:<p data-retired>Game removed</p>}<button data-retire onClick={()=>setMounted(false)}>Retire game</button><button data-remount onClick={()=>setMounted(true)}>Remount game</button></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'completion-work-counter',enforce:'pre',async load(id){if(!id.endsWith('/useCompletionDelivery.ts'))return;let source=await readFile(baseline?path.join(baseline,'delivery.before.txt'):id,'utf8');const sets=source.match(/new Set<string>\(\)/g)??[],maps=source.match(/new Map<string, \{[\s\S]*?\}>\(\)/g)??[];assert.equal(sets.length,1);assert.equal(maps.length,1);source=source.replace(sets[0],`(window.probe.allocations.set++, ${sets[0]})`).replace(maps[0],`(window.probe.allocations.map++, ${maps[0]})`);return source;}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.COMPLETION_WORK_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.COMPLETION_WORK_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.COMPLETION_WORK_SCENARIOS?.split(',')??['typing','parent','pending','remount']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('pian');
  const draft=()=>page.locator('.guess-row:has([aria-current="true"]) button').allTextContents().then(v=>v.join('').toLowerCase());await page.waitForFunction(()=>[...document.querySelectorAll('.guess-row:has([aria-current="true"]) button')].map(x=>x.textContent).join('').toLowerCase()==='pian');metric('native typing reaches the real hosted draft',await draft(),'pian');
  if(scenario==='pending'){await page.evaluate(()=>window.probe.hold=true);await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>window.probe.completions===1&&!!window.release);metric('pending completion has one receipt identity',await page.evaluate(()=>new Set(window.probe.completionIds).size),1);}
  await page.evaluate(()=>{window.probe.allocations={set:0,map:0};window.firstFixedKey=document.querySelector('.keyboard button');});
  if(scenario==='typing'){for(let i=0;i<(process.env.COMPLETION_WORK_QUICK==='1'?1:16);i++){await page.keyboard.press('Backspace');await page.keyboard.type('n');}}
  else if(scenario==='parent'||scenario==='pending'){for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-epoch]')?.dataset.epoch===String(i+1),i);}}
  else{await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();await page.locator('[data-remount]').click();await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();metric('fresh mount creates its own delivery collections',await page.evaluate(()=>window.probe.allocations.set>0&&window.probe.allocations.map>0),true);await page.evaluate(()=>document.activeElement?.blur());await page.waitForFunction(()=>[...document.querySelectorAll('.guess-row:has([aria-current="true"]) button')].map(x=>x.textContent).join('').toLowerCase()==='pian');metric('fresh mount restores the existing native draft',await draft(),'pian');await page.evaluate(()=>{window.probe.allocations={set:0,map:0};window.firstFixedKey=document.querySelector('.keyboard button');});await page.keyboard.press('Backspace');await page.keyboard.type('n');}
  metric('mounted keyboard remains the same DOM element',await page.evaluate(()=>window.firstFixedKey===document.querySelector('.keyboard button')),true);
  metric('mounted completion collections do not allocate again',await page.evaluate(()=>window.probe.allocations),{set:0,map:0});
  if(scenario==='pending'){await page.evaluate(()=>{window.probe.hold=false;window.release();});}
  else{metric('native edits preserve the intended draft',await draft(),'pian');metric('editing does not submit',await page.evaluate(()=>window.probe.guesses),0);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('o');await page.getByRole('button',{name:/^submit$/i}).click();}
  await page.waitForFunction(()=>window.probe.receipts.some(x=>x.payload.ok));metric('explicit guess reaches authority once',await page.evaluate(()=>window.probe.guesses),1);metric('completion reaches authority once',await page.evaluate(()=>window.probe.completions),1);metric('completion retries retain one issued receipt identity',await page.evaluate(()=>new Set(window.probe.completionIds).size),1);metric('success is delivered back to the actual game',await page.evaluate(()=>window.probe.receipts.at(-1).payload.ok),true);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.COMPLETION_WORK_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.COMPLETION_WORK_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Mounted completion collection allocation work');
