/** Native tournament sharing exercises committed UI ownership through the real Facebook dialog adapter. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,firefox} from '@playwright/test';
const engine=process.env.TOURNAMENT_SHARE_BROWSER??'chromium',mode=process.env.TOURNAMENT_SHARE_MODE??'development';
const portal=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.resolve(process.env.TOURNAMENT_SHARE_REPORT_DIR??path.join(portal,'../../builds/test-evidence/live-tournament-share-2026-10-06',engine+'-'+mode));
await mkdir(evidence,{recursive:true});
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/tournament-share-probe-'));
let browser,server,browserVersion;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTournamentEntry} from ${JSON.stringify(path.join(portal,'src/play/race/RaceTournamentEntry.tsx'))};
import {createFacebookTournamentPresentation} from ${JSON.stringify(path.join(portal,'src/facebook/FacebookTournamentPresentation.ts'))};
import {ListFacebookTournamentResponseSchema} from '@riddle-quest/core/race';
import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(portal,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URLSearchParams(location.search).get('scenario');
window.probe={reads:[],shares:[],native:[],diagnostics:[],errors:[],unhandled:[],renders:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));
window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const startsAtMs=Math.floor(Date.now()/86400000)*86400000,endsAtMs=startsAtMs+86400000,tournamentId='facebook-race10-en-'+new Date(startsAtMs).toISOString().slice(0,10);
function board(locale){const currentPlayer={rank:1,adjustedTimeMs:9000,isCurrentPlayer:true};return ListFacebookTournamentResponseSchema.parse({tournamentId,locale,startsAtMs,endsAtMs,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[currentPlayer],currentPlayer});}
const data={kind:'rq-race10-tournament-v1',locale:'en',tournamentId,startsAtMs,endsAtMs};
const native={getID:()=> 'native-fixture',getContextID:()=> 'context-fixture',getEndTime:()=>endsAtMs/1000,getPayload:()=>data};
const sdk={getSupportedAPIs:()=>['getTournamentAsync','tournament.createAsync','tournament.shareAsync','tournament.postScoreAsync'],context:{getID:()=> 'context-fixture'},getTournamentAsync:async()=>native,tournament:{postScoreAsync:async()=>{},createAsync:async()=>{throw Error('Unexpected create');},shareAsync:input=>{
 window.probe.native.push(input);if(window.probe.native.length>1||scenario==='throw-failure')return Promise.resolve();return new Promise((resolve,reject)=>{let done=false;window.finishNative=()=>{if(done)return;done=true;if(scenario.includes('failure'))reject(new Error('private-native-fixture-failure'));else if(scenario.includes('cancelled'))reject({code:'USER_CANCELLED'});else resolve();};});
}}};
function operation(tag){const presentation=createFacebookTournamentPresentation({sdk,enabled:true,ageCategory:'13_plus',isActive:()=>true,getLocale:()=> 'en',list:async locale=>{window.probe.shares.push({tag,locale,phase:'authority'});return board(locale);},reportFailure:error=>window.probe.diagnostics.push(error.message)});
 return function(locale){window.probe.shares.push({tag,locale,phase:'admission',receiver:this?.tag});if(scenario==='throw-failure'&&tag==='old')return new Promise((resolve,reject)=>{window.finishNative=()=>reject(new Error('Rejected original operation'));});return presentation.share(locale);};}
const old=operation('old'),fresh=operation('fresh'),adapter={tag:'board',list:function(locale){window.probe.reads.push({locale,receiver:this.tag});return Promise.resolve(board(locale));},share:old,record:async()=>{throw Error('Unexpected record');}},replacement={...adapter,tag:'replacement',share:fresh};
const presentation={titleId:'share-fixture',analyticsScreen:'share_fixture',onRecordFailure:()=>{}},post=()=>{},never=new Promise(()=>{});
function Suspend({held}){if(held)throw never;return null;}
function App(){const [version,setVersion]=React.useState(0),[coins,setCoins]=React.useState(100),[owner,setOwner]=React.useState('board'),[held,setHeld]=React.useState(false);
 window.probe.renders.push({version,owner,held});
 const replace=()=>{if(scenario==='provider-success')setOwner('replacement');else if(scenario.startsWith('profile-'))setCoins(800);else adapter.share=scenario.startsWith('withdraw-')?undefined:fresh;setVersion(v=>v+1);};
 return <><button data-replace style={{position:'fixed',bottom:4,right:4,zIndex:2147483647}} onClick={replace}>Replace fixture</button>
 <button data-restore style={{position:'fixed',bottom:44,right:4,zIndex:2147483647}} onClick={()=>{adapter.share=old;setVersion(v=>v+1);}}>Restore fixture</button>
 <button data-prepare style={{position:'fixed',bottom:4,left:4,zIndex:2147483647}} onClick={()=>{adapter.share=fresh;React.startTransition(()=>{setVersion(v=>v+1);setHeld(true);});}}>Prepare fixture</button>
 <button data-abandon style={{position:'fixed',bottom:44,left:4,zIndex:2147483647}} onClick={()=>{adapter.share=old;setHeld(false);setCoins(800);}}>Abandon fixture</button>
 <React.Suspense fallback={<output data-suspended>Suspended fixture</output>}><div data-version={version} data-provider={owner}>
 <RaceTournamentEntry ownerId='fixture-player' locale='en' tournamentLocale='en' coins={coins} tournaments={owner==='board'?adapter:replacement} presentation={presentation} postToHost={post} onClose={()=>{}}/>
 </div><Suspend held={held}/></React.Suspense></>;
}createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
 await build({root:scratch,configFile:false,publicDir:path.join(portal,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'share-baseline',enforce:'pre',async load(id){if(process.env.TOURNAMENT_SHARE_BASELINE_FILE&&id.endsWith('/RaceTournamentEntry.tsx'))return readFile(process.env.TOURNAMENT_SHARE_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'&&process.env.TOURNAMENT_SHARE_FIREFOX_EXECUTABLE?{executablePath:process.env.TOURNAMENT_SHARE_FIREFOX_EXECUTABLE}:{})});browserVersion=browser.version();
 const scenarios=process.env.TOURNAMENT_SHARE_MINIMAL==='1'?['method-success','method-failure']:['method-success','method-failure','method-cancelled','throw-failure','withdraw-success','withdraw-failure','restore-success','restore-failure','profile-success','profile-failure','abandon-success','abandon-failure','stable-success','stable-failure','provider-success'];
 for(const [width,height] of process.env.TOURNAMENT_SHARE_QUICK==='1'?[[390,844]]:[[390,568],[390,844],[1280,844]])for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected}),settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.goto(origin+'/?scenario='+scenario);await page.locator('.race-tournaments li').waitFor();
  metric('one admitted initial authority read',await page.evaluate(()=>window.probe.reads.length),1);
  await page.evaluate(()=>{window.oldPanel=document.querySelector('.race-screen');window.oldRow=document.querySelector('.race-tournaments li');});
  await page.locator('.race-tournaments button').click();await page.waitForFunction(()=>typeof window.finishNative==='function');
  metric('original share retains provider receiver',await page.evaluate(()=>window.probe.shares.filter(x=>x.phase==='admission').map(x=>x.receiver)),['board']);
  metric('pending share disables native action',await page.locator('.race-tournaments button').isDisabled(),true);
  if(scenario.startsWith('abandon-')){
   await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.renders.some(x=>x.held));
   metric('prepared operation leaves committed board visible',await page.locator('[data-version]').getAttribute('data-version'),'0');
   await page.locator('[data-abandon]').click();await settle();
  }else if(!scenario.startsWith('stable-')){await page.locator('[data-replace]').click();await page.waitForFunction(()=>document.querySelector('[data-version]').getAttribute('data-version')==='1');}
  if(scenario.startsWith('restore-')){await page.locator('[data-restore]').click();await page.waitForFunction(()=>document.querySelector('[data-version]').getAttribute('data-version')==='2');}
  const retained=['profile-','abandon-','stable-'].some(prefix=>scenario.startsWith(prefix)),replaced=scenario==='provider-success',withdrawn=scenario.startsWith('withdraw-'),ownedFailure=retained&&scenario.includes('failure');
  const readsAfterSettlement=replaced?2:retained&&!ownedFailure?2:1;
  metric('method replacement preserves independent board lifetime',await page.evaluate(()=>window.oldPanel===document.querySelector('.race-screen')&&window.oldRow===document.querySelector('.race-tournaments li')),!replaced);
  metric('operation change admits no board read',await page.evaluate(()=>window.probe.reads.length),replaced?2:1);
  if(withdrawn)metric('withdrawn native action is removed',await page.locator('.race-tournaments button').count(),0);
  else if(replaced){
   await page.locator('.race-tournaments button').click();await settle();
   metric('shared SDK gate prevents overlapping provider dialogs',await page.evaluate(()=>window.probe.native.length),1);
   metric('replacement remains unlocked after gate response',await page.locator('.race-tournaments button').isDisabled(),false);
   await page.locator('.race-error').waitFor();
  }else{
   metric('original barrier survives committed operation replacement',await page.locator('.race-tournaments button').isDisabled(),true);
   await page.locator('.race-tournaments button').evaluate(button=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await settle();
   metric('repeated action admits only original share',await page.evaluate(()=>window.probe.shares.filter(x=>x.phase==='admission').length),1);
  }
  await page.evaluate(()=>window.finishNative());await settle();
  metric('retired native feedback cannot affect current board',await page.locator('.race-error').count(),replaced||ownedFailure?1:0);
  metric('only still-owned native success refreshes standings',await page.evaluate(()=>window.probe.reads.length),readsAfterSettlement);
  metric('ordinary authority method retains receiver',await page.evaluate(()=>window.probe.reads.map(x=>x.receiver)),replaced?['board','replacement']:retained&&!ownedFailure?['board','board']:['board']);
  if(!withdrawn){
   metric('original settlement unlocks current action',await page.locator('.race-tournaments button').isDisabled(),false);
   await page.locator('.race-tournaments button').click();await settle();
   metric('next native operation uses current committed method',await page.evaluate(()=>window.probe.shares.filter(x=>x.phase==='admission').at(-1)?.tag),retained||scenario.startsWith('restore-')?'old':'fresh');
   metric('next native share can use released SDK dialog gate',await page.evaluate(()=>window.probe.native.length),scenario==='throw-failure'?1:2);
   metric('owned success refreshes current board',await page.evaluate(()=>window.probe.reads.length),readsAfterSettlement+1);
   metric('owned success removes previous feedback',await page.locator('.race-error').count(),0);
  }
  metric('no external provider traffic',external,[]);
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);
  metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  await page.screenshot({path:path.join(evidence,[width,height,scenario].join('-')+'.png')});await context.close();
 }
}finally{
 await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));
console.log(JSON.stringify({mode,engine,browserVersion,cases:new Set(observations.map(x=>[x.width,x.height,x.scenario].join(':'))).size,checks:observations.length,failures},null,2));
assert.equal(failures.length,0,'Only committed native share operations may apply board feedback');
