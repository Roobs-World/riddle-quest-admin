import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {build} from '../../packages/portal/node_modules/vite/dist/node/index.js';
import {chromium} from '../../packages/portal/node_modules/@playwright/test/index.mjs';
const portal=path.resolve('packages/portal'),mode=process.env.LIVE_DEST_MODE??'development';
const evidence=path.resolve(process.env.LIVE_DEST_REPORT_DIR??'artifacts/live-destination-capability-2026-10-06/'+mode);
await mkdir(evidence,{recursive:true});await mkdir(path.join(portal,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/live-destination-probe-'));
let browser,server,browserVersion;const observations=[];
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTournamentEntry} from ${JSON.stringify(path.join(portal,'src/play/race/RaceTournamentEntry.tsx'))};
import {ListLiveRaceHistoryResponseSchema,LiveRaceViewSchema} from '@qwordly/core/race';
import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(portal,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
window.probe={reads:[],rematches:[],errors:[],unhandled:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const scenario=new URLSearchParams(location.search).get('scenario');
const categorySource=await import(${JSON.stringify(path.join(portal,'src/play/race/testing/fakeRaceServices.ts'))});const catalog=await categorySource.createFakeRaceServices().listRaceCategories({locale:'en'});
const live={history:async locale=>{window.probe.reads.push('history');return ListLiveRaceHistoryResponseSchema.parse({locale,serverNowMs:Date.now(),entries:[]});},join:async()=>{throw Error('Unexpected join');},update:async()=>{throw Error('Unexpected update');}};
const withoutHistory={...live,history:undefined};
const tournaments={list:async locale=>{window.probe.reads.push('tournaments');return {tournamentId:'fixture',locale,startsAtMs:Date.now()-1000,endsAtMs:Date.now()+60000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[]};},record:async()=>{throw Error('Unexpected record');}};
const presentation={titleId:'destination-fixture',analyticsScreen:'destination_fixture',onRecordFailure:()=>{}},post=()=>{};
function App(){const [withdrawn,setWithdrawn]=React.useState(false);
 React.useLayoutEffect(()=>{if(withdrawn){window.probe.selectedAtCommit=document.querySelector('[role=tab][aria-selected=true]')?.textContent??null;window.probe.playAtCommit=document.querySelectorAll('.race-category-panel').length;window.probe.keyboardEntryAtCommit=document.querySelectorAll('[role=tab][tabindex="0"]').length;}},[withdrawn]);
 return <><button data-withdraw style={{position:'fixed',bottom:4,right:4,zIndex:2147483647}} onClick={()=>setWithdrawn(true)}>Withdraw fixture</button><RaceTournamentEntry ownerId='fixture-player' locale='en' coins={100} initialCategories={catalog.categories} matchmaking={{live:scenario==='activity'&&withdrawn?withoutHistory:live}} tournaments={scenario==='tournaments'&&withdrawn?undefined:tournaments} presentation={presentation} postToHost={post} onClose={()=>{}}/></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(portal,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'history-baseline',enforce:'pre',async load(id){if(process.env.LIVE_DEST_BASELINE_FILE&&id.endsWith('/RaceTournamentEntry.tsx'))return readFile(process.env.LIVE_DEST_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});browserVersion=browser.version();
 for(const scenario of ['activity','tournaments']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({scenario,name,actual,expected});
  await page.goto(origin+'/?scenario='+scenario);await page.getByRole('tab',{name:scenario==='activity'?'Activity':'Tournaments',exact:true}).click();await page.waitForFunction(scenario=>window.probe.reads.includes(scenario==='activity'?'history':'tournaments'),scenario);await page.locator('[data-withdraw]').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  metric('unsupported destination returns to Play during commit',await page.evaluate(()=>window.probe.selectedAtCommit),'Play');metric('fallback commits the actual playable category surface',await page.evaluate(()=>window.probe.playAtCommit),1);metric('fallback retains one roving keyboard entry',await page.evaluate(()=>window.probe.keyboardEntryAtCommit),1);metric('unavailable destination does not create an error panel',await page.locator('.race-error').count(),0);metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled errors',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(evidence,scenario+'.png')});await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,browserVersion,cases:2,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'Withdrawn destination capability must keep Play reachable');
