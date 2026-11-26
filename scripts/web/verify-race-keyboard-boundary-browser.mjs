import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),mode=process.env.RACE_BOUNDARY_REACT_MODE??'development',baseline=process.env.RACE_BOUNDARY_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.RACE_BOUNDARY_REPORT_DIR??path.join(root,'builds/test-evidence/race-keyboard-boundary-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-keyboard-boundary-'));let server,browser;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,"src/races/components/recorded/RaceTo10Game.tsx"))};
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RaceActivity} from ${JSON.stringify(path.join(root,"src/races/components/history/RaceActivity.tsx"))};
import {RaceTournamentEntry} from ${JSON.stringify(path.join(root,"src/races/components/lobby/RaceTournamentEntry.tsx"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,"src/settings/browser/playerPreferences.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const params=new URL(location.href).searchParams,scenario=params.get('scenario')??'first-open',surface=params.get('surface')??'intro',noop=()=>{};
window.probe={closes:[],boundaries:[],listeners:new Set(),adds:0,removes:0,commands:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
document.addEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.adds++;window.probe.listeners.add(handler);}return add(type,handler,...rest);};document.removeEventListener=(type,handler,...rest)=>{if(type==='keydown'){window.probe.removes++;window.probe.listeners.delete(handler);}return remove(type,handler,...rest);};
const tournaments={list:async()=>({tournamentId:'fixture',locale:'en',startsAtMs:Date.now()-1000,endsAtMs:Date.now()+60000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,standings:[]}),record:async()=>({})};
function App(){const [stage,setStage]=React.useState(0),[epoch,setEpoch]=React.useState(0),boundary=React.useRef(false);
 const first=scenario.startsWith('first'),retired=scenario.startsWith('retire')&&stage===1,mounted=!(first&&stage===0)&&!retired,blocked=scenario==='cover'?stage===1:scenario==='uncover'?stage===0:false;
 React.useLayoutEffect(()=>{if(stage!==1||boundary.current)return;boundary.current=true;const emit=()=>{const panel=document.querySelector('.race-screen'),controls=panel?.querySelectorAll('button:not(:disabled),[href],[tabindex]:not([tabindex="-1"])');if(scenario==='first-tab')controls?.[controls.length-1]?.focus();const event=new KeyboardEvent('keydown',{key:scenario==='first-tab'?'Tab':'Escape',bubbles:true,cancelable:true});if(!params.has('noEmit')){if(scenario.endsWith('leased'))window.leasedListener?.(event);else document.dispatchEvent(event);}window.probe.boundaries.push({visible:!!panel,blocked:!!panel?.closest('[inert]'),prevented:event.defaultPrevented,listeners:window.probe.listeners.size,firstFocused:controls?.[0]===document.activeElement,closes:window.probe.closes.length});};if(params.has('late'))requestAnimationFrame(()=>requestAnimationFrame(emit));else emit();},[stage]);
 const postToHost=message=>{window.probe.commands.push(message.type);if(message.type==='game:listRaceCategories')window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:{categories:[],rules:RACE_RULES}}}}));};
 return <><nav style={{position:'fixed',zIndex:10000,top:0,left:0,background:'white'}}><button data-commit onClick={()=>{if(scenario.endsWith('leased'))window.leasedListener=[...window.probe.listeners][0];setStage(1);}}>Commit race visibility</button><button data-parent onClick={()=>setEpoch(x=>x+1)}>Update parent</button></nav>
 <main inert={blocked||undefined} data-stage={stage} data-epoch={epoch}>{mounted?surface==='intro'?<RaceTo10Game key={scenario==='replace-leased'?stage:0} locale="en" coins={100} ownerId="fixture-owner" postToHost={postToHost} onClose={()=>window.probe.closes.push({stage,epoch})} introNavigation={<button data-last>Fixture navigation</button>}/>:surface==='context'?<RaceActivity key={scenario==='replace-leased'?stage:0} locale="en" coins={100} postToHost={postToHost} onClose={()=>window.probe.closes.push({stage,epoch})} navigation={<button data-last>Fixture navigation</button>} presentation={{titleId:'fixture-context',analyticsScreen:'fixture',onRecordFailure:noop}}/>:<RaceTournamentEntry key={scenario==='replace-leased'?stage:0} locale="en" coins={100} postToHost={postToHost} onClose={()=>window.probe.closes.push({stage,epoch})} tournamentLocale="en" tournaments={tournaments} presentation={{titleId:'fixture-tournament',analyticsScreen:'fixture',onRecordFailure:noop}}/>:<p data-retired>Race absent</p>}</main></>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,"src/commerce/components/ShopModalPage.tsx")}},plugins:[{name:'captured-modal-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useRaceDialogFocus.ts'))return readFile(path.join(baseline,'focus.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.RACE_BOUNDARY_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.RACE_BOUNDARY_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const surface of process.env.RACE_BOUNDARY_SURFACES?.split(',')??['intro','context','tournament'])for(const scenario of process.env.RACE_BOUNDARY_SCENARIOS?.split(',')??['first-open','first-tab','cover','uncover','retire','retire-leased','replace-leased','stable']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),dialog=page.locator('.race-screen'),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const metric=(name,actual,expected)=>observations.push({width,height,surface,scenario,name,actual,expected});await page.goto(url+'/?scenario='+scenario+'&surface='+surface+(process.env.RACE_BOUNDARY_NO_EMIT==='1'?'&noEmit=1':'')+(process.env.RACE_BOUNDARY_LATE==='1'?'&late=1':''));await page.locator('[data-commit]').waitFor();if(!scenario.startsWith('first'))await dialog.waitFor();await settle();await page.locator('[data-commit]').click();await page.waitForFunction(()=>window.probe.boundaries.length===1);
  const active=!['cover','retire','retire-leased'].includes(scenario),emits=process.env.RACE_BOUNDARY_NO_EMIT!=='1',closes=emits&&active&&scenario!=='first-tab'&&!scenario.endsWith('leased')?1:0;
  metric('committed surface handles or yields boundary Escape',await page.evaluate(()=>window.probe.closes.length),closes);metric('only an active committed surface prevents the key',await page.evaluate(()=>window.probe.boundaries[0].prevented),active&&emits&&!scenario.endsWith('leased'));if(emits)metric('retired listeners are absent before parent layout keys',await page.evaluate(()=>window.probe.boundaries[0].listeners),scenario.startsWith('retire')?0:1);
  if(scenario==='first-tab')metric('first committed Tab wraps to the active first control',await page.evaluate(()=>window.probe.boundaries[0].firstFocused),true);
  if(process.env.RACE_BOUNDARY_SMOKE!=='1'){
   const before=await page.evaluate(()=>[window.probe.adds,window.probe.removes]);for(let i=0;i<32;i++)await page.locator('[data-parent]').click();metric('32 parent updates keep one stable keyboard registration',await page.evaluate(()=>[window.probe.adds,window.probe.removes]),before);await settle();await page.keyboard.press('Escape');metric('fresh native Escape follows current visible ownership',await page.evaluate(()=>window.probe.closes.length),closes+(active?1:0));if(active)metric('ordinary callback updates follow committed parent state',await page.evaluate(()=>window.probe.closes.at(-1)),{stage:1,epoch:32});
   if(active){const controls=dialog.locator('button:not(:disabled),[href],[tabindex]:not([tabindex="-1"])');await controls.last().focus();await page.keyboard.press('Tab');metric('fresh native Tab wraps to first',await controls.first().evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Shift+Tab');metric('fresh reverse Tab wraps to last',await controls.last().evaluate(el=>el===document.activeElement),true);}
  }
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[surface,scenario,width,height].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.RACE_BOUNDARY_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.RACE_BOUNDARY_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Committed multiplayer keyboard boundary');
