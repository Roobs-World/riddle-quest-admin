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
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-hint-reveal-evidence-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {RACE_RULES} from '@riddle-quest/core/race';
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,'scripts/fixtures/RetainedRaceHarness.tsx'))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root,'src/play/race/testing/fakeRaceServices.ts'))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,'src/play/race/logic/racePresentation.ts'))};
const field=new URLSearchParams(location.search).get('case'),terminal=field.startsWith('terminal');
const authority=createFakeRaceServices(),initial=(await authority.startRace({locale:'en',categoryId:'mixed',requestId:'fixture',includeEvaluation:true})).run;
const fee=initial.rules.hintPenaltyMs;
let view={...initial,wallElapsedMs:0,serverNowMs:initial.startsAtMs,role:'challenger',challengeId:'hint-evidence',totalPenaltyMs:fee,adjustedElapsedMs:fee,
 opponent:{displayName:'Nova',adjustedFinishMs:terminal?29000:100000,events:[]},
 currentRiddle:{...initial.currentRiddle,revealedLetters:[{index:0,letter:'p'}]},
 events:[{sequence:0,type:'hint',riddlePosition:0,wallElapsedMs:0,penaltyAddedMs:fee,totalPenaltyMs:fee,adjustedElapsedMs:fee,correctCount:0}]};
window.commands=[];
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:listRaceCategories')authority.listRaceCategories('en').then(data=>reply(message,'raceCategories',data));
 if(message.type==='game:startRace')reply(message,'raceStart',{run:view});
 if(message.type==='game:requestRaceHint'){
  view={...view,status:terminal?'completed':'active',currentRiddle:terminal?null:{...view.currentRiddle,revealedLetters:[{index:0,letter:'p'},{index:1,letter:'i'}]},
    totalPenaltyMs:fee*2,adjustedElapsedMs:fee*2,events:[...view.events,{sequence:1,type:'hint',riddlePosition:0,wallElapsedMs:0,penaltyAddedMs:fee,totalPenaltyMs:fee*2,adjustedElapsedMs:fee*2,correctCount:0}]};
  reply(message,'raceHint',{run:view,index:field.endsWith('reused')?0:1,revealedLetter:field.endsWith('reused')?'p':field.endsWith('letter')?'z':'i'});
 }
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run:view});
 if(message.type==='game:getRaceOutcome')reply(message,'raceOutcome',projectRaceOutcome(view,view.adjustedElapsedMs));
}
createRoot(document.getElementById('root')).render(<RaceTo10Game ownerId="owner-1" locale="en" coins={100} postToHost={postToHost} onClose={()=>{}}/>);
`);
let browser,server;
try{
 await build({plugins:[{name:'expose-existing-attempt-session',enforce:'pre',transform(code,id){if(!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;assert(code.includes('const session = sessionRef.current;'));return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current;globalThis.testRaceSession=session;'),map:null};}}],root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const width of [1280,390])for(const field of ['live-reused','terminal-reused','terminal-letter','terminal-public-letter','live-valid','terminal-valid']){
 const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?case='+field);
 await page.waitForFunction(()=>window.testRaceSession?.getSnapshot().categories.length>0&&!window.testRaceSession.getSnapshot().pending);
 await page.evaluate(()=>window.testRaceSession.begin('mixed','hint-evidence'));
 await page.locator('.race-gameplay .guess-board').waitFor({state:'visible'}).catch(async error=>{console.log(JSON.stringify(await page.evaluate(()=>({state:window.testRaceSession.getSnapshot(),commands:window.commands,body:document.body.innerText}))));throw error;});
 if(field==='terminal-public-letter')await page.evaluate(()=>{window.testRaceSession.getSnapshot().run.currentRiddle.evaluation.answer='pzano';});
 await page.getByRole('button',{name:/^Hint/}).click();
 if(!field.endsWith('valid')){
  await page.getByRole('alert').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.totalPenaltyMs),15000);
  assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:getRaceOutcome').length),0);
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.waitForFunction(()=>window.commands.some(m=>m.type==='game:resumeRace')&&!window.testRaceSession.getSnapshot().pending&&!window.testRaceSession.getSnapshot().error);
 }
 assert.equal(await page.getByRole('alert').count(),0);
 assert.equal(await page.evaluate(()=>window.commands.filter(m=>m.type==='game:requestRaceHint').length),1);
 assert.equal(await page.evaluate(()=>window.testRaceSession.getSnapshot().run.totalPenaltyMs),30000);
 assert.deepEqual(errors,[]);console.log('Hint reveal evidence passed: '+field+' at '+width+'px.');await context.close();
 }

}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
