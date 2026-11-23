/** Restores retained recorded-race preparation, close, quit and publication recovery; never enters production artifacts. */
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/retained-start-recovery-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RetainedRaceHarness} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root,"src/sharing/components/ReferralSharingCapability.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,"src/races/testing/browser/fakeRaceServices.ts"))};
const failure=new URLSearchParams(location.search).get('failure'),authority=createFakeRaceServices();
window.commands=[];window.authorityRuns=[];window.closeCount=0;window.shares=[];window.publishedIds=[];let damaged=false,quitLost=false,resumeLost=false,publishLost=false;
function reply(message,operation,data,ok=true){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok,...(ok?{data}:{error:'RaceTo10.ERROR_GENERIC'})}}}));}
async function postToHost(message){window.commands.push(message);
if(message.type==='game:listRaceCategories')reply(message,'raceCategories',await authority.listRaceCategories('en'));
if(message.type==='game:startRace'){const data=await authority.startRace({...message.payload,requestId:message.requestId});window.authorityRuns.push(data.run.runId);if(['delayed-close','prepared-quit'].includes(failure))window.releaseStart=()=>reply(message,'raceStart',data);else if(['lost','wrong-category'].includes(failure)&&!damaged){damaged=true;if(failure==='lost')reply(message,'raceStart',null,false);else reply(message,'raceStart',{...data,run:{...data.run,categoryId:'mixed'}});}else reply(message,'raceStart',data);}
if(message.type==='game:abandonRace'){const data=await authority.abandonRace({...message.payload,requestId:message.requestId});if(failure!=='delayed-close'&&!quitLost){quitLost=true;reply(message,'raceAbandon',null,false);}else reply(message,'raceAbandon',data);}
if(message.type==='game:resumeRace'){const data=await authority.resumeRace(message.payload.runId);if(failure==='keep-playing'&&!resumeLost){resumeLost=true;reply(message,'raceResume',null,false);}else reply(message,'raceResume',data);}
if(message.type==='game:getRaceOutcome'){const data=await authority.getRaceOutcome(message.payload.runId);if(failure==='outcome-delay')window.releaseOutcome=()=>reply(message,'raceOutcome',data);else reply(message,'raceOutcome',data);}
if(message.type==='game:requestRaceHint'){await authority.requestRaceHint({...message.payload,requestId:message.requestId});reply(message,'raceHint',null,false);}
if(message.type==='game:skipRaceRiddle'){await authority.skipRaceRiddle({...message.payload,requestId:message.requestId});reply(message,'raceSkip',null,false);}
if(message.type==='game:publishRace'){const data=await authority.publishRace({...message.payload,requestId:message.requestId});window.publishedIds.push(data.challengeId);if(['publish-lost','publish-malformed'].includes(failure)&&!publishLost){publishLost=true;if(failure==='publish-lost')reply(message,'racePublish',null,false);else reply(message,'racePublish',{...data,preview:{...data.preview,locale:'fr'}});}else reply(message,'racePublish',data);}
if(message.type==='game:readyRace')reply(message,'raceReady',await authority.readyRace({...message.payload,requestId:message.requestId}));
}
const app=createRoot(document.getElementById('root'));
window.sharing={rewardCoins:100,shareResult:()=>{},shareInvite:()=>{},shareRace:async(input)=>{window.shares.push(input);return 'success';}};
async function mount(){if(failure.startsWith('publish-')||failure==='outcome-delay'){let run=(await authority.startRace({categoryId:'history',locale:'en',requestId:'seed-publication',includeEvaluation:true,prepare:false})).run;for(let i=0;i<10;i++)run=(await authority.submitRaceGuess({runId:run.runId,riddleId:run.currentRiddle.riddleId,guess:run.currentRiddle.evaluation.answer,requestId:'seed-guess-'+i})).run;window.seededRun=run.runId;localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));}
app.render(<ReferralSharingProvider capability={window.sharing}><RetainedRaceHarness ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{window.closeCount++;app.render(<p id="closed">Closed</p>);}}/></ReferralSharingProvider>);}
mount();
`);
let browser,server;
try{
await build({root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
server=createServer(async(request,response)=>{try{const file=path.join(scratch,'dist',new URL(request.url,'http://local').pathname==='/'?'index.html':new URL(request.url,'http://local').pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
for(const width of [1280,390])for(const failure of ['lost','wrong-category']){
const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port+'/?failure='+failure);
await page.getByRole('button',{name:/^History /}).click();await page.locator('.race-error').waitFor();
assert.equal(await page.locator('.race-gameplay').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('riddleQuest:activeRaceRun')),null);
await page.getByRole('button',{name:/^retry$/i}).click();await page.locator('.race-gameplay').waitFor({timeout:10000});
const state=await page.evaluate(()=>({commands:window.commands,runs:window.authorityRuns,saved:JSON.parse(localStorage.getItem('riddleQuest:activeRaceRun'))}));
const starts=state.commands.filter(c=>c.type==='game:startRace');assert.equal(starts.length,2);assert.equal(starts[1].requestId,starts[0].requestId);assert.deepEqual(starts[1].payload,starts[0].payload);assert.equal(new Set(state.runs).size,1);assert.equal(state.saved.runId,state.runs[0]);assert.deepEqual(state.commands.filter(c=>c.type==='game:readyRace').map(c=>c.payload.runId),[state.runs[0]]);assert.deepEqual(errors,[]);
console.log('PASS retained rejected preparation: '+failure+' at '+width+'px; one authority run and original start receipt.');await context.close();
}
for(const width of [1280,390])for(const failure of ['delayed-close','prepared-quit','active-quit','keep-playing']){
const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port+'/?failure='+failure);await page.getByRole('button',{name:/^History /}).click();
const prepared=['delayed-close','prepared-quit'].includes(failure);
if(prepared)await page.waitForFunction(()=>typeof window.releaseStart==='function');else await page.locator('.race-gameplay').waitFor({timeout:10000});
await page.locator('.race-close').click();
if(prepared){assert.equal(await page.locator('.race-close').getAttribute('aria-busy'),'true');assert.equal(await page.locator('.race-close').isDisabled(),true);assert.equal(await page.locator('.race-screen').count(),1);await page.evaluate(()=>window.releaseStart());}
else await page.getByRole('alertdialog').getByRole('button',{name:/^quit race$/i}).click();
if(failure!=='delayed-close'){
await page.locator('.race-error').waitFor();assert.notEqual(await page.evaluate(()=>localStorage.getItem('riddleQuest:activeRaceRun')),null);
if(failure==='keep-playing'){await page.getByRole('alertdialog').getByRole('button',{name:/keep playing/i}).click();await page.locator('.race-error').waitFor();await page.getByRole('button',{name:/^retry$/i}).click();await page.getByRole('button',{name:/^History /}).waitFor();assert.equal(await page.locator('.race-gameplay').count(),0);}
else if(prepared)await page.getByRole('button',{name:/^retry$/i}).click();else await page.getByRole('alertdialog').getByRole('button',{name:/^quit race$/i}).click();
}
if(failure!=='keep-playing')await page.locator('#closed').waitFor();
const state=await page.evaluate(()=>({commands:window.commands,runs:window.authorityRuns,closed:window.closeCount,saved:localStorage.getItem('riddleQuest:activeRaceRun')}));
const quit=state.commands.filter(c=>c.type==='game:abandonRace');assert.equal(quit.length,['delayed-close','keep-playing'].includes(failure)?1:2);if(quit.length===2){assert.equal(quit[1].requestId,quit[0].requestId);assert.deepEqual(quit[1].payload,quit[0].payload);}assert.equal(new Set(state.runs).size,1);assert.equal(state.closed,failure==='keep-playing'?0:1);assert.equal(state.saved,null);assert.equal(state.commands.filter(c=>c.type==='game:resumeRace').length,failure==='keep-playing'?2:0);assert.equal(state.commands.filter(c=>['game:getRaceOutcome','game:publishRace'].includes(c.type)).length,0);if(prepared)assert.equal(state.commands.filter(c=>c.type==='game:readyRace').length,0);assert.deepEqual(errors,[]);
console.log('PASS retained close/quit recovery: '+failure+' at '+width+'px; exact receipt, authority cleanup and no resumed abandoned gameplay.');await context.close();
}
for(const width of [1280,390])for(const failure of ['publish-lost','publish-malformed']){
const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port+'/?failure='+failure);await page.locator('.race-result').waitFor({timeout:10000});
await page.getByRole('button',{name:/send challenge/i}).click();await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.shares.length),0);assert.equal(await page.evaluate(()=>new Set(window.publishedIds).size),1);
await page.getByRole('button',{name:/^retry$/i}).click();await page.waitForFunction(()=>window.shares.length===1);
const state=await page.evaluate(()=>({commands:window.commands,published:window.publishedIds,shares:window.shares,seededRun:window.seededRun}));const publishes=state.commands.filter(c=>c.type==='game:publishRace');assert.equal(publishes.length,2);assert.equal(publishes[1].requestId,publishes[0].requestId);assert.deepEqual(publishes[1].payload,publishes[0].payload);assert.equal(publishes[0].payload.runId,state.seededRun);assert.equal(new Set(state.published).size,1);assert.equal(state.shares[0].challengeId,state.published[0]);assert.equal(state.commands.filter(c=>c.type==='game:startRace').length,0);assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
console.log('PASS retained publication recovery: '+failure+' at '+width+'px; one challenge, original receipt and one confirmed share.');await context.close();
}
for(const width of [1280,390])for(const action of ['Hint','Skip']){
const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:'+server.address().port+'/?failure=paid-'+action.toLowerCase());await page.getByRole('button',{name:/^History /}).click();await page.locator('.race-gameplay').waitFor({timeout:10000});await page.locator('.race-gameplay .guess-row .cell').first().click();await page.keyboard.type('pi');const clue=await page.locator('.race-riddle-surface h2').innerText();
await page.locator('.race-actions').getByRole('button',{name:new RegExp('^'+action,'i')}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.race-riddle-surface h2').innerText(),clue);await page.getByRole('button',{name:/^retry$/i}).click();
if(action==='Hint'){await page.locator('.race-gameplay .guess-row .cell.green').first().waitFor();assert.deepEqual(await page.locator('.race-gameplay .guess-row').first().locator('.cell').allTextContents(),['p','i','','','']);assert.match(await page.locator('.race-header-clock small').innerText(),/0:15.0/);}
else {await page.waitForFunction(previous=>document.querySelector('.race-riddle-surface h2')?.textContent!==previous,clue);assert.deepEqual(await page.locator('.race-gameplay .guess-row').first().locator('.cell').allTextContents(),['','','','','']);assert.match(await page.locator('.race-header-clock small').innerText(),/0:45.0/);}
const commands=await page.evaluate(()=>window.commands);assert.equal(commands.filter(c=>c.type==='game:resumeRace').length,1);assert.equal(commands.filter(c=>c.type===(action==='Hint'?'game:requestRaceHint':'game:skipRaceRiddle')).length,1);assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);console.log('PASS retained paid-action recovery: '+action+' at '+width+'px; one mutation, canonical resume, draft and penalty restored.');await context.close();
}
for(const width of [1280,390]){
const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/?failure=outcome-delay');await page.getByRole('heading',{name:/run recorded/i}).waitFor({timeout:10000});await page.waitForFunction(()=>typeof window.releaseOutcome==='function');const publish=page.getByRole('button',{name:/send challenge/i});assert.equal(await publish.isEnabled(),true);await publish.click();assert.equal(await page.evaluate(()=>window.commands.filter(c=>c.type==='game:publishRace').length),0);await page.evaluate(()=>{window.releaseOutcome();window.releaseOutcome();});await page.waitForFunction(()=>window.shares.length===1);assert.equal(await page.evaluate(()=>window.commands.filter(c=>c.type==='game:publishRace').length),1);assert.equal(await page.evaluate(()=>window.shares[0].challengeId===window.publishedIds[0]),true);assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);console.log('PASS retained delayed-outcome recovery at '+width+'px; immediate result, queued publication and duplicate confirmation ignored.');await context.close();
}
}finally{await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());await rm(scratch,{recursive:true,force:true});}
