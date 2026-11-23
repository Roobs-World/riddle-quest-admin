import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-time-rollover-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RaceScoreboard} from ${JSON.stringify(path.join(root,"src/races/components/gameplay/RaceScoreboard.tsx"))};
import {RaceResultPanel} from ${JSON.stringify(path.join(root,"src/races/components/gameplay/RaceResultPanel.tsx"))};
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
const milliseconds=Number(new URLSearchParams(location.search).get('ms'));
const run={runId:'run-timer',role:'creator',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:10,wallElapsedMs:milliseconds,totalPenaltyMs:milliseconds,adjustedElapsedMs:milliseconds,currentRiddle:null,events:[]};
const outcome={runId:run.runId,result:'recorded',correctCount:10,wallFinishMs:milliseconds,hintPenaltyMs:milliseconds,skipPenaltyMs:milliseconds,totalPenaltyMs:milliseconds,adjustedFinishMs:milliseconds,publishable:false,rematchEligible:false,newlyUnlockedAchievementIds:[],achievementCoinsAwarded:0};
createRoot(document.getElementById('root')).render(<><RaceScoreboard run={run} adjustedNow={milliseconds} opponentCorrect={0} feedback={null} coins={0} onClose={()=>{}}/><RaceResultPanel run={null} outcome={outcome} publication={null} publishing={false} onPublish={()=>{}} onShare={()=>{}} onRematch={()=>{}} onChooseCategory={()=>{}} onClose={()=>{}}/></>);
`);
let browser,server;
try{
 await build({root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const [milliseconds,expected] of [[59949,'0:59.9'],[59950,'1:00.0'],[59999,'1:00.0'],[119950,'2:00.0'],[599999,'10:00.0']]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?ms='+milliseconds);
  await page.locator('.race-header-clock strong').waitFor();
  assert.equal(await page.locator('.race-header-clock strong').textContent(),expected);
  assert.equal(await page.locator('.race-header-clock small').textContent(),'+'+expected);
  assert.deepEqual(await page.locator('.race-result-grid strong').allTextContents(),[expected,'+'+expected,'+'+expected,expected]);
  assert(!/:[6-9]\d\./.test(expected));assert.deepEqual(errors,[]);
  console.log('Time rollover passed: '+milliseconds+'ms at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
