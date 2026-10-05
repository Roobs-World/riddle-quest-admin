import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.RIDDLE_RECOVERY_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.RIDDLE_RECOVERY_REPORT_DIR??path.join(root,'../../artifacts/riddle-recovery-coalescing-2026-10-05',mode));
const baseline=process.env.RIDDLE_RECOVERY_BASELINE_DIR;
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/riddle-recovery-'));
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
window.probe={outbound:[],inbound:[],reads:[],recoveries:[],errors:[],unhandled:[],signals:[],failedAt:null,timerCallbacks:[],timerSchedules:[],pendingTimers:new Map()};
const clearTimer=window.clearTimeout.bind(window);window.clearTimeout=id=>{window.probe.pendingTimers.delete(id);return clearTimer(id);};window.trackRecovery=(callback,delay)=>{window.probe.timerSchedules.push({at:performance.now(),delay});const id=window.setTimeout(()=>{window.probe.pendingTimers.delete(id);window.probe.timerCallbacks.push({at:performance.now(),delay});callback();},delay);window.probe.pendingTimers.set(id,delay);return id;};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
const source=createFakeHostServices(),first=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1}),next=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2}),profile=await source.loadProfile('jest-guest');
let rejectFirst;window.fail=()=>{window.probe.failedAt=performance.now();rejectFirst(new Error('Startup fixture transport unavailable'));};
window.storm=async()=>{for(let i=0;i<20;i++){window.probe.signals.push(performance.now());window.dispatchEvent(new Event('online'));await new Promise(r=>setTimeout(r,10));}};
const services={...source,loadRiddle:input=>{window.probe.reads.push({at:performance.now(),...input});if(window.probe.reads.length===1)return new Promise((resolve,reject)=>{rejectFirst=reject;});return Promise.resolve(first);}};
const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:{schemaVersion:1,updatedAt:1,profile,activeGame:null}});
const gameRoot=createRoot(document.querySelector('#root'));window.retire=()=>gameRoot.unmount();gameRoot.render(<React.StrictMode><PlayHostApp session={session}/><aside style={{position:'fixed',zIndex:2147483647,top:0,left:0}}><button data-storm onClick={()=>window.storm()}>Repeat reconnect signals</button><button data-fail onClick={()=>window.fail()}>Fail held startup read</button></aside></React.StrictMode>);
`);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'riddle-recovery-baseline',enforce:'pre',async load(id){if(id.endsWith('/useHostRiddleLifecycle.ts')){const source=await readFile(baseline?path.join(baseline,'lifecycle.before.txt'):id,'utf8');const needle='      onRecoveryAttempt();';assert.equal(source.split(needle).length,2);const timer='recoveryTimer = window.setTimeout(() => void recoverRiddle(), delayMs);';assert.equal(source.split(timer).length,2);return source.replace(needle,'      window.probe.recoveries.push(performance.now()); onRecoveryAttempt();').replace(timer,'recoveryTimer = window.trackRecovery(() => void recoverRiddle(), delayMs);');}}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.webm':'audio/webm','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 if(process.env.RIDDLE_RECOVERY_SERVE_ONLY==='1'){console.log(JSON.stringify({url:origin,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of [[390,568]]) {
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
 await context.route('**/*',route=>{const request=new URL(route.request().url());if(request.origin===origin)return route.continue();external.push(request.origin);return route.abort();});
 const metric=(name,actual,expected)=>observations.push({width,height,name,actual,expected});
 await page.goto(origin);await page.waitForFunction(()=>window.probe.reads.length===1&&window.probe.recoveries.length>=1);
 const before=await page.evaluate(()=>window.probe.timerCallbacks.length);await page.locator('[data-storm]').click();await page.waitForFunction(()=>window.probe.signals.length===20);await page.waitForTimeout(30);
 metric('reconnect signals share one provider read',await page.evaluate(()=>window.probe.reads.length),1);
 metric('held startup has only one recovery observer',await page.evaluate(()=>window.probe.recoveries.length),1);metric('reconnect signals do not wake an already owned recovery',await page.evaluate(before=>window.probe.timerCallbacks.length-before,before),0);
 await page.locator('[data-fail]').click();await page.waitForTimeout(1400);
 metric('one shared failure retries on its first backoff',await page.evaluate(()=>window.probe.reads.length),2);
 metric('recovery restores a playable question promptly',await page.getByRole('heading',{name:'What has keys but cannot open doors?',exact:true}).count(),1);
 metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);metric('no external traffic',external,[]);
 observations.push({width,height,diagnostic:true,name:'actual startup recovery trace',actual:await page.evaluate(()=>window.probe),expected:null});await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RIDDLE_RECOVERY_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(row=>!row.diagnostic&&JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.filter(row=>!row.diagnostic).length,failures},null,2));assert.equal(failures.length,0,'Startup recovery coalesces signals and counts one shared failure once');
