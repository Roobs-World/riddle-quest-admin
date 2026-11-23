import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),mode=process.env.ONLINE_COMMIT_REACT_MODE??'development',baseline=process.env.ONLINE_COMMIT_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.ONLINE_COMMIT_REPORT_DIR??path.join(root,'builds/test-evidence/online-status-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});const scratch=await mkdtemp(path.join(root,'node_modules/.cache/online-status-commit-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {GameFrameApp} from ${JSON.stringify(path.join(root,"src/gameplay/components/GameFrameApp.tsx"))};
import {BridgeStartupRecovery} from ${JSON.stringify(path.join(root,"src/app/components/recovery/BridgeStartupRecovery.tsx"))};
import {PlayerSaveRecoveryLayout} from ${JSON.stringify(path.join(root,"src/accounts/components/recovery/PlayerSaveRecoveryLayout.tsx"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const params=new URL(location.href).searchParams,surface=params.get('surface')??'frame',scenario=params.get('scenario')??'disconnect',noop=()=>{};
window.probe={changes:[],onlineListeners:new Set(),offlineListeners:new Set(),adds:0,removes:0,reloads:0,wakes:0,commands:[],errors:[],unhandled:[]};window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
window.addEventListener=(type,handler,...rest)=>{if(type==='online'||type==='offline'){window.probe[type+'Listeners'].add(handler);window.probe.adds++;}return add(type,handler,...rest);};window.removeEventListener=(type,handler,...rest)=>{if(type==='online'||type==='offline'){window.probe[type+'Listeners'].delete(handler);window.probe.removes++;}return remove(type,handler,...rest);};
window.setOnline=(value,emit=true)=>{Object.defineProperty(navigator,'onLine',{configurable:true,value});window.probe.changes.push({value,emit});if(emit)window.dispatchEvent(new Event(value?'online':'offline'));};
window.setOnline(scenario.startsWith('reconnect')?false:true,false);
window.addEventListener('riddle-quest:game-to-host',event=>window.probe.commands.push(event.detail.type));
const recovery={subscribe:()=>noop,getSnapshot:()=> 'unsaved',wake:()=>window.probe.wakes++};
function EarlierSignal(){const sent=React.useRef(false);React.useLayoutEffect(()=>{if(sent.current)return;sent.current=true;window.setOnline(scenario.startsWith('reconnect'),!params.has('noEvent'));},[]);return null;}
function App(){const [stage,setStage]=React.useState(0),[epoch,setEpoch]=React.useState(0),changed=React.useRef(false);
 React.useLayoutEffect(()=>{if(stage!==1||changed.current||scenario.endsWith('early'))return;changed.current=true;const change=()=>window.setOnline(scenario.startsWith('reconnect'),!params.has('noEvent'));if(params.has('noChange'))return;if(params.has('late'))requestAnimationFrame(()=>requestAnimationFrame(change));else change();},[stage]);
 return <><nav style={{position:'fixed',zIndex:10000,bottom:0,left:0,background:'white',display:'flex',flexWrap:'wrap',maxWidth:'100%'}}><button data-mount onClick={()=>setStage(1)}>Mount consumer</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button><button data-retire onClick={()=>setStage(2)}>Retire consumer</button></nav><div data-stage={stage} data-epoch={epoch}>{stage===1&&scenario.endsWith('early')?<EarlierSignal/>:null}{stage===1?surface==='frame'?<GameFrameApp localBridge economyAvailable={false} startupError="Fixture content pending"/>:surface==='bridge'?<BridgeStartupRecovery reload={()=>window.probe.reloads++}/>:<PlayerSaveRecoveryLayout recovery={recovery}><p>Fixture game remains mounted</p></PlayerSaveRecoveryLayout>:<p>Consumer absent</p>}</div></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,"src/commerce/components/ShopModalPage.tsx")}},plugins:[{name:'captured-online-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useOnlineStatus.ts'))return readFile(path.join(baseline,'online.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.ONLINE_COMMIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.ONLINE_COMMIT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const surface of process.env.ONLINE_COMMIT_SURFACES?.split(',')??['frame','bridge','save'])for(const scenario of process.env.ONLINE_COMMIT_SCENARIOS?.split(',')??['disconnect','reconnect','disconnect-early','reconnect-early']){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const metric=(name,actual,expected)=>observations.push({surface,scenario,width,height,name,actual,expected});
 await page.goto(url+'/?surface='+surface+'&scenario='+scenario+(process.env.ONLINE_COMMIT_NO_EVENT==='1'?'&noEvent=1':'')+(process.env.ONLINE_COMMIT_LATE==='1'?'&late=1':'')+(process.env.ONLINE_COMMIT_NO_CHANGE==='1'?'&noChange=1':''));await page.locator('[data-mount]').click();await settle();await settle();
 const online=process.env.ONLINE_COMMIT_NO_CHANGE==='1'?!scenario.startsWith('reconnect'):scenario.startsWith('reconnect');const current=()=>page.evaluate(surface=>surface==='frame'?!document.querySelector('.offline-backdrop'):!document.querySelector(surface==='bridge'?'.bridge-startup-recovery button':'.player-save-notice button')?.disabled,surface);
 metric('mounted consumer follows current browser connectivity',await current(),online);metric('fixture connectivity is authoritative',await page.evaluate(()=>navigator.onLine),online);
 if(process.env.ONLINE_COMMIT_SMOKE!=='1'){
 const before=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);for(let i=0;i<32;i++)await page.locator('[data-parent]').click();metric('parent updates preserve browser signal subscriptions',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),before);metric('parent updates preserve current connectivity',await current(),online);
 for(const value of [!online,online]){await page.evaluate(value=>window.setOnline(value),value);await settle();metric('ordinary connection events reconcile the mounted consumer',await current(),value);}
 if(surface==='bridge'&&online){await page.locator('.bridge-startup-recovery button').click();metric('online recovery invokes one explicit reload',await page.evaluate(()=>window.probe.reloads),1);await page.keyboard.press('Enter');metric('busy retry excludes a repeated native activation',await page.evaluate(()=>window.probe.reloads),1);}else if(surface==='save'&&online){await page.locator('.player-save-notice button').click();metric('online save recovery invokes its target-owned wake',await page.evaluate(()=>window.probe.wakes),1);}else if(surface==='frame'&&online){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('.game-modal').waitFor();await page.keyboard.press('Escape');await page.locator('.game-modal').waitFor({state:'detached'});metric('connected frame recovery Settings remains navigable',await page.locator('.offline-backdrop').count(),0);}else{metric('offline mount never automatically reloads or retries',await page.evaluate(()=>[window.probe.reloads,window.probe.wakes]),[0,0]);}
 await page.locator('[data-retire]').click();await settle();metric('retired consumer releases online listeners',await page.evaluate(()=>window.probe.onlineListeners.size),0);metric('retired consumer releases offline listeners',await page.evaluate(()=>window.probe.offlineListeners.size),0);
 }
 metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[surface,scenario,width,height].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.ONLINE_COMMIT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.ONLINE_COMMIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Committed browser connectivity');
