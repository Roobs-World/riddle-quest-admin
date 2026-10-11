/** Native tournament sharing exercises committed UI ownership through the real Facebook dialog adapter. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('/home/craig-beswetherick/Documents/riddle-quest/packages/portal/package.json');
const {build}=await import(require.resolve('vite'));
const {chromium,firefox}=require('@playwright/test');
const engine=process.env.SHARE_RETIREMENT_BROWSER??'chromium',mode=process.env.SHARE_RETIREMENT_MODE??'development';
const portal='/home/craig-beswetherick/Documents/riddle-quest/packages/portal';
const evidence=path.resolve(process.env.SHARE_RETIREMENT_REPORT_DIR??path.join(portal,'../../artifacts/live-tournament-share-retirement-2026-10-08',engine+'-'+mode));
await mkdir(evidence,{recursive:true});
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/share-retirement-probe-'));
let browser,server,browserVersion;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTournamentEntry} from ${JSON.stringify(path.join(portal,'src/play/race/RaceTournamentEntry.tsx'))};import {createFacebookTournamentPresentation} from ${JSON.stringify(path.join(portal,'src/facebook/FacebookTournamentPresentation.ts'))};import {createFacebookNotificationCapability} from ${JSON.stringify(path.join(portal,'src/facebook/FacebookNotificationCapability.ts'))};import {ListFacebookTournamentResponseSchema} from '@qwordly/core/race';import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal,'src/play/playerPreferences.ts'))};import ${JSON.stringify(path.join(portal,'src/styles.css'))};
const nativeSetTimeout=window.setTimeout.bind(window),nativeClearTimeout=window.clearTimeout.bind(window),waits=new Map();window.setTimeout=(callback,delay,...args)=>{if(delay!==8000)return nativeSetTimeout(callback,delay,...args);const id=nativeSetTimeout(()=>{waits.delete(id);callback(...args);},120000);waits.set(id,()=>callback(...args));return id;};window.clearTimeout=id=>{waits.delete(id);nativeClearTimeout(id);};window.expirePreparation=()=>{for(const [id,callback] of [...waits]){waits.delete(id);nativeClearTimeout(id);callback();}};window.preparationTimers=()=>[...waits.keys()];
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});const scenario=new URLSearchParams(location.search).get('scenario');window.probe={reads:0,authority:0,lookups:0,native:[],notifications:0,permissionResults:[],shareResults:[],diagnostics:[],errors:[],unhandled:[],renders:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const startsAtMs=Math.floor(Date.now()/86400000)*86400000,endsAtMs=startsAtMs+86400000,tournamentId='facebook-race10-en-'+new Date(startsAtMs).toISOString().slice(0,10);let score=9000,active=true,consumed=false,subscribed=false,dialogConsumed=false;const dialog=scenario.startsWith('dialog-'),quick=scenario==='early-success',create=scenario==='create-timeout'||scenario==='dialog-create';
function board(){const currentPlayer={rank:1,adjustedTimeMs:score,isCurrentPlayer:true};return ListFacebookTournamentResponseSchema.parse({tournamentId,locale:'en',startsAtMs,endsAtMs,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[currentPlayer],currentPlayer});}const data={kind:'rq-race10-tournament-v1',locale:'en',tournamentId,startsAtMs,endsAtMs},native={getID:()=> 'native-fixture',getContextID:()=> 'context-fixture',getEndTime:()=>endsAtMs/1000,getPayload:()=>data};
function held(kind,value){return new Promise((resolve,reject)=>{let done=false;window[kind==='standings'?'finishStandings':'finishMetadata']=()=>{if(done)return;done=true;scenario.endsWith('-rejection')?reject(new Error('Late original preparation failure')):create&&kind==='metadata'?reject({code:'TOURNAMENT_NOT_FOUND'}):resolve(value);};});}
function nativeDialog(kind,input){window.probe.native.push({kind,score:kind==='create'?input.initialScore:input.score});if(!dialog||dialogConsumed)return Promise.resolve(kind==='create'?native:undefined);dialogConsumed=true;return new Promise((resolve,reject)=>{let done=false;window.finishDialog=()=>{if(done)return;done=true;if(scenario==='dialog-failure')reject(new Error('Original native dialog failure'));else if(scenario==='dialog-cancelled')reject({code:'USER_CANCELLED'});else resolve(kind==='create'?native:undefined);};});}
const sdk={getSupportedAPIs:()=>['getTournamentAsync','tournament.createAsync','tournament.shareAsync','tournament.postScoreAsync','player.canSubscribeBotAsync','player.isSubscribedBotAsync','player.subscribeBotAsync'],context:{getID:()=> 'context-fixture'},getTournamentAsync:()=>{window.probe.lookups++;if(!dialog&&!quick&&!consumed&&!scenario.includes('standings')&&window.probe.authority===1){consumed=true;return held('metadata',native);}return create?Promise.reject({code:'TOURNAMENT_NOT_FOUND'}):Promise.resolve(native);},tournament:{postScoreAsync:async()=>{},shareAsync:input=>nativeDialog('share',input),createAsync:input=>nativeDialog('create',input)},player:{isSubscribedBotAsync:async()=>subscribed,canSubscribeBotAsync:async()=>true,subscribeBotAsync:async()=>{window.probe.notifications++;subscribed=true;}}};
const nativePresentation=createFacebookTournamentPresentation({sdk,enabled:true,ageCategory:'13_plus',isActive:()=>active,getLocale:()=> 'en',renderImage:()=> 'data:image/png;base64,YQ==',list:()=>{window.probe.authority++;if(!dialog&&!quick&&(scenario.includes('standings')||scenario==='budget')&&window.probe.authority===1)return held('standings',board());return Promise.resolve(board());},reportFailure:error=>{window.probe.diagnostics.push(error.message);if(scenario==='telemetry')throw Error('Optional reporter unavailable');}}),notifications=createFacebookNotificationCapability(sdk),tournaments={list:async()=>{window.probe.reads++;return board();},record:async()=>{throw Error('Unexpected record');},share:async (locale,signal)=>{const result=await nativePresentation.share(locale,signal);window.probe.shareResults.push(result.status);return result;}};
window.restoreShare=()=>{active=true;score=7000;};const presentation={titleId:'preparation-fixture',analyticsScreen:'preparation_fixture',onRecordFailure:()=>{}},post=()=>{},never=new Promise(()=>{});function Suspend({held}){if(held)throw never;return null;}
function App(){const [closed,setClosed]=React.useState(false);const [coins,setCoins]=React.useState(100),[version,setVersion]=React.useState(0),[suspended,setSuspended]=React.useState(false);window.probe.renders.push({version,suspended});return <><button data-permission style={{position:'fixed',bottom:4,right:4,zIndex:2147483647}} onClick={()=>void notifications.requestPermission().then(result=>window.probe.permissionResults.push(result.status))}>Permission fixture</button><button data-retire style={{position:'fixed',bottom:124,left:4,zIndex:2147483647}} onClick={()=>{tournaments.share=async (locale,signal)=>nativePresentation.share(locale,signal);setCoins(800);}}>Retire fixture</button><button data-profile style={{position:'fixed',bottom:44,right:4,zIndex:2147483647}} onClick={()=>{if(scenario==='inactive')active=false;setCoins(800);setVersion(v=>v+1);}}>Profile fixture</button><button data-prepare style={{position:'fixed',bottom:4,left:4,zIndex:2147483647}} onClick={()=>React.startTransition(()=>{setVersion(v=>v+1);setSuspended(true);})}>Prepare fixture</button><button data-abandon style={{position:'fixed',bottom:44,left:4,zIndex:2147483647}} onClick={()=>{setSuspended(false);setCoins(800);}}>Abandon fixture</button><React.Suspense fallback={<output data-suspended>Suspended fixture</output>}><div data-version={version}>{!closed && <RaceTournamentEntry ownerId='fixture-player' locale='en' tournamentLocale='en' coins={coins} tournaments={tournaments} presentation={presentation} postToHost={post} onClose={()=>setClosed(true)}/>}<output data-closed={closed}/></div><Suspend held={suspended}/></React.Suspense></>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);

`);
 await build({root:scratch,configFile:false,publicDir:path.join(portal,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'share-baseline',enforce:'pre',async load(id){if(process.env.SHARE_RETIREMENT_BASELINE_FILE&&id.endsWith('/FacebookTournamentPresentation.ts'))return readFile(process.env.SHARE_RETIREMENT_BASELINE_FILE,'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'&&process.env.SHARE_RETIREMENT_FIREFOX_EXECUTABLE?{executablePath:process.env.SHARE_RETIREMENT_FIREFOX_EXECUTABLE}:{})});browserVersion=browser.version();
 const scenarios=['profile-metadata','abandon-metadata'];
 for(const [width,height] of process.env.SHARE_RETIREMENT_QUICK==='1'?[[390,844]]:[[390,568],[390,844],[1280,844]])for(const scenario of scenarios){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),external=[];
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort();});
 const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const permission=async()=>{const n=await page.evaluate(()=>window.probe.permissionResults.length);await page.locator('[data-permission]').click();await page.waitForFunction(n=>window.probe.permissionResults.length>n,n);return page.evaluate(()=>window.probe.permissionResults.at(-1));};
 await page.goto(origin+'/?scenario='+scenario);await page.locator('.race-tournaments li').waitFor();await page.locator('.race-tournaments button').click();
 await page.waitForFunction(()=>typeof window.finishStandings==='function'||typeof window.finishMetadata==='function'||typeof window.finishDialog==='function');
 metric('preparation or dialog owns shared gate',await permission(),'unavailable');
 if(scenario==='profile-metadata'){await page.locator('[data-profile]').click();await settle();}
 if(scenario==='abandon-metadata'){await page.locator('[data-prepare]').click();await page.waitForFunction(()=>window.probe.renders.some(x=>x.suspended));await page.locator('[data-abandon]').click();await settle();}
 metric('profile and abandoned render preserve admitted preparation',await permission(),'unavailable');
 metric('profile and abandoned render preserve original budget',await page.evaluate(()=>window.preparationTimers().length),1);
 const method=scenario.startsWith('method-');
 if(method)await page.locator('[data-retire]').click();else {await page.locator('.race-close').click();await page.locator('[data-closed=true]').waitFor({state:'attached'});}
 await settle();
 const dialog=scenario.startsWith('dialog-');
 metric('committed close removes board',await page.locator('.race-screen').count(),method?1:0);
 metric('closed preparation releases shared gate immediately',await permission(),dialog?'unavailable':'success');
 metric('closed preparation clears local budget',await page.evaluate(()=>window.preparationTimers().length),0);
 await page.evaluate(()=>{window.finishStandings?.();window.finishMetadata?.();});await settle();
 metric('closed preparation cannot admit obsolete native dialog',await page.evaluate(()=>window.probe.native.length),dialog?1:0);
 metric('closed standings cannot admit subsequent metadata',await page.evaluate(()=>window.probe.lookups),scenario.includes('standings')?0:1);
 if(dialog){await page.evaluate(()=>window.finishDialog());await page.waitForFunction(()=>window.probe.shareResults.length===1);metric('admitted dialog releases only at natural settlement',await permission(),'success');}
 metric('no external provider traffic',external,[]);metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
 await page.screenshot({path:path.join(evidence,[width,height,scenario].join('-')+'.png')});await context.close();
 }

}finally{
 await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));
console.log(JSON.stringify({mode,engine,browserVersion,cases:new Set(observations.map(x=>[x.width,x.height,x.scenario].join(':'))).size,checks:observations.length,failures},null,2));
assert.equal(failures.length,0,'Share preparation must release abandoned waits and retain admitted native dialog occupancy');
