import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {build} from '../../packages/portal/node_modules/vite/dist/node/index.js';
import {chromium} from '../../packages/portal/node_modules/@playwright/test/index.mjs';
const portal=path.resolve('packages/portal'),mode=process.env.LIVE_HISTORY_MODE??'development';
const evidence=path.resolve(process.env.LIVE_HISTORY_REPORT_DIR??'artifacts/live-history-provider-2026-10-06/'+mode);
await mkdir(evidence,{recursive:true});await mkdir(path.join(portal,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/live-history-provider-probe-'));
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
function history(owner){const now=Date.now();return ListLiveRaceHistoryResponseSchema.parse({locale:'en',serverNowMs:now,entries:[{ticketId:(owner==='Alice'?'a':'b').repeat(64),categoryId:'mixed',createdAtMs:now-1000,result:'win',correctCount:10,rewardCoins:50,opponentAvailable:true,opponent:{displayName:'Rival '+owner,avatarUrl:null,level:1,correctCount:4,bot:false}}]});}
function adapter(owner){return {history:async locale=>{window.probe.reads.push({owner,locale});if(owner==='Bob')return new Promise(resolve=>{window.resolveNew=()=>resolve(history(owner));});return history(owner);},rematch:async input=>{window.probe.rematches.push({owner,...input});return LiveRaceViewSchema.parse({ticketId:'c'.repeat(64),phase:'cancelled',serverNowMs:Date.now(),searchEndsAtMs:Date.now()+60000,startsAtMs:null,player:{displayName:owner,avatarUrl:null,bot:false,correctCount:0},opponent:null,run:null,result:null,rewardCoins:0});},join:async()=>{throw Error('Unexpected ordinary join');},update:async()=>{throw Error('Unexpected update');}};}
const adapters={Alice:adapter('Alice'),Bob:adapter('Bob')},presentation={titleId:'history-fixture',analyticsScreen:'history_fixture',onRecordFailure:()=>{}},post=()=>{};
function App(){const [owner,setOwner]=React.useState('Alice'),[version,setVersion]=React.useState(0);
 React.useLayoutEffect(()=>{if(version){window.probe.ownerAtCommit=owner;window.probe.rowsAtCommit=document.querySelectorAll('.live-race-history-entry').length;window.probe.textAtCommit=document.querySelector('.live-race-history')?.textContent??null;if(scenario==='replace')document.querySelector('.live-race-rematch')?.click();}},[owner,version]);
 return <><button data-replace style={{position:'fixed',bottom:4,right:4,zIndex:2147483647}} onClick={()=>{if(scenario==='replace')setOwner('Bob');setVersion(value=>value+1);}}>Replace fixture</button><div data-provider={owner}><RaceTournamentEntry ownerId='fixture-player' locale='en' coins={100} matchmaking={{live:adapters[owner]}} presentation={presentation} postToHost={post} onClose={()=>{}}/></div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(portal,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'history-baseline',enforce:'pre',async load(id){if(process.env.LIVE_HISTORY_BASELINE_FILE&&id.endsWith('/components/LiveRaceHistory.tsx'))return readFile(process.env.LIVE_HISTORY_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});browserVersion=browser.version();
 for(const scenario of ['replace','stable']){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({scenario,name,actual,expected});
  await page.goto(origin+'/?scenario='+scenario);await page.getByRole('tab',{name:'Activity',exact:true}).click();await page.locator('.live-race-history-entry').waitFor();await page.evaluate(()=>{window.oldRow=document.querySelector('.live-race-history-entry');window.readsBefore=window.probe.reads.length;});await page.locator('[data-replace]').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  metric('replacement commits through actual tournament destination',await page.evaluate(()=>window.probe.ownerAtCommit),scenario==='replace'?'Bob':'Alice');
  metric('only current-provider rows exist during commit',await page.evaluate(()=>window.probe.rowsAtCommit),scenario==='replace'?0:1);
  metric('replacement cannot start a rematch from an old history ticket',await page.evaluate(()=>window.probe.rematches.length),0);
  if(scenario==='stable'){metric('ordinary parent update preserves row identity',await page.evaluate(()=>window.oldRow===document.querySelector('.live-race-history-entry')),true);metric('ordinary parent update adds no history read',await page.evaluate(()=>window.probe.reads.length-window.readsBefore),0);}
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled errors',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(evidence,scenario+'.png')});await context.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,browserVersion,cases:2,checks:observations.length,failures},null,2));assert.equal(failures.length,0,'History rows must retire before provider replacement can activate them');
