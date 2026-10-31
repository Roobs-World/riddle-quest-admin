import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.GUIDANCE_RECOVERY_REACT_MODE??'development',baseline=process.env.GUIDANCE_RECOVERY_BASELINE_DIR;
const output=path.resolve(process.env.GUIDANCE_RECOVERY_REPORT_DIR??path.join(root,'../../builds/test-evidence/guidance-storage-recovery-2026-10-03',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/guidance-storage-'));
let browser,server;const observations=[];
try {
 const source=`
import {createTooltipTourStorageKey} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
window.guidanceKeys={game:createTooltipTourStorageKey('gameTour','reddit-guest'),profile:createTooltipTourStorageKey('profileTour','reddit-guest')};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
const local=window.localStorage,session=window.sessionStorage,nativeSet=Storage.prototype.setItem,nativeGet=Storage.prototype.getItem,key='riddleQuestRedditGuestV1';
const params=new URL(location.href).searchParams;
window.probe={fault:params.has('healthy')?'none':params.get('fault')??'quota',messages:[],errors:[],unhandled:[],paths:[],sessions:0};
if(!local.getItem(key))local.setItem(key,JSON.stringify({preferences:{locale:'en',muted:true,reducedMotion:true,onboardingComplete:false},playerData:null}));
local.setItem('appLanguage','en');
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));
window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
window.addEventListener('riddle-quest:game-to-host',e=>window.probe.messages.push(e.detail.type));
Object.defineProperty(window,'localStorage',{configurable:true,get(){if(window.probe.fault==='getters')throw new DOMException('Blocked','SecurityError');return local;}});
Object.defineProperty(window,'sessionStorage',{configurable:true,get(){if(window.probe.fault==='getters')throw new DOMException('Blocked','SecurityError');return session;}});
Storage.prototype.setItem=function(k,v){if((this===local||this===session)&&(window.probe.fault==='quota'||(window.probe.fault==='markers'&&/^riddleQuest:(tooltip|welcomeSession)/.test(k))))throw new DOMException('Full','QuotaExceededError');return nativeSet.call(this,k,v);};
window.marker=(area,k)=>nativeGet.call(area==='local'?local:session,k);
window.durable=()=>JSON.parse(nativeGet.call(local,key));
window.setFault=value=>window.probe.fault=value;
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url??String(input);if(url.startsWith('/api/')){window.probe.paths.push(url);if(url==='/api/session'){window.probe.sessions++;return Response.json({ok:true,authenticated:false});}throw new Error('unexpected-guest-api:'+url);}return nativeFetch(input,init);};
globalThis.devvit={context:{},entrypoints:{game:location.origin+'/game.html'},token:'injected-browser-fixture',webViewMode:2};
await import(${JSON.stringify(path.join(root,'src/reddit/main.tsx'))});
`;
 await writeFile(path.join(scratch,'main.ts'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.ts"></script></body></html>');
 await build({root:scratch,base:'./',configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-guidance',async load(id){if(baseline&&id.endsWith('/GuidanceOverlay.tsx'))return readFile(path.join(baseline,'GuidanceOverlay.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const url='http://127.0.0.1:'+server.address().port;
 if(process.env.GUIDANCE_RECOVERY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(r=>{process.once('SIGINT',r);process.once('SIGTERM',r);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of [[390,844],[390,568],[1280,844]])for(const fault of ['quota','getters']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>{observations.push({width,height,fault,name,actual,expected});if(!baseline)assert.deepEqual(actual,expected,name);};
  await page.goto(url+'?fault='+fault);await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  const sessions=await page.evaluate(()=>window.probe.sessions);
  // A bounded native sequence also exposes the original welcome/tour repetition under either fault.
  for(let step=0;step<(baseline?8:3);step++){
   const welcome=page.locator('.onboarding-card .play-primary'),tour=page.locator('.tooltip-card .play-primary');
   if(await welcome.isVisible())await welcome.click();else if(await tour.isVisible())await tour.click();else break;
   await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);
  metric('completed introductory guidance releases the game',await page.locator('.onboarding-card,.tooltip-card').count(),0);
  if(baseline){await context.close();continue;}
  metric('failed game-tour marker has no durability acknowledgement',await page.evaluate(()=>window.marker('local',window.guidanceKeys.game)),null);
  // Guess journals need durable storage. Keep rejecting only presentation markers for the following real gameplay.
  await page.evaluate(()=>window.setFault('markers'));
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('ppppp');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.probe.messages.filter(x=>x==='game:submitGuess').length===1);
  await page.waitForTimeout(300);
  metric('unavailable paid-hint guidance stays absent',await page.locator('.tooltip-card').count(),0);
  await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('qqqqq');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.probe.messages.filter(x=>x==='game:submitGuess').length===2);await page.waitForTimeout(500);
  metric('a second wrong answer remains playable',await page.evaluate(()=>window.probe.messages.filter(x=>x==='game:submitGuess').length),2);
  metric('the contextual marker suppresses repetition after another answer',await page.locator('.tooltip-card').count(),0);
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.locator('.profile-page').waitFor();await page.locator('.tooltip-card').waitFor();
  for(let step=0;step<8;step++){await page.locator('.tooltip-card .play-primary').click();await page.waitForTimeout(80);}
  await page.waitForTimeout(600);
  metric('completed profile guidance releases its page',await page.locator('.tooltip-card').count(),0);
  metric('failed profile marker has no durability acknowledgement',await page.evaluate(()=>window.marker('local',window.guidanceKeys.profile)),null);
  await page.locator('.game-modal .modal-x').scrollIntoViewIfNeeded();
  metric('profile Close is visible and reachable below the guest banner',await page.locator('.game-modal .modal-x').evaluate(button=>{const r=button.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.top>=0&&r.bottom<=innerHeight&&button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
  await page.locator('.game-modal .modal-x').click();await page.locator('.profile-page').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.locator('.profile-page').waitFor();await page.waitForTimeout(600);
  metric('reopening profile does not repeat its completed tour',await page.locator('.tooltip-card').count(),0);
  await page.locator('.game-modal .modal-x').click();await page.locator('.profile-page').waitFor({state:'hidden'});
  await page.evaluate(()=>window.setFault('none'));
  if(await page.locator('.player-save-notice button').isVisible())await page.locator('.player-save-notice button').click();
  await page.waitForFunction(()=>window.durable()?.playerData?.activeGame?.guesses.length===2&&window.durable().preferences.onboardingComplete===true);
  metric('real player progress still requires and receives storage recovery',await page.evaluate(()=>window.durable().playerData.activeGame.guesses.length),2);
  metric('guidance completion does not restart provider initialization',await page.evaluate(()=>window.probe.sessions),sessions);
  metric('guest progress remains non-economic',await page.evaluate(()=>({coins:window.durable().playerData.profile.coins,xp:window.durable().playerData.profile.xp})),{coins:0,xp:0});
  metric('only the guest same-origin session gateway is requested',await page.evaluate(()=>window.probe.paths.every(x=>x==='/api/session')),true);
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled rejection',await page.evaluate(()=>window.probe.unhandled),[]);
  await page.screenshot({path:path.join(output,`${width}-${height}-${fault}-playable.png`)});
  await page.goto(url+'?fault='+fault+'&healthy=1');await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();
  // A replacement view honestly reads the still-missing tour marker. Its healthy completion must end normally.
  await page.locator('.onboarding-card .play-primary').click();
  await page.locator('.tooltip-card .play-primary').click();
  await page.waitForTimeout(300);
  metric('replacement view can complete its genuinely unsaved tour',await page.locator('.tooltip-card').count(),0);
  metric('healthy replacement completion saves the browser marker',await page.evaluate(()=>window.marker('local',window.guidanceKeys.game)),'seen');
  metric('replacement retains the acknowledged gameplay history',await page.evaluate(()=>window.durable().playerData.activeGame.guesses.length),2);
  metric('replacement displays both restored guesses with truthful feedback',await page.evaluate(()=>[...document.querySelectorAll('.guess-row')].slice(0,2).map(row=>({guess:[...row.querySelectorAll('.cell')].map(cell=>cell.textContent).join(''),feedback:[...row.querySelectorAll('.cell')].map(cell=>['green','yellow','red'].find(status=>cell.classList.contains(status)))}))),[{guess:'ppppp',feedback:['green','red','red','red','red']},{guess:'qqqqq',feedback:['red','red','red','red','red']}]);
  await context.close();
 }
 }
}finally{
 if(browser)for(const context of browser.contexts())for(const page of context.pages())await writeFile(path.join(output,'last-open-page.json'),JSON.stringify(await page.evaluate(()=>({body:document.body.innerText,probe:window.probe,durable:window.durable?.(),draft:window.draft?.()})).catch(e=>({error:String(e)})),null,2));
 await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));
}
console.log(JSON.stringify({mode,baseline:!!baseline,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
