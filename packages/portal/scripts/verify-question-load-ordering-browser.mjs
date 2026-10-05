import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.QUESTION_ORDER_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.QUESTION_ORDER_REPORT_DIR??path.join(root,'../../artifacts/question-load-ordering-2026-10-05',mode));
const baseline=process.env.QUESTION_ORDER_BASELINE_DIR;
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/question-order-'));
let server,browser;const observations=[];
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
window.probe={outbound:[],inbound:[],reads:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
const source=createFakeHostServices(),first=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1}),next=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2}),profile=await source.loadProfile('jest-guest');
const held=new Map();window.release=(index,fail=false)=>{const entry=held.get(index);held.delete(index);if(fail)entry.reject(new Error('Obsolete fixture question failed'));else entry.resolve(index===2?next:{...next,index:3,riddleId:'classic-order-3',sessionToken:'00000000-0000-4000-8000-000000000003'});};
window.request=(index,requestId='load-order-'+index)=>window.dispatchEvent(new CustomEvent('riddle-quest:game-to-host',{detail:{type:'game:loadRiddle',requestId,payload:{gameMode:'classic',locale:'en',classicIndex:index}}}));
const services={...source,loadRiddle:input=>{window.probe.reads.push(input);if(input.classicIndex===2||input.classicIndex===3)return new Promise((resolve,reject)=>held.set(input.classicIndex,{resolve,reject}));return Promise.resolve(first);}};
const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:{schemaVersion:1,updatedAt:1,profile,activeGame:null}});
const gameRoot=createRoot(document.querySelector('#root'));window.retire=()=>gameRoot.unmount();gameRoot.render(<React.StrictMode><PlayHostApp session={session}/></React.StrictMode>);
window.pending=()=>[...held.keys()];
`);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'question-order-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useHostRiddleLifecycle.ts'))return readFile(path.join(baseline,'lifecycle.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.webm':'audio/webm','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 if(process.env.QUESTION_ORDER_SERVE_ONLY==='1'){console.log(JSON.stringify({url:origin,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.QUESTION_ORDER_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.QUESTION_ORDER_SCENARIOS?.split(',')??['late-success','late-failure','retirement','success-before-newer','obsolete-reconcile','obsolete-preview']) {
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();external.push(url.origin);return route.abort();});
 const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
 await page.goto(origin);await page.getByRole('heading',{name:'What has keys but cannot open doors?',exact:true}).waitFor();
 if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
 await page.evaluate(scenario=>window.request(2,scenario==='obsolete-reconcile'?'reconcile-order-2':scenario==='obsolete-preview'?'skip-preview-order-2':'load-order-2'),scenario);await page.waitForFunction(()=>window.pending().includes(2));
 await page.evaluate(()=>window.request(3));await page.waitForFunction(()=>window.pending().includes(3));
 metric('independent correlated provider reads',await page.evaluate(()=>window.probe.reads.filter(x=>[2,3].includes(x.classicIndex)).map(x=>x.classicIndex)),[2,3]);
 if(scenario==='success-before-newer'){await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type('p');await page.evaluate(()=>window.release(2));await page.waitForTimeout(50);metric('older success stays silent while newer request is pending',await page.locator('.guess-row').first().textContent(),'P');metric('older success cannot publish while newer request is pending',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded'&&x.requestId==='load-order-2').length),0);}
 await page.evaluate(()=>window.release(3));await page.getByRole('heading',{name:'What has a face and hands but no arms?',exact:true}).waitFor();
 await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type('c');
 metric('latest authority-issued identity reaches the bridge',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded').at(-1)?.payload.riddle.sessionToken),'00000000-0000-4000-8000-000000000003');
 const draft=await page.locator('.guess-row').first().textContent();metric('native input starts a draft',draft.includes('C'),true);
 const delivered=await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded').length);
 if(scenario==='retirement')await page.evaluate(()=>window.retire());
 if(scenario!=='success-before-newer')await page.evaluate(fail=>window.release(2,fail),scenario==='late-failure');await page.waitForTimeout(350);
 metric('obsolete load cannot deliver another board',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded').length),delivered);
 if(scenario==='retirement')metric('retired surface stays removed',await page.locator('.guess-board').count(),0);
 else {metric('newer native draft survives obsolete load',await page.locator('.guess-row').first().textContent(),draft);metric('obsolete failure does not show recovery notice',await page.locator('.play-alert').count(),0);metric('obsolete failure cannot start recovery reads',await page.evaluate(()=>window.probe.reads.filter(x=>[2,3].includes(x.classicIndex)).length),2);}
 metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);metric('no external provider traffic',external,[]);await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.QUESTION_ORDER_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'Question load ordering preserves the newer board and draft');
