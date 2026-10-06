import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {build} from '../../packages/portal/node_modules/vite/dist/node/index.js';
import {chromium} from '../../packages/portal/node_modules/@playwright/test/index.mjs';
const portal=path.resolve('packages/portal'),output=path.resolve('artifacts/attempt-recovery-commit-retirement-2026-10-06'),mode=process.env.ATTEMPT_PROBE_MODE??'development';
await mkdir(path.join(portal,'node_modules/.cache'),{recursive:true});const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/attempt-recovery-probe-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useAttemptRecovery} from ${JSON.stringify(path.join(portal,'src/play/game/hooks/useAttemptRecovery.ts'))};
import {gameSessionReducer,createInitialGameSession} from ${JSON.stringify(path.join(portal,'src/play/gameSession.ts'))};
import {ContinueModalPage} from ${JSON.stringify(path.join(portal,'src/play/modalPages/commerce/ContinueActions.tsx'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(portal,'src/play/fakeServices.ts'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;window.probe={requests:[],actions:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const kind=new URLSearchParams(location.search).get('kind'),fixture=createFakeHostServices(),profile=await fixture.loadProfile('jest-guest'),riddle={...await fixture.loadRiddle({gameMode:'classic',locale:'en'}),attemptsUsed:5,awaitingContinue:true};
const initial=gameSessionReducer(gameSessionReducer(createInitialGameSession(),{type:'hostInit',user:{uid:'Alice',isAnonymous:true,accountGeneration:1},profile,locale:'en',gameMode:'classic',products:[]}),{type:'loadRiddle',riddle});
let finishOld,finishNew;const heldOld=new Promise(resolve=>finishOld=()=>resolve({status:'success',value:{newCoins:900}})),heldNew=new Promise(resolve=>finishNew=()=>resolve({status:'success',value:{newCoins:350}}));
const oldCapability={request:input=>{window.probe.requests.push({provider:1,...input});return heldOld;}},newCapability={request:input=>{window.probe.requests.push({provider:2,...input});return heldNew;}};
function App(){const [epoch,setEpoch]=React.useState(0),[state,reduce]=React.useReducer(gameSessionReducer,initial),stateRef=React.useRef(state);stateRef.current=state;
 const dispatch=React.useCallback(action=>{window.probe.actions.push(action);reduce(action);},[]),recovery=useAttemptRecovery({capability:epoch?newCapability:oldCapability,state,stateRef,dispatch});
 React.useLayoutEffect(()=>{window.replace=()=>setEpoch(1);window.request=()=>recovery.request();window.finishOld=finishOld;window.finishNew=finishNew;},[epoch,recovery.request]);
 React.useLayoutEffect(()=>{if(epoch&&kind!=='provider'){reduce({type:'authState',user:{uid:kind==='account'?'Bob':'Alice',isAnonymous:true,accountGeneration:kind==='generation'?2:1},profile});reduce({type:'loadRiddle',riddle:{...riddle,sessionToken:'00000000-0000-4000-8000-000000000002'}});}},[epoch]);
 return <div data-epoch={epoch} data-user={state.user?.uid} data-token={state.riddle?.sessionToken} data-modal={state.modal??'none'} data-pending={recovery.pending}><output>{state.profile?.coins}</output><ContinueModalPage balance={state.profile?.coins??0} onRecoverAttempt={()=>{window.requestResult=recovery.request();}} pending={recovery.pending} onContinue={()=>{}} onSkip={()=>{}} onOpenModal={()=>{}} commerceAvailable={false}/></div>;
}createRoot(document.querySelector('#root')).render(<App/>);
`);
let browser,server;const results=[];
try{await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode),'import.meta.env.VITE_PLATFORM_TARGET':JSON.stringify('facebook')},build:{outDir:'dist',target:'esnext',minify:false}});server=createServer(async(req,res)=>{try{const file=path.join(scratch,'dist',new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const kind of ['account','generation','provider']){const context=await browser.newContext(),page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/?kind='+kind);await page.locator('.loss-video-action').click();await page.waitForFunction(()=>window.probe.requests.length===1);await page.evaluate(()=>window.replace());await page.waitForFunction(()=>document.querySelector('[data-epoch]')?.dataset.epoch==='1'&&(new URLSearchParams(location.search).get('kind')==='provider'||document.querySelector('[data-token]')?.dataset.token.endsWith('2')));
 const enabled=await page.locator('.loss-video-action').isEnabled();await page.evaluate(()=>{void window.request();});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const newRequests=await page.evaluate(()=>window.probe.requests.filter(x=>x.provider===2).length);await page.evaluate(()=>window.finishOld());await page.evaluate(()=>window.requestResult);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));results.push({kind,enabled,newRequests,pendingAfterOldReceipt:await page.locator('[data-pending]').getAttribute('data-pending'),...await page.evaluate(()=>window.probe)});await context.close();}
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'probe-'+mode+'.json'),JSON.stringify(results,null,2)+'\n');}
console.log(JSON.stringify(results));assert.ok(results.every(x=>x.enabled&&x.newRequests===1&&x.pendingAfterOldReceipt==='true'&&x.errors.length===0&&x.unhandled.length===0),'New continuation context must be usable while retired provider work remains unresolved');
