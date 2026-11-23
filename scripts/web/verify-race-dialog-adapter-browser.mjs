/** Exercises the retained recorded-race controller/view; the public entry uses live PvP. */
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const reactRuntime=process.env.RACE_REACT_DEVELOPMENT === "1" ? "development" : "production";
await mkdir(path.join(root,"node_modules/.cache"),{recursive:true});
const scratch=await mkdtemp(path.join(root,"node_modules/.cache/race-dialog-adapter-"));
await writeFile(path.join(scratch,"tsconfig.json"),JSON.stringify({compilerOptions:{jsx:"react-jsx"}}));
await writeFile(path.join(scratch,"index.html"),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,"main.tsx"),`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, "src/races/contracts"))};
import {RetainedRaceHarness as RaceTo10Game} from ${JSON.stringify(path.join(root,"scripts/web/fixtures/RetainedRaceHarness.tsx"))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root,"src/sharing/components/ReferralSharingCapability.tsx"))};
import {projectRaceOutcome} from ${JSON.stringify(path.join(root,"src/races/presentation/racePresentation.ts"))};
import {tr} from ${JSON.stringify(path.join(root,"src/localization/browser/i18n.ts"))};
const mode=new URLSearchParams(location.search).get('mode'),now=Date.now();
window.calls=[];window.commands=[];window.sessionSetups=0;window.sessionCleanups=0;window.liveSessions=0;
window.labels={context:tr('RaceTo10.CHOOSE_CONTEXT'),match:tr('RaceTo10.MATCH_PLAYER'),tournament:tr('RaceTo10.SHARE_TOURNAMENT'),referral:'Fixture share'};
const run={runId:'owned-run',role:'creator',status:'completed',categoryId:'mixed',locale:'en',rules:RACE_RULES,correctCount:10,wallElapsedMs:60000,totalPenaltyMs:0,adjustedElapsedMs:60000,currentRiddle:null,events:[],serverNowMs:now,startsAtMs:now-60000};
if(mode==='referral')localStorage.setItem('riddleQuest:activeRaceRun',JSON.stringify({ownerId:'owner-1',runId:run.runId}));
const preview={challengeId:'published',categoryId:'mixed',locale:'en',rulesVersion:'race10_v1',targetCorrect:10,adjustedTimeToBeatMs:60000,creator:{displayName:'Nova'},status:'active',expiresAtMs:now+60000};
function reply(message,operation,data){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation,ok:true,data}}}));}
function postToHost(message){window.commands.push(message);
 if(message.type==='game:resumeRace')reply(message,'raceResume',{run});
 if(message.type==='game:getRaceOutcome')reply(message,'raceOutcome',projectRaceOutcome(run,60000));
 if(message.type==='game:listRaceCategories')reply(message,'raceCategories',{categories:[],rules:RACE_RULES});
 if(message.type==='game:publishRace')reply(message,'racePublish',{challengeId:'published',preview});
}
const dialog=(provider,kind)=>new Promise((resolve,reject)=>window.calls.push({provider,kind,resolve,reject}));
const adapters=name=>({native:{chooseContext:()=>dialog(name,'context'),matchPlayer:()=>dialog(name,'match')},tournaments:{record:async()=>({}),share:()=>dialog(name,'tournament'),list:async()=>({tournamentId:'daily',locale:'en',startsAtMs:now,endsAtMs:now+60000,sortOrder:'LOWER_IS_BETTER',rewardsEnabled:false,currentPlayer:{rank:1,adjustedTimeMs:60000},standings:[]})},referral:{rewardCoins:25,raceShareLabel:'Fixture share',shareResult:()=>{},shareInvite:()=>{},shareRace:()=>dialog(name,'referral')}});
const first=adapters('first'),second=adapters('second');
function App(){const [provider,setProvider]=React.useState(first);window.replaceProvider=()=>{window.oldSession=globalThis.testRaceSession;setProvider(second);};
 window.replaceUnrelatedProvider=()=>setProvider(current=>({...current,...(mode==='tournament'?{referral:second.referral}:{tournaments:second.tournaments})}));
 return <ReferralSharingProvider capability={provider.referral}><RaceTo10Game ownerId="owner-1" locale="en" coins={100} nativeSocial={provider.native} tournaments={provider.tournaments} postToHost={postToHost} onClose={()=>{}}/></ReferralSharingProvider>;}
const app=<App/>;window.root=createRoot(document.getElementById('root'));window.root.render(new URLSearchParams(location.search).get('strict')==='true'?<React.StrictMode>{app}</React.StrictMode>:app);
`);
let browser,server;const failures=[];
try{
 await build({root:scratch,configFile:false,logLevel:"error",define:{"process.env.NODE_ENV":JSON.stringify(reactRuntime)},plugins:[{name:"expose-session",enforce:"pre",transform(code,id){
  if(!id.endsWith('/races/hooks/useRaceSession.ts'))return null;
  assert(code.includes('const session = sessionRef.current;'));
  assert(code.includes('session.enter(entry);')&&code.includes('session.dispose(); window.removeEventListener'));
  return {code:code.replace('const session = sessionRef.current;','const session = sessionRef.current; globalThis.testRaceSession = session;').replace('session.enter(entry);','globalThis.sessionSetups++;globalThis.liveSessions++;session.enter(entry);').replace('session.dispose(); window.removeEventListener','globalThis.sessionCleanups++;globalThis.liveSessions--;session.dispose(); window.removeEventListener'),map:null};
 }}],build:{outDir:'dist'}});
 server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const strict of [false,true])for(const width of [1280,390])for(const mode of ['context','match','tournament','referral'])for(const ending of ['success','failure','unrelated']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode+'&strict='+strict);
   await page.waitForFunction(()=>Boolean(globalThis.testRaceSession)&&globalThis.testRaceSession.getSnapshot().pending===null);
   const setups=strict&&reactRuntime==='development'?2:1;
   assert.equal(await page.evaluate(()=>window.sessionSetups),setups,'expected session setup replay did not occur');
   assert.equal(await page.evaluate(()=>window.sessionCleanups),setups-1,'StrictMode session cleanup did not occur');
   assert.equal(await page.evaluate(()=>window.liveSessions),1,'StrictMode left duplicate live sessions');
   if(mode==='tournament')await page.evaluate(()=>globalThis.testRaceSession.navigate('tournaments'));
   if(mode==='referral'){
    await page.waitForFunction(()=>globalThis.testRaceSession.getConfirmedOutcomeRunId()==='owned-run');
    await page.evaluate(()=>globalThis.testRaceSession.publish());
   }
   const label=await page.evaluate(mode=>window.labels[mode],mode),button=page.getByRole('button',{name:label,exact:true});
   await button.waitFor();
   if(mode!=='referral')await button.click();
   await page.waitForFunction(()=>window.calls.length===1);
   assert.equal(await button.isDisabled(),true);
   if(ending==='unrelated'){
    await page.evaluate(()=>window.replaceUnrelatedProvider());
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
    assert.equal(await button.isDisabled(),true,'unrelated provider replacement released an owned dialog');
    assert.equal(await page.evaluate(()=>window.calls.length),1);
    await page.evaluate(mode=>window.calls[0].resolve(mode==='referral'?'cancelled':{status:'cancelled'}),mode);
    await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(button=>button.textContent===label&&!button.disabled),label);
    assert.equal(await page.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
    await page.evaluate(()=>window.root.unmount());
    assert.equal(await page.evaluate(()=>window.liveSessions),0,'unmount retained live session');
    assert.equal(await page.evaluate(()=>window.sessionCleanups),setups,'unmount missed session cleanup');
    console.log('Dialog adapter ownership passed: '+mode+' unrelated replacement at '+width+'px, strict='+strict+', runtime='+reactRuntime+'.');
    continue;
   }
   await page.evaluate(()=>window.replaceProvider());
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
   await button.waitFor();
   assert.equal(await button.isDisabled(),false,'retired provider dialog kept replacement control disabled');
   assert.equal(await page.evaluate(()=>window.oldSession===globalThis.testRaceSession),true,'dialog replacement reset competitive session');
   await button.click();await page.waitForFunction(()=>window.calls.length===2);
   assert.equal(await button.isDisabled(),true);
   await page.evaluate(({mode,ending})=>{if(ending==='failure')window.calls[0].reject(new Error('retired-dialog-error'));else window.calls[0].resolve(mode==='referral'?'success':{status:'success'});},{mode,ending});
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
   assert.equal(await button.isDisabled(),true,'old dialog completion released the new dialog guard');
   assert.equal(await page.getByRole('alert').count(),0,'old dialog reported an error in the replacement provider');
   await page.evaluate(mode=>window.calls[1].resolve(mode==='referral'?'cancelled':{status:'cancelled'}),mode);
   await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(button=>button.textContent===label&&!button.disabled),label);
   assert.deepEqual(await page.evaluate(()=>window.calls.map(call=>call.provider)),['first','second']);
   assert.equal(await page.evaluate(()=>window.commands.filter(message=>['game:startRace','game:submitRaceGuess','game:requestRaceHint','game:skipRaceRiddle','game:abandonRace'].includes(message.type)).length),0);
   await page.evaluate(()=>window.root.unmount());
   assert.equal(await page.evaluate(()=>window.liveSessions),0,'unmount retained live session');
   assert.equal(await page.evaluate(()=>window.sessionCleanups),setups,'unmount missed session cleanup');
   assert.deepEqual(errors,[]);console.log('Dialog adapter ownership passed: '+mode+' '+ending+' at '+width+'px, strict='+strict+', runtime='+reactRuntime+'.');
  }catch(error){failures.push({mode,ending,width,strict,message:error.message});console.error('Dialog adapter ownership FAILED: '+JSON.stringify(failures.at(-1)));}
  finally{await context.close();}
 }
 assert.deepEqual(failures,[],JSON.stringify(failures));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
