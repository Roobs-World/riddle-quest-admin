import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const host=path.join(root,'src/play/PlayHostApp.tsx');
const baseline=process.env.COMPLETION_EFFECTS_BASELINE_SOURCE;
const handlers=path.join(root,'src/play/hostMessageHandlers.ts'),effects=path.join(root,'src/play/hostCompletionEffects.ts');
const handlersBaseline=process.env.COMPLETION_EFFECTS_HANDLERS_BASELINE_SOURCE,effectsBaseline=process.env.COMPLETION_EFFECTS_HELPER_BASELINE_SOURCE;
const output=path.resolve(process.env.COMPLETION_EFFECTS_REPORT_DIR??path.join(root,'../../builds/test-evidence/game-completion-effects-2026-10-03'));
await mkdir(output,{recursive:true});
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/completion-effects-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.ts'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(host)};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {dispatchLocalBridge,GAME_TO_HOST_EVENT,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
import {configurePlatformAnalytics} from ${JSON.stringify(path.join(root,'src/analytics/events.ts'))};
window.probe={records:[],shows:[],acks:[],pending:[],holds:[],holdAuthority:false,holdRecord:false,rejectRecord:false,events:[],wins:[],guessAcks:[],guessPending:[],holdGuess:false,rejectWin:false};
configurePlatformAnalytics((name,params)=>window.probe.events.push({name,params}));
const base=createFakeHostServices();let original;const stop=base.auth.subscribe(value=>original=value);stop();
let snapshot={...original,user:{...original.user,uid:'Alice'}};const subscribers=new Set();
window.select=(uid,generation)=>{snapshot={...snapshot,user:uid?{...original.user,uid,accountGeneration:generation}:null};
  subscribers.forEach(callback=>callback(snapshot));};
window.profile=()=>{snapshot={...snapshot,profile:{...snapshot.profile,coins:snapshot.profile.coins+1}};
  subscribers.forEach(callback=>callback(snapshot));};
window.receipt={attempts:1,isCorrect:true,coinsEarned:50,newlyUnlockedAchievementIds:['first_win'],newLevel:3,leveledUp:true};
window.guessReceipt={feedback:Array.from('piano',letter=>({letter,status:'green'})),attempts:1,isCorrect:true,gameOver:true};
const services={...base,auth:{...base.auth,subscribe:callback=>{subscribers.add(callback);callback(snapshot);return()=>subscribers.delete(callback);}},
  submitGuess:async input=>window.probe.holdGuess?new Promise(resolve=>window.probe.guessPending.push(resolve)):window.guessReceipt,
  completeGame:async input=>window.probe.holdAuthority?new Promise(resolve=>window.probe.pending.push(resolve)):window.receipt};
const session=createHostedPlaySession({hostServices:services,raceAvailable:false});
function Harness(){const [version,setVersion]=React.useState(0);window.rerender=()=>setVersion(value=>value+1);
  return React.createElement(PlayHostApp,{session,onPlayable:()=>window.playable=true,
    onAuthoritativeGuessWin:input=>{window.probe.wins.push({input,uid:snapshot.user?.uid,version});if(window.probe.rejectWin)throw new Error('Injected optional guess callback failure');},
    onAuthoritativeComplete:async(input,result)=>{window.probe.records.push({input,result,uid:snapshot.user?.uid,version});
      if(window.probe.rejectRecord)throw new Error('Injected optional completion failure');
      if(window.probe.holdRecord)await new Promise(resolve=>window.probe.holds.push(resolve));},
    onResultScreen:()=>window.probe.shows.push({uid:snapshot.user?.uid,version})});}
window.mount=()=>{const element=document.createElement('div');element.id='host';document.body.appendChild(element);
  const root=createRoot(element);root.render(React.createElement(React.StrictMode,null,React.createElement(Harness)));
  window.dispose=()=>{root.unmount();element.remove();};};
window.addEventListener(HOST_TO_GAME_EVENT,event=>{
  if(event.detail.type==='host:authState')document.body.dataset.owner=event.detail.payload.user?.uid??'signed-out';
  if(event.detail.type==='host:operationResult'&&event.detail.payload.operation==='completeGame')window.probe.acks.push(event.detail);
  if(event.detail.type==='host:operationResult'&&event.detail.payload.operation==='guess')window.probe.guessAcks.push(event.detail);
});
window.send=(requestId,token='00000000-0000-4000-8000-000000000001',gameMode='classic')=>dispatchLocalBridge(GAME_TO_HOST_EVENT,
  {type:'game:completeGame',requestId,payload:{riddleId:'classic-fake-1',sessionToken:token,gameMode}});
window.guess=(requestId,token='00000000-0000-4000-8000-000000000001')=>dispatchLocalBridge(GAME_TO_HOST_EVENT,
  {type:'game:submitGuess',requestId,payload:{riddleId:'classic-fake-1',sessionToken:token,gameMode:'classic',guess:'piano',requestId:'authority-'+requestId}});
`);
await writeFile(path.join(scratch,'index.html'),'<html><body><script type="module" src="/main.ts"></script></body></html>');
let server,browser;const outcomes=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',plugins:[{
    name:'completion-host-baseline',enforce:'pre',async load(id){if(baseline&&id===host)return readFile(baseline,'utf8');if(handlersBaseline&&id===handlers)return readFile(handlersBaseline,'utf8');if(effectsBaseline&&id===effects)return readFile(effectsBaseline,'utf8');}
  }],build:{outDir:'dist'}});
  server=createServer(async(request,response)=>{try{
    const pathname=new URL(request.url,'http://localhost').pathname;
    const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});
    response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),errors=[];
    let page;
    // Each mount is an independent scenario; retire its page before loading the next fixture.
    const mount=async()=>{await page?.close();page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);await page.evaluate(()=>window.mount());
      await page.waitForFunction(()=>window.playable&&document.body.dataset.owner==='Alice');};
    const check=async(name,expected)=>{const actual=await page.evaluate(()=>({records:window.probe.records.length,shows:window.probe.shows.length,acks:window.probe.acks.length,levelEnds:window.probe.events.filter(event=>event.name==='level_end').length,
        levelUps:window.probe.events.filter(event=>event.name==='level_up').length,unlocks:window.probe.events.filter(event=>event.name==='unlock_achievement').length}));
      expected={...expected,levelEnds:expected.records,levelUps:expected.records,unlocks:expected.records};
      outcomes.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    await mount();
    await page.evaluate(()=>{window.send('one');window.send('retry-two');window.send('retry-three');});
    await page.waitForFunction(()=>window.probe.acks.length===3&&window.probe.shows.length>0);
    await check('identical issued completions',{records:1,shows:1,acks:3});
    await page.evaluate(()=>{window.profile();window.rerender();});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    await page.evaluate(()=>window.send('retry-after-profile'));await page.waitForFunction(()=>window.probe.acks.length===4);
    await check('profile and callback updates retain consumed identity',{records:1,shows:1,acks:4});
    await page.evaluate(()=>window.send('new-issued-session','00000000-0000-4000-8000-000000000002'));
    await page.waitForFunction(()=>window.probe.acks.length===5);
    await check('distinct sessions remain eligible',{records:2,shows:2,acks:5});
    await page.getByRole('button',{name:/let's play/i}).click();
    await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
    await page.locator('.onboarding-card').waitFor({state:'hidden'});
    for(let step=0;step<8;step++){const tooltip=page.getByRole('button',{name:/got it/i});if(await tooltip.count()===0)break;await tooltip.click();}
    await page.screenshot({path:path.join(output,`completion-effects-${width}.png`)});
    for(const retirement of ['replacement','same-UID-return','same-UID-generation']){
      await mount();await page.evaluate(()=>{window.probe.holdAuthority=true;window.send('held-old-account');});
      await page.waitForFunction(()=>window.probe.pending.length===1);
      await page.evaluate(retirement=>{if(retirement==='replacement')window.select('Bob');
        else if(retirement==='same-UID-return'){window.select(null);window.select('Alice');}
        else window.select('Alice',2);},retirement);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await page.evaluate(()=>window.probe.pending[0](window.receipt));
      await page.waitForFunction(()=>window.probe.acks.length===1);
      await check(retirement+' retires pending callbacks',{records:0,shows:0,acks:1});
    }
    await mount();await page.evaluate(()=>{window.probe.holdRecord=true;window.send('held-notification');});
    await page.waitForFunction(()=>window.probe.holds.length===1);
    await page.evaluate(()=>window.select('Bob'));await page.waitForFunction(()=>document.body.dataset.owner==='Bob');
    await page.evaluate(()=>window.probe.holds[0]());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    await check('account change during notification prevents result action',{records:1,shows:0,acks:1});
    await page.evaluate(()=>{window.probe.holdRecord=false;window.send('new-account');});
    await page.waitForFunction(()=>window.probe.acks.length===2);
    await check('replacement account owns independent result',{records:2,shows:1,acks:2});
    await mount();await page.evaluate(()=>{window.probe.rejectRecord=true;window.send('optional-rejection');});
    await page.waitForFunction(()=>window.probe.records.length===1);
    await page.evaluate(()=>window.send('retry-optional-rejection'));await page.waitForFunction(()=>window.probe.acks.length===2);
    await check('optional rejection cannot mask receipt or replay partial effects',{records:1,shows:0,acks:2});
    const accepted=await page.evaluate(()=>window.probe.acks.every(message=>message.payload.ok&&message.payload.data.coinsEarned===50));
    assert.ok(accepted,'Optional provider failures cannot alter accepted reward receipts');
    await mount();await page.evaluate(()=>{window.probe.holdAuthority=true;window.send('unmount-held');});
    await page.waitForFunction(()=>window.probe.pending.length===1);
    await page.evaluate(()=>{window.dispose();window.probe.pending[0](window.receipt);});
    await page.waitForFunction(()=>window.probe.acks.length===1);
    await check('unmounted host retires pending provider work',{records:0,shows:0,acks:1});
    const checkGuess=async(name,expected)=>{const actual=await page.evaluate(()=>({wins:window.probe.wins.length,acks:window.probe.guessAcks.length,
        events:window.probe.events.filter(event=>event.name==='guess_submitted').length}));
      outcomes.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    await mount();await page.evaluate(()=>{window.guess('first');window.guess('retry');window.guess('semantic-retry');});
    await page.waitForFunction(()=>window.probe.guessAcks.length===3);
    await checkGuess('same accepted guess produces one win and one event',{wins:1,acks:3,events:1});
    await page.evaluate(()=>{window.profile();window.rerender();});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    await page.evaluate(()=>window.guess('profile-retry'));await page.waitForFunction(()=>window.probe.guessAcks.length===4);
    await checkGuess('guess consumption survives profile and callback updates',{wins:1,acks:4,events:1});
    await page.evaluate(()=>window.guess('distinct-session','00000000-0000-4000-8000-000000000002'));
    await page.waitForFunction(()=>window.probe.guessAcks.length===5);
    await checkGuess('new issued guess session remains eligible',{wins:2,acks:5,events:2});
    for(const retirement of ['replacement','same-UID-return','same-UID-generation','unmount']){
      await mount();await page.evaluate(()=>{window.probe.holdGuess=true;window.guess('held-guess');});
      await page.waitForFunction(()=>window.probe.guessPending.length===1);
      await page.evaluate(retirement=>{if(retirement==='replacement')window.select('Bob');
        else if(retirement==='same-UID-return'){window.select(null);window.select('Alice');}
        else if(retirement==='same-UID-generation')window.select('Alice',2);else window.dispose();},retirement);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await page.evaluate(()=>window.probe.guessPending[0](window.guessReceipt));await page.waitForFunction(()=>window.probe.guessAcks.length===1);
      await checkGuess(retirement+' retires guess target callbacks and analytics',{wins:0,acks:1,events:0});
      if(retirement!=='unmount'){
        await page.evaluate(()=>{window.probe.holdGuess=false;window.guess('current-visit-guess');});
        await page.waitForFunction(()=>window.probe.guessAcks.length===2);
        await checkGuess(retirement+' permits independent current-visit guesses',{wins:1,acks:2,events:1});
      }
    }
    await mount();await page.evaluate(()=>{window.guessReceipt={...window.guessReceipt,isCorrect:false,gameOver:false,
      feedback:Array.from('piano',letter=>({letter,status:'red'}))};window.guess('wrong-one');window.guess('wrong-one-retry');});
    await page.waitForFunction(()=>window.probe.guessAcks.length===2);
    await checkGuess('wrong guess semantic retries retain one attempt event',{wins:0,acks:2,events:1});
    await page.evaluate(()=>{window.guessReceipt={...window.guessReceipt,attempts:2};window.guess('wrong-two');});
    await page.waitForFunction(()=>window.probe.guessAcks.length===3);
    await checkGuess('distinct accepted wrong attempts remain observable',{wins:0,acks:3,events:2});
    await mount();await page.evaluate(()=>{window.probe.rejectWin=true;window.guess('callback-failed');});
    await page.waitForFunction(()=>window.probe.guessAcks.length===1);
    await page.evaluate(()=>window.guess('callback-failed-retry'));await page.waitForFunction(()=>window.probe.guessAcks.length===2);
    await checkGuess('failed guess callback cannot reject acceptance or replay partial effects',{wins:1,acks:2,events:1});
    assert.ok(await page.evaluate(()=>window.probe.guessAcks.every(message=>message.payload.ok)));
    assert.deepEqual(errors,[]);await context.close();console.log((baseline?'BASELINE observations ':'PASS ')+width+'px: completion and accepted-attempt identity, profile rerenders, retired visits, optional callback failures, and owned analytics');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(outcomes,null,2));
  if(baseline)assert.ok(outcomes.every(item=>JSON.stringify(item.actual)===JSON.stringify(item.expected)),'Baseline single-player effect regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
