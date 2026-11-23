import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.QUESTION_REPEAT_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.QUESTION_REPEAT_REPORT_DIR??path.join(root,'builds/test-evidence/repeated-question-delivery-2026-10-05',mode));
const baseline=process.env.QUESTION_REPEAT_BASELINE_DIR;
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/question-repeat-'));
let server,browser;const observations=[];
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/web/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/web/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/web/play/fakeServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/web/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');
for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');
for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
window.probe={outbound:[],inbound:[],reads:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.outbound.push(e.detail));window.addEventListener('riddle-quest:host-to-game',e=>window.probe.inbound.push(e.detail));
const source=createFakeHostServices(),first=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1}),next=await source.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2}),profile=await source.loadProfile('jest-guest');
window.ready=(requestId)=>{const message=window.probe.outbound.find(x=>x.type==='game:ready');window.dispatchEvent(new CustomEvent('riddle-quest:game-to-host',{detail:{...message,requestId:requestId??message.requestId}}));};
window.reply=scenario=>{const message=structuredClone(window.probe.inbound.find(x=>x.type==='host:riddleLoaded'));if(scenario==='mode-fallback'){const init=structuredClone(window.probe.inbound.find(x=>x.type==='host:init'));init.payload.gameMode='challenge';window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:init}));message.requestId='load-daily-fallback';}if(scenario==='profile-refresh')message.payload.profile={...message.payload.profile,coins:777};if(scenario==='reconcile')message.requestId='reconcile-repeat';if(scenario==='updated-hint')message.payload.riddle.revealedHints=[{index:1,letter:'I'}];if(scenario==='accepted-progress')message.payload.riddle={...message.payload.riddle,attemptsUsed:1,acceptedGuesses:[{attempt:1,feedback:Array.from({length:5},()=>({letter:'q',status:'red'}))}]};if(scenario==='new-session')message.payload.riddle=next;window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));};
const scenario=new URL(location.href).searchParams.get('scenario');
const services={...source,...(scenario==='pending-receipt'?{submitGuess:input=>{window.probe.guesses=(window.probe.guesses??[]).concat(input);return new Promise(()=>{});}}:{}),loadRiddle:async input=>{window.probe.reads.push(input);return first;}};
const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:{schemaVersion:1,updatedAt:1,profile,activeGame:null}});
const gameRoot=createRoot(document.querySelector('#root'));window.retire=()=>gameRoot.unmount();gameRoot.render(<React.StrictMode><PlayHostApp session={session}/></React.StrictMode>);

`);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'question-repeat-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/gameSession.ts'))return readFile(path.join(baseline,'session.before.txt'),'utf8');if(baseline&&id.endsWith('/useGameMessageRouter.ts'))return readFile(path.join(baseline,'router.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.webm':'audio/webm','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 if(process.env.QUESTION_REPEAT_SERVE_ONLY==='1'){console.log(JSON.stringify({url:origin,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.QUESTION_REPEAT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.QUESTION_REPEAT_SCENARIOS?.split(',')??['duplicate-ready','fresh-ready','riddle-only','profile-refresh','reconcile','updated-hint','accepted-progress','new-session','pending-receipt','mode-fallback']) {
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();external.push(url.origin);return route.abort();});
 const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
 await page.goto(origin+'?scenario='+scenario);await page.getByRole('heading',{name:'What has keys but cannot open doors?',exact:true}).waitFor();
 if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
 await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type('p');
 if(scenario==='pending-receipt'){await page.keyboard.type('qqqq');await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');await page.waitForFunction(()=>window.probe.guesses?.length===1);await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type('p');}
 const rowIndex=scenario==='pending-receipt'?1:0,row=page.locator('.guess-row').nth(rowIndex);
 const draft=await row.textContent();metric('native input starts a draft',draft,'P');
 await page.evaluate(rowIndex=>{window.mutations=[];const row=document.querySelectorAll('.guess-row')[rowIndex];const observer=new MutationObserver(records=>window.mutations.push(...records.map(record=>({type:record.type,old:record.oldValue,added:[...record.addedNodes].map(node=>node.textContent),removed:[...record.removedNodes].map(node=>node.textContent),current:row.textContent}))));observer.observe(row,{childList:true,subtree:true,characterData:true,characterDataOldValue:true});window.stopObserving=()=>observer.disconnect();},rowIndex);
 const deliveries=await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded').length);
 await page.evaluate(scenario=>{if(['duplicate-ready','fresh-ready'].includes(scenario))window.ready(scenario==='fresh-ready'?'ready-fresh-repeat':undefined);else window.reply(scenario);},scenario);
 await page.waitForFunction(count=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded').length>count,deliveries);await page.waitForTimeout(50);
 metric('unchanged refresh avoids clearing; authority changes still rebuild',await page.evaluate(()=>!window.mutations.some(record=>record.current===''||(record.type==='characterData'&&record.old==='P')||record.removed.includes('P'))),!['reconcile','updated-hint','accepted-progress','new-session'].includes(scenario));
 metric('native draft survives repeated ready question',await row.textContent(),scenario==='new-session'?'':scenario==='accepted-progress'?'qqqqq':scenario==='updated-hint'?'PI':draft);
 metric('repeated handshake still receives initialization',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:init').length>=2),['duplicate-ready','fresh-ready','mode-fallback'].includes(scenario));
 metric('same issued session remains displayed',await page.evaluate(()=>window.probe.inbound.filter(x=>x.type==='host:riddleLoaded').at(-1)?.payload.riddle.sessionToken),scenario==='new-session'?'00000000-0000-4000-8000-000000000002':'00000000-0000-4000-8000-000000000001');
 if(scenario==='profile-refresh')metric('same-question refresh applies current profile balance',await page.locator('.coin-pill strong').textContent(),'777');
 if(scenario==='updated-hint')metric('new authoritative hint becomes locked',await page.locator('.guess-row').first().locator('button').nth(1).isDisabled(),true);
 if(scenario==='new-session')metric('new session publishes its new question',await page.locator('.riddle-card h1').textContent(),'What has a face and hands but no arms?');
 if(scenario==='pending-receipt'){metric('held native submission stays singular',await page.evaluate(()=>window.probe.guesses.length),1);metric('provisional feedback remains while its receipt is held',await page.locator('.guess-row').first().textContent(),'pqqqq');}
 if(scenario==='mode-fallback')metric('unchanged Classic delivery corrects the temporary Daily mode',await page.locator('.game-mode-label').textContent(),'Classic');
 metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejections',await page.evaluate(()=>window.probe.unhandled),[]);metric('no external provider traffic',external,[]);observations.push({width,height,scenario,name:'DOM mutation trace',actual:await page.evaluate(()=>window.mutations),diagnostic:true});await context.close();

 }
 }
} finally {if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({text:document.body.innerText,probe:window.probe,mutations:window.mutations})).catch(error=>({error:String(error)})),null,2));await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.QUESTION_REPEAT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(row=>!row.diagnostic&&JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.filter(row=>!row.diagnostic).length,traces:observations.filter(row=>row.diagnostic).length,failures},null,2));assert.equal(failures.length,0,'Repeated question delivery preserves the native draft');
