import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {build} from '../../packages/portal/node_modules/vite/dist/node/index.js';
import {chromium} from '../../packages/portal/node_modules/@playwright/test/index.mjs';
const repo=process.cwd(),portal=path.join(repo,'packages/portal'),output=path.join(repo,'artifacts/host-riddle-commit-retirement-2026-10-06');
const mode=process.env.HOST_COMMIT_MODE??'development';await mkdir(path.join(portal,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/host-commit-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useHostRiddleLifecycle} from ${JSON.stringify(path.join(portal,'src/play/useHostRiddleLifecycle.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(portal,'src/play/fakeServices.ts'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={posts:[],operations:[],notices:[],reads:[],errors:[],unhandled:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const scenario=new URLSearchParams(location.search).get('scenario'),fixture=createFakeHostServices(),riddle=await fixture.loadRiddle({gameMode:'classic',locale:'en'});
let release;const held=new Promise(resolve=>release=()=>resolve(riddle));
const oldServices={loadRiddle:input=>{window.probe.reads.push(input);return held;}},nextServices={loadRiddle:input=>{window.probe.reads.push(input);return Promise.resolve({...riddle,text:'Replacement content',sessionToken:'00000000-0000-4000-8000-000000000099'});}};
const postToGame=message=>window.probe.posts.push({committed:document.querySelector('[data-epoch]')?.getAttribute('data-epoch'),message}),postOperation=(...args)=>window.probe.operations.push(args),setNotice=notice=>window.probe.notices.push(notice),withActivity=operation=>operation(),onRecoveryAttempt=()=>{},onPlayable=()=>{};
function App(){const [epoch,setEpoch]=React.useState(0);window.replace=()=>setEpoch(1);
 const locale=scenario==='locale'&&epoch?'fr':'en',owner=scenario==='owner'&&epoch?'Bob':'Alice',services=scenario==='provider'&&epoch?nextServices:oldServices;
 const lifecycle=useHostRiddleLifecycle({userId:owner,accountGeneration:epoch&&scenario==='generation'?2:1,profile:{coins:100},initialGameMode:'classic',locale,services,withActivity,postToGame,postOperation,configurationWarning:null,setNotice,onRecoveryAttempt,onPlayable});
 React.useLayoutEffect(()=>{if(epoch){window.probe.committed=true;release();}},[epoch]);
 React.useEffect(()=>{if(!epoch){window.oldResult=lifecycle.loadRiddle({gameMode:'classic',locale:'en'},'old-read').then(value=>{window.probe.accepted=value;return value;});}},[]);
 return <div data-epoch={epoch} data-owner={owner} data-locale={locale}>{String(lifecycle.startupComplete)}</div>;
}
createRoot(document.querySelector('#root')).render(<App/>);
`);
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const scenario of ['locale','owner','generation','provider']){
  const context=await browser.newContext(),page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/?scenario='+scenario);await page.waitForFunction(()=>window.probe.reads.length===1);await page.evaluate(()=>window.replace());await page.waitForFunction(()=>window.probe.accepted!==undefined);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  observations.push({scenario,...await page.evaluate(()=>({accepted:window.probe.accepted,posts:window.probe.posts,operations:window.probe.operations,errors:window.probe.errors,unhandled:window.probe.unhandled}))});await context.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'probe-'+mode+'.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify(observations));assert.ok(observations.every(row=>!row.accepted&&row.posts.length===0&&row.operations.length===0&&row.errors.length===0&&row.unhandled.length===0),'Committed context replacement must retire the old read');
