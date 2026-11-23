import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const panel=path.join(root,"src/races/components/invitations/LiveRaceDirectInvite.tsx");
const baseline=process.env.LIVE_DIRECT_INVITE_BASELINE_SOURCE;
const output=path.resolve(process.env.LIVE_DIRECT_INVITE_REPORT_DIR??path.join(root,'builds/test-evidence/game-live-invite-2026-10-03'));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/direct-invite-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceDirectInvite} from ${JSON.stringify(panel)};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
import ${JSON.stringify(path.join(root,"src/races/styles/lobby.css"))};
window.probe={calls:[],pending:[]};
function provider(generation){return {sendChallenge:input=>{window.probe.calls.push({input:{...input},generation});
  return new Promise((resolve,reject)=>window.probe.pending.push({resolve,reject}));}};}
function Harness(){const [challenge,setChallenge]=React.useState('live_'+'a'.repeat(64)),[transport,setTransport]=React.useState(()=>provider(1)),[version,setVersion]=React.useState(0);
  window.challenge=()=>setChallenge('live_'+'b'.repeat(64));window.provider=()=>setTransport(provider(2));window.profile=()=>setVersion(value=>value+1);
  return <section className='race-screen' role='dialog'><h1>Direct invitation fixture</h1><p data-challenge={challenge}>Lobby {challenge.slice(-1)} / profile {version}</p>
    <div className='race-panel'><LiveRaceDirectInvite challengeId={challenge} transport={transport}/></div></section>;}
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);
  root.render(<React.StrictMode><Harness/></React.StrictMode>);window.dispose=()=>{root.unmount();node.remove();};};
window.release=(index,value={status:'queued'})=>window.probe.pending[index].resolve(value);
window.reject=(index,code)=>window.probe.pending[index].reject(Object.assign(new Error('Injected invite delivery failure'),{code}));
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="background:#142234;margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',plugins:[{name:'direct-invite-baseline',enforce:'pre',async load(id){if(baseline&&id===panel)return readFile(baseline,'utf8');}}],build:{outDir:'dist'}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname;
    const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const mount=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.install();await page.evaluate(()=>window.mount());await page.locator('input').waitFor();};
    const inspect=async(name,expected)=>{const actual=await page.evaluate(()=>({
      busy:document.querySelector('.live-race-direct-invite button').getAttribute('aria-busy')==='true',inputDisabled:document.querySelector('input').disabled,
      alerts:document.querySelectorAll('[role=alert]').length,notices:document.querySelectorAll('[role=status]').length}));
      observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    await mount();await page.locator('input').fill('  Bob  ');await page.locator('.live-race-direct-invite button').click();
    await page.evaluate(()=>document.querySelector('.live-race-direct-invite button').click());
    assert.equal(await page.evaluate(()=>window.probe.calls.length),1);
    assert.equal(await page.evaluate(()=>window.probe.calls[0].input.recipientUsername),'Bob');
    await page.clock.runFor(9000);assert.equal(await page.locator('input').isDisabled(),true);await page.clock.runFor(1000);
    await inspect('stalled delivery exposes retry while pinning the original recipient',{busy:false,inputDisabled:true,alerts:1,notices:0});
    if(!baseline){
      await page.locator('.live-race-direct-invite button').click();
      const inputs=await page.evaluate(()=>window.probe.calls.map(call=>call.input));assert.deepEqual(inputs[1],inputs[0]);
      await page.evaluate(()=>window.release(0));await page.evaluate(()=>Promise.resolve());
      await inspect('superseded late receipt cannot settle a pending retry',{busy:true,inputDisabled:true,alerts:0,notices:0});
      await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();
      await inspect('accepted original-recipient retry confirms queue',{busy:false,inputDisabled:true,alerts:0,notices:1});
      await page.evaluate(()=>{document.querySelector('.live-race-direct-invite button').click();document.querySelector('.live-race-direct-invite button').click();});
      assert.equal(await page.evaluate(()=>window.probe.calls.length),2);
    }
    for(const code of ['functions/unavailable','functions/internal','failed-precondition']){
      await mount();await page.locator('input').fill('Bob');await page.locator('.live-race-direct-invite button').click();
      await page.evaluate(code=>window.reject(0,code),code);await page.getByRole('alert').waitFor();
      await inspect(code+' retains uncertain recipient selection',{busy:false,inputDisabled:true,alerts:1,notices:0});
      if(!baseline){await page.locator('.live-race-direct-invite button').click();assert.deepEqual(await page.evaluate(()=>window.probe.calls[1].input),await page.evaluate(()=>window.probe.calls[0].input));
        await page.evaluate(()=>window.reject(1,'functions/unavailable'));}
    }
    for(const code of ['not-found','functions/invalid-argument']){
      await mount();await page.locator('input').fill('Missing player');await page.locator('.live-race-direct-invite button').click();
      await page.evaluate(code=>window.reject(0,code),code);await page.getByRole('alert').waitFor();
      await inspect(code+' permits correction after authority rejection',{busy:false,inputDisabled:false,alerts:1,notices:0});
      await page.locator('input').fill('Bob');await page.locator('.live-race-direct-invite button').click();
      assert.equal(await page.evaluate(()=>window.probe.calls[1].input.recipientUsername),'Bob');await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();
    }
    if(!baseline){
      await mount();await page.locator('input').fill('Bob');await page.locator('.live-race-direct-invite button').click();await page.clock.runFor(10000);
      await page.locator('.live-race-direct-invite button').click();await page.evaluate(()=>window.reject(1,'not-found'));await page.getByRole('alert').waitFor();
      await inspect('later name refusal cannot erase an earlier unknown queue',{busy:false,inputDisabled:true,alerts:1,notices:0});
      await page.evaluate(()=>window.release(0));await page.getByRole('status').waitFor();
      await inspect('matching older receipt recovers after a failed exact replay',{busy:false,inputDisabled:true,alerts:0,notices:1});
    }
    for(const retirement of ['challenge','provider','unmount']){
      await mount();await page.locator('input').fill('Bob');await page.locator('.live-race-direct-invite button').click();
      await page.evaluate(retirement=>{if(retirement==='unmount'){window.dispose();window.mount();}else window[retirement]();},retirement);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await page.evaluate(()=>window.release(0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await inspect(retirement+' retires old queued acknowledgments',{busy:false,inputDisabled:false,alerts:0,notices:0});
      if(!baseline){await page.locator('input').fill('Carol');await page.locator('.live-race-direct-invite button').click();
        const call=await page.evaluate(()=>window.probe.calls[1]);assert.equal(call.input.recipientUsername,'Carol');
        if(retirement==='challenge')assert.equal(call.input.challengeId,'live_'+'b'.repeat(64));if(retirement==='provider')assert.equal(call.generation,2);
        await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();}
    }
    await mount();await page.locator('input').fill('Bob');await page.locator('.live-race-direct-invite button').click();await page.clock.runFor(10000);
    await page.evaluate(()=>window.release(0));await page.getByRole('status').waitFor();
    await inspect('current late receipt recovers an uncertain queue',{busy:false,inputDisabled:true,alerts:0,notices:1});
    await mount();await page.locator('input').fill('Bob');await page.locator('.live-race-direct-invite button').click();await page.evaluate(()=>window.profile());
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));await page.evaluate(()=>window.release(0));await page.getByRole('status').waitFor();
    await inspect('profile rerender preserves the original delivery',{busy:false,inputDisabled:true,alerts:0,notices:1});
    await mount();await page.locator('input').fill('Bob');await page.locator('.live-race-direct-invite button').click();await page.evaluate(()=>window.release(0,{status:'accepted'}));
    await page.getByRole('alert').waitFor();await inspect('invalid response remains uncertain and cannot grant queue success',{busy:false,inputDisabled:true,alerts:1,notices:0});
    if(!baseline){await page.locator('.live-race-direct-invite button').click();await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();}
    const controls=await page.locator('.live-race-direct-invite button, .live-race-direct-invite input').evaluateAll(elements=>elements.map(element=>{
      const style=getComputedStyle(element);return {color:style.color,background:style.backgroundColor,disabled:element.disabled,rect:element.getBoundingClientRect().toJSON()};}));
    await writeFile(path.join(output,`controls-${width}.json`),JSON.stringify(controls,null,2));
    assert.ok(controls.every(control=>control.rect.x>=0&&control.rect.right<=width&&control.rect.height>=44));
    await page.screenshot({path:path.join(output,`direct-invite-recovery-${width}.png`)});
    observations.push({width,name:'uncaught errors',expected:[],actual:errors});if(!baseline)assert.deepEqual(errors,[]);
    await context.close();console.log((baseline?'BASELINE ':'PASS ')+width+'px direct invitation delivery and ownership');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline direct-invitation regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
