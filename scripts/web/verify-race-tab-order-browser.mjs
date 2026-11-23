import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),mode=process.env.RACE_TAB_REACT_MODE??'development',baseline=process.env.RACE_TAB_BASELINE_DIR;
const output=path.resolve(process.env.RACE_TAB_REPORT_DIR??path.join(root,'builds/test-evidence/race-tab-order-2026-10-04',mode));
assert.ok(['development','production'].includes(mode));await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-tab-order-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTournamentEntry} from ${JSON.stringify(path.join(root,'src/web/play/race/RaceTournamentEntry.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/web/play/race/testing/fakeRaceServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/web/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
window.probe={adds:0,removes:0,listeners:new Set(),closes:0,commands:[],reads:[],records:[],errors:[],unhandled:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);document.addEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.adds++;window.probe.listeners.add(handler);}return add(type,handler,...rest);};document.removeEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.removes++;window.probe.listeners.delete(handler);}return remove(type,handler,...rest);};
const source=createFakeRaceServices(),catalog=await source.listRaceCategories({locale:'en'}),noop=()=>{};
const tournaments={list:async locale=>{window.probe.reads.push('tournament');return {tournamentId:'fixture',locale,startsAtMs:Date.now()-1000,endsAtMs:Date.now()+60000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[]};},record:async()=>{window.probe.records.push('tournament');throw Error('Unexpected score record');}};
const contextBoard={list:async()=>{window.probe.reads.push('context');return null;},record:async()=>{window.probe.records.push('context');throw Error('Unexpected context record');}};
function App(){const [epoch,setEpoch]=React.useState(0);return <><nav style={{position:'fixed',bottom:0,left:0,zIndex:10000,background:'white'}}><button data-before>Outside before</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></nav><div data-epoch={epoch}><RaceTournamentEntry locale="en" ownerId="fixture-owner" coins={100} tournaments={tournaments} contextBoard={contextBoard} tournamentLocale="en" initialCategories={catalog.categories} postToHost={message=>window.probe.commands.push(message.type)} onClose={()=>window.probe.closes++} presentation={{titleId:'fixture-tournament',analyticsScreen:'fixture',onRecordFailure:noop}}/></div><button data-after>Outside after</button></>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'captured-focus-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useRaceDialogFocus.ts'))return readFile(path.join(baseline,'focus.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.RACE_TAB_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{browser=await chromium.launch({headless:true});for(const [width,height] of process.env.RACE_TAB_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const destination of process.env.RACE_TAB_DESTINATIONS?.split(',')??['activity','play','tournaments']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const metric=(name,actual,expected)=>observations.push({width,height,destination,name,actual,expected});await page.goto(url);await page.getByRole('tab',{name:'Tournaments',exact:true}).waitFor();await settle();await page.getByRole('tab',{name:'Tournaments',exact:true}).focus();if(destination!=='tournaments')await page.keyboard.press(destination==='activity'?'ArrowLeft':'Home');await settle();
  metric('validated standings do not show an error',await page.locator('.race-error').count(),destination==='play'?1:0);
  const active=page.getByRole('tab',{selected:true}),close=page.locator('.race-close');metric('native tab selection focuses the selected destination',await active.evaluate(el=>el===document.activeElement),true);
  if(process.env.RACE_TAB_CONTROL_REFILTER==='1')await page.evaluate(()=>{document.querySelectorAll('[role=tab][tabindex="-1"]').forEach(el=>el.disabled=true);});
  await page.keyboard.press('Tab');metric('forward Tab from the selected final eligible control wraps to Close',await close.evaluate(el=>el===document.activeElement),true);
  if(process.env.RACE_TAB_SMOKE!=='1'){
   const registration=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);for(let i=0;i<32;i++)await page.locator('[data-parent]').click();metric('32 parent updates retain one stable dialog keyboard subscription',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),registration);metric('one current keyboard subscription remains',await page.evaluate(()=>window.probe.listeners.size),1);

   await close.focus();await page.keyboard.press('Shift+Tab');metric('reverse Tab wraps to the selected tab rather than a skipped tab',await active.evaluate(el=>el===document.activeElement),true);metric('inactive roving tabs stay outside the native tab sequence',await page.locator('[role=tab][aria-selected=false]').evaluateAll(els=>els.every(el=>el.tabIndex===-1)),true);
   metric('navigation does not issue gameplay or economy commands',await page.evaluate(()=>window.probe.commands),[]);metric('navigation never records a score',await page.evaluate(()=>window.probe.records),[]);metric('navigation does not close the multiplayer surface',await page.evaluate(()=>window.probe.closes),0);
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[destination,width,height].join('-')+'.png')});await context.close();
 }}
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RACE_TAB_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.RACE_TAB_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Multiplayer native Tab order');
