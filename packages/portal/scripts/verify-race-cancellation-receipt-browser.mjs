import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-cancellation-receipt-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceTo10Game} from ${JSON.stringify(path.join(root,'src/play/race/RaceTo10Game.tsx'))};
const mode=new URLSearchParams(location.search).get('case');window.commands=[];window.testNow=0;Object.defineProperty(performance,'now',{value:()=>window.testNow});
const invitation={claimState:'unclaimed',publicationState:'pending',role:'creator',canCancel:true,expiresAtMs:1000000};
const preview={challengeId:'original',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:1000000};
function view(status){if(status==='unavailable')return {status,reason:'missing',serverNowMs:10020};return status==='ready'?{status,challenge:preview,existingRunId:'foreign-run',serverNowMs:10020}:{status,invitation:{...invitation,canCancel:status==='cancelled'?false:true},serverNowMs:10020};}
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:getRaceEntry')reply(message,'raceEntry',window.commands.filter(m=>m.type==='game:getRaceEntry').length===1?view('waiting'):view(mode.startsWith('revive-')?mode.slice(7):'waiting'));
 if(message.type==='game:cancelRaceInvite')reply(message,'raceInviteCancel',view(mode.startsWith('revive')||mode==='control'?'cancelled':mode));
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" challengeId="original" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-waiting-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const mode of ['waiting','ready','expired','unavailable','revive-waiting','revive-ready','revive-expired','revive-unavailable','control']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+mode);
  await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().entryStatus?.status==='waiting'&&!window.testRaceSession.getSnapshot().pending);
  await page.locator('.race-challenge-card .race-secondary').click();
  if(mode.startsWith('revive'))await page.evaluate(()=>window.testRaceSession.retry());
  const actual=await page.evaluate(()=>{const state=window.testRaceSession.getSnapshot();return {status:state.entryStatus?.status,error:state.error,pending:state.pending,resumes:window.commands.filter(m=>m.type==='game:resumeRace').length};});
  if(mode.startsWith('revive')||mode==='control')assert.deepEqual(actual,{status:'cancelled',error:null,pending:null,resumes:0});
  else{assert.deepEqual(actual,{status:'waiting',error:'RaceTo10.ERROR_INVALID_RESPONSE',pending:null,resumes:0});assert.equal(await page.getByRole('alert').count(),1);}
  if(mode==='control'){await page.evaluate(()=>{window.testNow=10000;window.testRaceSession.tick();window.testRaceSession.cancelInvitation();});assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:getRaceEntry'||m.type==='game:cancelRaceInvite').length),2);}
  assert.deepEqual(errors,[]);console.log('Cancellation receipt passed: '+mode+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
