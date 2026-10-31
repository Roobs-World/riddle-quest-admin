import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
const portal=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.env.RACE_OPTIONS_REPORT_DIR??path.join(portal,'../../builds/test-evidence/race-options-commit-2026-10-08/permanent'));
await mkdir(output,{recursive:true});
await mkdir(path.join(portal,'node_modules/.cache'),{recursive:true});
const mode=process.env.RACE_OPTIONS_REACT_MODE??'development';assert(['development','production'].includes(mode));
const {build}=await import('vite');
const {chromium}=await import('@playwright/test');
const scratch=await mkdtemp(path.join(portal,'node_modules/.cache/race-options-commit-'));let browser,server;const rows=[];
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<div id="root"></div><script type="module" src="/main.tsx"></script>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React,{Suspense,startTransition} from 'react';import {createRoot} from 'react-dom/client';
import {useRaceSession} from ${JSON.stringify(path.join(portal,'src/play/race/hooks/useRaceSession.ts'))};
window.commands=[];window.attempts=[];const stalled=new Promise(()=>{});
function Surface({adapter}){const {session,state}=useRaceSession({ownerId:'owner',locale:'en'},{postToHost:message=>{window.commands.push({adapter,type:message.type});if(message.type==='game:listRaceCategories')queueMicrotask(()=>window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:false,error:'RaceTo10.ERROR_GENERIC'}}})));}});window.attempts.push(adapter);if(adapter==='speculative')throw stalled;return <div data-committed={adapter}><button onClick={()=>session.retry()}>Retry</button><p>{state.error}</p></div>;}
function App(){const [adapter,setAdapter]=React.useState('original');window.speculate=()=>startTransition(()=>setAdapter('speculative'));window.commit=()=>setAdapter('replacement');return <Suspense fallback={<p>Waiting</p>}><Surface adapter={adapter}/></Suspense>;}
createRoot(document.querySelector('#root')).render(<App/>);
 `);
 await build({root:scratch,configFile:false,logLevel:'error',plugins:process.env.RACE_OPTIONS_BASELINE_FILE?[{name:'race-options-baseline',enforce:'pre',load(id){if(id.endsWith('/hooks/useRaceSession.ts'))return readFile(process.env.RACE_OPTIONS_BASELINE_FILE,'utf8');}}]:[],define:{'process.env.NODE_ENV':JSON.stringify(mode)},build:{outDir:'dist'}});
 server=createServer(async(req,res)=>{try {const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.getByText('RaceTo10.ERROR_GENERIC').waitFor();await page.evaluate(()=>window.speculate());await page.waitForFunction(()=>window.attempts.includes('speculative'));assert.equal(await page.locator('[data-committed]').getAttribute('data-committed'),'original');await page.getByRole('button',{name:'Retry'}).click();await page.waitForFunction(()=>window.commands.length>=2);const actual=await page.evaluate(()=>window.commands.at(-1));rows.push({name:'committed retry retains its committed adapter during abandoned render',actual:actual.adapter,expected:'original'});await page.evaluate(()=>window.commit());await page.locator('[data-committed="replacement"]').waitFor();await page.getByRole('button',{name:'Retry'}).click();await page.waitForFunction(()=>window.commands.length>=3);rows.push({name:'committed replacement receives subsequent retry',actual:await page.evaluate(()=>window.commands.at(-1).adapter),expected:'replacement'});
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});await writeFile(path.join(output,'observations-'+(process.env.RACE_OPTIONS_REACT_MODE??'development')+'.json'),JSON.stringify(rows,null,2)+'\n');}
console.log(JSON.stringify(rows,null,2));assert(rows.every(x=>x.actual===x.expected),'Race callbacks must belong to the committed render');
