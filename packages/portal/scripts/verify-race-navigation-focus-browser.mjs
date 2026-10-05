import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mode=process.env.RACE_NAV_REACT_MODE??'development',baseline=process.env.RACE_NAV_BASELINE_DIR;
const output=path.resolve(process.env.RACE_NAV_REPORT_DIR??path.join(root,'../../artifacts/race-navigation-focus-2026-10-05',mode));
assert.ok(['development','production'].includes(mode));await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-navigation-focus-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTournamentEntry} from ${JSON.stringify(path.join(root,'src/play/race/RaceTournamentEntry.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
window.probe={adds:0,removes:0,listeners:new Set(),closes:0,commands:[],reads:[],records:[],errors:[],unhandled:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const nativeFrame=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);let held=false,nextFrame=-1;const frames=new Map();window.probe.holdFrames=()=>{held=true;};window.requestAnimationFrame=callback=>{if(!held||!String(callback).includes("tabs.current"))return nativeFrame(callback);const id=nextFrame--;frames.set(id,callback);return id;};window.cancelAnimationFrame=id=>{if(frames.has(id))frames.delete(id);else nativeCancel(id);};window.probe.flushFrames=()=>new Promise(resolve=>{held=false;nativeFrame(time=>{const queued=[...frames.values()];frames.clear();if(!${process.env.RACE_NAV_DROP_FRAMES === "1"})queued.forEach(callback=>callback(time));resolve();});});window.probe.pendingFrames=()=>frames.size;
const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);document.addEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.adds++;window.probe.listeners.add(handler);}return add(type,handler,...rest);};document.removeEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.removes++;window.probe.listeners.delete(handler);}return remove(type,handler,...rest);};
const source=createFakeRaceServices(),catalog=await source.listRaceCategories({locale:'en'}),noop=()=>{};
const tournaments={list:async locale=>{window.probe.reads.push('tournament');return {tournamentId:'fixture',locale,startsAtMs:Date.now()-1000,endsAtMs:Date.now()+60000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[]};},record:async()=>{window.probe.records.push('tournament');throw Error('Unexpected score record');}};
const contextBoard={list:async()=>{window.probe.reads.push('context');return null;},record:async()=>{window.probe.records.push('context');throw Error('Unexpected context record');}};
function App(){const [epoch,setEpoch]=React.useState(0);return <><nav style={{position:'fixed',bottom:0,left:0,zIndex:10000,background:'white'}}><button data-before>Outside before</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></nav><div data-epoch={epoch}><RaceTournamentEntry locale="en" ownerId="fixture-owner" coins={100} tournaments={tournaments} contextBoard={contextBoard} tournamentLocale="en" initialCategories={catalog.categories} postToHost={message=>window.probe.commands.push(message.type)} onClose={()=>window.probe.closes++} presentation={{titleId:'fixture-tournament',analyticsScreen:'fixture',onRecordFailure:noop}}/></div><button data-after>Outside after</button></>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'captured-navigation-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/RaceTournamentEntry.tsx'))return readFile(path.join(baseline,'entry.before.tsx'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.RACE_NAV_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
  browser=await chromium.launch({headless:true});
  for(const [width,height] of process.env.RACE_NAV_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])
  for(const destination of process.env.RACE_NAV_DESTINATIONS?.split(',')??['activity','play','tournaments'])
  for(const scenario of process.env.RACE_NAV_SCENARIOS?.split(',')??['early-tab','early-enter','late-tab','no-tab']) {
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
   const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const metric=(name,actual,expected)=>observations.push({width,height,destination,scenario,name,actual,expected});
   await page.goto(url);await page.getByRole('tab',{name:'Tournaments',exact:true}).waitFor();await settle();
   await page.getByRole('tab',{name:'Tournaments',exact:true}).focus();
   // Returning to Tournaments also checks cancellation when a mounted destination is replaced.
   if(destination==='tournaments') {
    await page.keyboard.press('ArrowLeft');await settle();
    await page.getByRole('tab',{name:'Activity',selected:true}).focus();
   }
   await page.evaluate(()=>window.probe.holdFrames());
   await page.keyboard.press(destination==='play'?'Home':destination==='tournaments'?'ArrowRight':'ArrowLeft');
   await page.getByRole('tab',{name:destination[0].toUpperCase()+destination.slice(1),selected:true}).waitFor();
   await page.waitForFunction(()=>window.probe.pendingFrames()>0);
   metric('selection schedules one deferred frame',await page.evaluate(()=>window.probe.pendingFrames()),1);
   metric('board presentation follows validated capabilities',await page.locator('.race-error').count(),destination==='play'?1:0);
   if(scenario==='late-tab')await page.evaluate(()=>window.probe.flushFrames());
   if(scenario!=='no-tab') {
    await page.keyboard.press('Tab');
    await page.evaluate(()=>window.probe.closeBeforeFrame=document.querySelector('.race-close'));
    metric('native Tab reaches Close before any held focus work',await page.locator('.race-close').evaluate(el=>el===document.activeElement),true);
   }
   if(scenario!=='late-tab')await page.evaluate(()=>window.probe.flushFrames());
   await settle();
   if(scenario!=='no-tab')metric('board keeps the same connected Close control',await page.evaluate(()=>window.probe.closeBeforeFrame===document.querySelector('.race-close')&&window.probe.closeBeforeFrame.isConnected),true);
   const expected=scenario==='no-tab'?'[role=tab][aria-selected=true]':'.race-close';
   metric('deferred selection retains the latest native focus intent',await page.locator(expected).evaluate(el=>el===document.activeElement),true);
   if(scenario==='early-enter')await page.keyboard.press('Enter');
   metric('native Enter activates Close exactly once when requested',await page.evaluate(()=>window.probe.closes),scenario==='early-enter'?1:0);
   if(process.env.RACE_NAV_SMOKE!=='1') {
    const registration=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);
    for(let i=0;i<32;i++)await page.locator('[data-parent]').click();
    metric('parent updates do not restart the keyboard subscription',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),registration);
    metric('one current keyboard subscription remains',await page.evaluate(()=>window.probe.listeners.size),1);
    metric('ordinary parent updates schedule no selection frame',await page.evaluate(()=>window.probe.pendingFrames()),0);
    await page.locator('.race-close').focus();await page.keyboard.press('Shift+Tab');
    metric('reverse native Tab still selects the active roving tab',await page.getByRole('tab',{selected:true}).evaluate(el=>el===document.activeElement),true);
    metric('inactive tabs remain outside the native Tab sequence',await page.locator('[role=tab][aria-selected=false]').evaluateAll(els=>els.every(el=>el.tabIndex===-1)),true);
    metric('navigation issues no gameplay commands',await page.evaluate(()=>window.probe.commands),[]);
    metric('navigation never records an authoritative score',await page.evaluate(()=>window.probe.records),[]);
   }
   metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);
   metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);
   await page.screenshot({path:path.join(output,[destination,scenario,width,height].join('-')+'.png')});await context.close();
  }
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RACE_NAV_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.RACE_NAV_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Multiplayer deferred navigation focus');
