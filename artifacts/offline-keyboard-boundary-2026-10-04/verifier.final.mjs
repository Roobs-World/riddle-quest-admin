import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.OFFLINE_BOUNDARY_REACT_MODE??'development',baseline=process.env.OFFLINE_BOUNDARY_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.OFFLINE_BOUNDARY_REPORT_DIR??path.join(root,'../../artifacts/offline-keyboard-boundary-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/offline-keyboard-boundary-'));let server,browser;const observations=[];
try{
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
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
window.probe={boundaries:[],keys:new Set(),focus:new Set(),adds:0,removes:0,saves:[],guesses:[],completions:[],spends:[],errors:[],unhandled:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document),capture=x=>x===true||x?.capture===true;
document.addEventListener=(type,handler,options)=>{if(capture(options)&&(type==='keydown'||type==='focusin')){window.probe[type==='keydown'?'keys':'focus'].add(handler);window.probe.adds++;}return add(type,handler,options);};document.removeEventListener=(type,handler,options)=>{if(capture(options)&&(type==='keydown'||type==='focusin')){window.probe[type==='keydown'?'keys':'focus'].delete(handler);window.probe.removes++;}return remove(type,handler,options);};
window.setOnline=value=>{Object.defineProperty(navigator,'onLine',{configurable:true,value});window.dispatchEvent(new Event(value?'online':'offline'));};
const source=createFakeHostServices(),services={...source,submitGuess:input=>{window.probe.guesses.push(input);return source.submitGuess(input);},completeGame:input=>{window.probe.completions.push(input);return source.completeGame(input);},spendCoins:input=>{window.probe.spends.push(input);return source.spendCoins(input);}};
const session=createHostedPlaySession({hostServices:services,economyAvailable:true,raceAvailable:true,onPlayerDataChange:update=>window.probe.saves.push(update)});
const params=new URL(location.href).searchParams,scenario=params.get('scenario')??'disconnect',key=params.get('key')??'Tab';
function App(){const [stage,setStage]=React.useState(0),[epoch,setEpoch]=React.useState(0),boundary=React.useRef(false);
 React.useLayoutEffect(()=>{if(stage!==1||boundary.current)return;boundary.current=true;const emit=()=>{const dialog=document.querySelector('.offline-backdrop');if(key==='Focus')document.querySelector('[data-parent]')?.focus();const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});let reached=false,cancelled=false;const afterCapture=received=>{if(received===event){reached=true;cancelled=received.defaultPrevented;}};add('keydown',afterCapture,true);if(!params.has('noEmit')){if(scenario.endsWith('leased'))window.leasedKey?.(event);else document.dispatchEvent(event);}remove('keydown',afterCapture,true);window.probe.boundaries.push({visible:!!dialog,prevented:event.defaultPrevented,capturePrevented:reached?cancelled:null,keys:[...window.probe.keys].filter(handler=>!window.baseKeys.has(handler)).length,focus:window.probe.focus.size,focused:dialog===document.activeElement});};if(params.has('late'))requestAnimationFrame(()=>requestAnimationFrame(emit));else emit();},[stage]);
 return <><nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white'}}><button data-commit onClick={()=>{window.leasedKey=[...window.probe.keys].find(handler=>!window.baseKeys.has(handler));window.setOnline(scenario.startsWith('reconnect'));setStage(1);}}>Commit connection</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></nav><div data-stage={stage} data-epoch={epoch}><PlayHostApp session={session}/></div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'offline-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useOfflineDialog.ts'))return readFile(path.join(baseline,'offline.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.OFFLINE_BOUNDARY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.OFFLINE_BOUNDARY_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const surface of process.env.OFFLINE_BOUNDARY_SURFACES?.split(',')??['game','modal','race'])for(const scenario of process.env.OFFLINE_BOUNDARY_SCENARIOS?.split(',')??['disconnect','reconnect','reconnect-leased'])for(const key of process.env.OFFLINE_BOUNDARY_KEYS?.split(',')??['Tab','Escape','Enter','Backspace','t','Focus']){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const metric=(name,actual,expected)=>observations.push({surface,scenario,key,width,height,name,actual,expected});
 await page.goto(url+'/?scenario='+scenario+'&key='+key+(surface==='race'?'&harness=race':'')+(process.env.OFFLINE_BOUNDARY_NO_EMIT==='1'?'&noEmit=1':'')+(process.env.OFFLINE_BOUNDARY_LATE==='1'?'&late=1':''));await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();
 await page.keyboard.type('pi');await page.waitForFunction(()=>window.probe.saves.some(row=>row.activeGame?.currentLetters.join('')==='PI'));
 if(surface!=='game')await page.getByRole('button',{name:surface==='modal'?'Settings':'Multiplayer',exact:true}).click();await settle();
 await page.evaluate(()=>{window.baseKeys=new Set(window.probe.keys);});
 if(scenario.startsWith('reconnect')){await page.evaluate(()=>window.setOnline(false));await page.locator('.offline-backdrop').waitFor();await settle();}
 await page.locator('[data-commit]').click();await page.waitForFunction(()=>window.probe.boundaries.length===1);const row=await page.evaluate(()=>window.probe.boundaries[0]),offline=scenario.startsWith('disconnect'),emits=process.env.OFFLINE_BOUNDARY_NO_EMIT!=='1';
 metric('connection boundary has the committed visible alert',row.visible,offline);if(scenario.endsWith('leased'))metric('retired capture handler does not cancel the key',row.prevented,false);else if(emits)metric('capture phase admits only the current alert',row.capturePrevented,offline?key==='Tab'?true:key==='Focus'?false:null:false);else metric('omitted boundary key remains uncancelled',row.prevented,false);if(emits){metric('capture keyboard subscription follows the committed alert',row.keys,offline?1:0);metric('capture focus subscription follows the committed alert',row.focus,offline?1:0);if(offline&&(key==='Tab'||key==='Focus'))metric('first committed keyboard or focus event stays in the alert',row.focused,true);}
 if(process.env.OFFLINE_BOUNDARY_SMOKE!=='1'){
 const before=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);if(key==='Tab'){for(let i=0;i<32;i++)await page.locator('[data-parent]').click();metric('32 parent updates preserve capture registrations',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),before);await settle();await page.keyboard.press('Tab');metric('fresh Tab follows current alert ownership',await page.evaluate(()=>document.activeElement===document.querySelector('.offline-backdrop')),offline);await page.keyboard.press('Shift+Tab');metric('fresh reverse Tab follows current alert ownership',await page.evaluate(()=>document.activeElement===document.querySelector('.offline-backdrop')),offline);}
 metric('keyboard boundary never submits an authoritative guess',await page.evaluate(()=>window.probe.guesses),[]);metric('keyboard boundary never infers a completion',await page.evaluate(()=>window.probe.completions),[]);metric('keyboard boundary never spends coins',await page.evaluate(()=>window.probe.spends),[]);
 const draft=await page.evaluate(()=>window.probe.saves.filter(row=>row.activeGame).at(-1)?.activeGame.currentLetters.join(''));metric('draft follows admitted keyboard editing',draft,!offline&&!scenario.endsWith('leased')&&surface==='game'&&emits&&key==='t'?'PIT':!offline&&!scenario.endsWith('leased')&&surface==='game'&&emits&&key==='Backspace'?'P':'PI');
 }
 metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[surface,scenario,key,width,height].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.OFFLINE_BOUNDARY_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.OFFLINE_BOUNDARY_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Offline keyboard commitment');
