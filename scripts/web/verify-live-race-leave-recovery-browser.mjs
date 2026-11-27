import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.url),{RACE_RULES}=require("../../firebase-functions/lib/src/races/contracts/index.js");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-leave-'));
const output=path.resolve(process.env.LIVE_RACE_REPORT_DIR??path.join(root,'artifacts/live-leave-recovery'));
await mkdir(output,{recursive:true});
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
import {LiveRaceGame} from ${JSON.stringify(path.join(root,"src/races/components/live/LiveRaceGame.tsx"))};
const scenario=new URLSearchParams(location.search).get('scenario'),ticketId='a'.repeat(64),started=Date.now()-1000;
let settled=false;window.closeCalls=0;window.leaveCalls=[];window.completed=0;
const identity={displayName:'Fixture',avatarUrl:null,bot:false,correctCount:0};
const view=()=>{const now=Date.now();return({ticketId,phase:settled?(scenario==='searching'?'cancelled':'result'):scenario==='searching'?'searching':'racing',serverNowMs:now,searchEndsAtMs:now+60000,startsAtMs:scenario==='searching'?null:started,
player:identity,opponent:scenario==='searching'?null:{...identity,displayName:'Rival'},rewardCoins:0,result:settled&&scenario!=='searching'?'loss':null,
run:scenario==='searching'?null:{runId:ticketId,role:'creator',status:settled?'completed':'active',serverNowMs:now,startsAtMs:started,categoryId:'science',locale:'en',rules:${JSON.stringify(RACE_RULES)},correctCount:0,wallElapsedMs:now-started,totalPenaltyMs:0,adjustedElapsedMs:now-started,events:[],currentRiddle:settled?null:{riddleId:'q0',text:'A test prompt',answerLength:4,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]}}});};
const transport={join:async()=>view(),update:async input=>{
 if(input.action==='leave'){
  window.leaveCalls.push(input);
  if(window.leaveCalls.length===1){if(scenario==='lost-reply'){settled=true;return new Promise(()=>{});}throw new Error('Request failed before server');}
  settled=true;return view();
 }
 return view();
}};
function App(){const [closed,setClosed]=React.useState(false);return closed?<p>Choose your category</p>:<LiveRaceGame transport={transport} locale='en' categoryId='science' coins={670} ownerId='fixture' onCompleted={()=>window.completed++} onClose={()=>{window.closeCalls++;setClosed(true);}}/>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser,server;const report=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [390,1280])for(const scenario of ['request-failure','searching','lost-reply']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?scenario=${scenario}`);
  await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.textContent.includes('A test prompt')||document.querySelector('.live-race-self strong'));
  await page.getByRole('button',{name:'Close Race to 10',exact:true}).click();
  await page.waitForFunction(()=>window.leaveCalls.length===1);
  assert.equal(await page.evaluate(()=>window.closeCalls),0,'Close must retain the owned journey until leave is authoritatively confirmed');
  await page.getByRole('button',{name:'Retry',exact:true}).waitFor({timeout:12000});
  assert.equal(await page.getByText('Choose your category',{exact:true}).count(),0,'Failed leave cannot advertise a new search while an old seat remains active');
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.getByText('Choose your category',{exact:true}).waitFor();
  const calls=await page.evaluate(()=>window.leaveCalls);
  assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1],'Retry must reuse original ticket/action/request ID');
  assert.equal(await page.evaluate(()=>window.closeCalls),1);
  assert.equal(await page.evaluate(()=>window.completed),scenario==='searching'?0:1);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(output,`${scenario}-${width}.png`)});
  report.push({scenario,width,pass:true});await page.close();
 }
 await writeFile(path.join(output,'report.json'),JSON.stringify({scope:'Supporting real-component harness; not hosted Facebook E2E',report},null,2));
 console.log(`PASS ${report.length} owned leave confirmation/retry cases`);
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
