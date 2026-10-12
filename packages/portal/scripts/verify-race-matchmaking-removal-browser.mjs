/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-matchmaking-removal-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@qwordly/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,'src/play/race/logic/racePresentation.ts'))};
import {tr} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
const now=Date.now(),run={runId:'fallback-run',role:'challenger',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:10,wallElapsedMs:60000,totalPenaltyMs:0,adjustedElapsedMs:60000,currentRiddle:null,events:[],serverNowMs:now,startsAtMs:now-60000,opponent:{displayName:'Nova',adjustedFinishMs:120000,events:[]}};
window.commands=[];window.finds=[];window.label=tr('RaceTo10.MATCH_PLAYER');
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);if(message.type==='game:listRaceCategories')reply(message,'raceCategories',{categories:[],rules:RACE_RULES});if(message.type==='game:startRace')reply(message,'raceStart',{run});if(message.type==='game:getRaceOutcome')reply(message,'raceOutcome',projectRaceOutcome(run,60000));}
const first={find:async request=>{window.finds.push({name:'first',request});return {status:'success',value:{status:'empty',locale:'en',fallback:{offerId:'a'.repeat(64),categoryId:'mixed'}}};}};
const second={find:async request=>{window.finds.push({name:'second',request});return {status:'cancelled'};}};
function App(){const [adapter,setAdapter]=React.useState(first);window.changeProvider=mode=>setAdapter(mode==='replaced'?second:undefined);return <RaceTo10Game ownerId="owner-1" locale="en" coins={100} matchmaking={adapter} postToHost={postToHost} onClose={()=>{}}/>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser,server;
try{
 await build({root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['removed','replaced']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const label=await page.evaluate(()=>window.label);await page.getByRole('button',{name:label,exact:true}).click();
  await page.locator('.race-rematch-actions .race-primary').waitFor();
  await page.evaluate(mode=>window.changeProvider(mode),mode);
  await page.locator('.race-rematch-actions .race-primary').click();
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,50)));
  const finds=await page.evaluate(()=>window.finds);
  assert.deepEqual(finds.map(find=>find.name),mode==='removed'?['first']:['first','second'],'fallback rematch revived the retired adapter');
  assert.equal(await page.evaluate(()=>window.commands.filter(message=>message.type==='game:startRace').length),1,'provider replacement started an unintended fallback race');
  if(mode==='replaced')assert.notEqual(finds[0].request.requestId,finds[1].request.requestId,'fresh rival intent reused the previous search receipt');
  assert.deepEqual(errors,[]);console.log('Matchmaking rematch ownership passed: '+mode+' at '+width+'px.');await context.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
