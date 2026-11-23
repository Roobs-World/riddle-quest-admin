import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const panel=path.join(root,'src/play/race/components/LiveRaceSafety.tsx');
const baseline=process.env.LIVE_SAFETY_BASELINE_SOURCE;
const output=path.resolve(process.env.LIVE_SAFETY_REPORT_DIR??path.join(root,'../../builds/test-evidence/game-live-safety-2026-10-03'));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-safety-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceSafety} from ${JSON.stringify(panel)};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
import ${JSON.stringify(path.join(root,'src/styles.race-lobby.css'))};
import ${JSON.stringify(path.join(root,'src/styles.race-gameplay.css'))};
window.probe={calls:[],pending:[],blocked:0,callbackFailure:null};
function provider(generation){return {blockOpponent:input=>call('block',input,generation),reportOpponent:input=>call('report',input,generation)};}
const call=(kind,input,generation)=>{window.probe.calls.push({kind,input:{...input},generation});return new Promise((resolve,reject)=>window.probe.pending.push({resolve,reject,kind}));};
function Harness(){const [ticket,setTicket]=React.useState('a'.repeat(64)),[transport,setTransport]=React.useState(()=>provider(1));
  window.seat=()=>setTicket('b'.repeat(64));window.provider=()=>setTransport(provider(2));
  return <section className='race-screen race-screen-live-safety' role='dialog'>
    <h1>Live race safety fixture</h1><p data-ticket={ticket}>Owned seat {ticket.slice(0,1)}</p>
    <LiveRaceSafety transport={transport} ticketId={ticket} onBlocked={()=>{window.probe.blocked++;
      if(window.probe.callbackFailure==='sync')throw new Error('Injected confirmed-block callback failure');
      if(window.probe.callbackFailure==='async')return Promise.reject(new Error('Injected confirmed-block callback failure'));}}/>
  </section>;}
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);
  root.render(<React.StrictMode><Harness/></React.StrictMode>);window.dispose=()=>{root.unmount();node.remove();};};
window.release=(index,value)=>window.probe.pending[index].resolve(value??(window.probe.pending[index].kind==='block'?{blocked:true}:{queued:true,reportId:'accepted-report'}));
window.reject=index=>window.probe.pending[index].reject(new Error('Injected late delivery failure'));
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="background:#142234;margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',plugins:[{name:'live-safety-baseline',enforce:'pre',async load(id){if(baseline&&id===panel)return readFile(baseline,'utf8');}}],build:{outDir:'dist'}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname;
    const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const mount=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.install();await page.evaluate(()=>window.mount());
      await page.locator('summary').click();};
    const inspect=async(name,expected)=>{const actual=await page.evaluate(()=>({
      busy:document.querySelector('.live-race-report').disabled,alerts:document.querySelectorAll('[role=alert]').length,
      notices:document.querySelectorAll('[role=status]').length,blocked:window.probe.blocked}));
      observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    for(const kind of ['block','report']){
      await mount();if(kind==='report')await page.locator('select').selectOption('cheating');
      await page.locator('.live-race-'+kind).click();
      await page.evaluate(kind=>{document.querySelector('.live-race-'+kind).click();},kind);
      assert.equal(await page.evaluate(()=>window.probe.calls.length),1,'Pending safety transport excludes repeat admission');
      await page.clock.runFor(9000);assert.equal(await page.locator('.live-race-report').isDisabled(),true);
      await page.clock.runFor(1000);
      await inspect(kind+' expires and exposes retry',{busy:false,alerts:1,notices:0,blocked:0});
      if(!baseline){
        if(kind==='report')await page.locator('select').selectOption('other');
        await page.getByRole('alert').getByRole('button').click();
        const inputs=await page.evaluate(()=>window.probe.calls.map(call=>call.input));assert.deepEqual(inputs[1],inputs[0],'Retry must preserve the frozen original operation');
        await page.evaluate(()=>window.release(0));await page.evaluate(()=>Promise.resolve());
        await inspect(kind+' expired receipt cannot replace the pending retry',{busy:true,alerts:0,notices:0,blocked:0});
        await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();
        await inspect(kind+' accepted retry settles normally',{busy:false,alerts:0,notices:1,blocked:kind==='block'?1:0});
        if(kind==='block')assert.equal(await page.locator('.live-race-block').isDisabled(),true);
        if(kind==='report'){
          await page.locator('.live-race-report').click();
          const calls=await page.evaluate(()=>window.probe.calls);assert.equal(calls[2].input.category,'other');assert.notEqual(calls[2].input.requestId,calls[0].input.requestId);
          await page.evaluate(()=>window.release(2));await page.getByRole('status').waitFor();
        }
      }
    }
    await mount();await page.locator('.live-race-report').click();await page.clock.runFor(10000);
    if(!baseline){await page.locator('select').selectOption('spam');await page.locator('.live-race-report').click();
      const inputs=await page.evaluate(()=>window.probe.calls.map(call=>call.input));assert.equal(inputs[1].category,'spam');assert.notEqual(inputs[1].requestId,inputs[0].requestId);
      await page.evaluate(()=>window.reject(0));await page.evaluate(()=>Promise.resolve());
      await inspect('expired report failure cannot disturb a new categorized report',{busy:true,alerts:0,notices:0,blocked:0});
      await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();}
    for(const kind of ['block','report']){
      await mount();await page.locator('.live-race-'+kind).click();await page.clock.runFor(10000);
      await page.evaluate(()=>window.release(0));await page.getByRole('status').waitFor();
      await inspect(kind+' current late authority receipt recovers without a retry',{busy:false,alerts:0,notices:1,blocked:kind==='block'?1:0});
      if(!baseline&&kind==='block'){
        await page.evaluate(()=>{document.querySelector('.live-race-block').click();document.querySelector('.live-race-block').click();});
        assert.equal(await page.evaluate(()=>window.probe.calls.length),1,'Confirmed block never re-enters transport');
      }
    }
    for(const retirement of ['seat','provider','unmount']){
      await mount();await page.locator('.live-race-block').click();
      await page.evaluate(retirement=>{if(retirement==='unmount'){window.dispose();window.mount();}else window[retirement]();},retirement);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await page.evaluate(()=>window.release(0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await inspect(retirement+' retires old accepted block callbacks',{busy:false,alerts:0,notices:0,blocked:0});
      if(!baseline){await page.locator('summary').click();await page.locator('.live-race-block').click();await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();
        await inspect(retirement+' leaves replacement safety actions eligible',{busy:false,alerts:0,notices:1,blocked:1});}
    }
    await mount();await page.locator('.live-race-block').click();await page.clock.runFor(10000);
    await page.evaluate(()=>window.release(0,{blocked:false}));await page.evaluate(()=>Promise.resolve());
    if(!baseline)await inspect('invalid current late receipt cannot authorize block',{busy:false,alerts:1,notices:0,blocked:0});
    for(const failure of ['sync','async']){
      await mount();await page.evaluate(failure=>window.probe.callbackFailure=failure,failure);
      await page.locator('.live-race-block').click();await page.evaluate(()=>window.release(0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      await inspect(failure+' optional callback cannot reject confirmed block',{busy:false,alerts:0,notices:1,blocked:1});
    }
    await mount();await page.locator('.live-race-block').click();await page.evaluate(()=>window.release(0,{blocked:false}));await page.getByRole('alert').waitFor();
    await inspect('invalid authority receipt remains unconfirmed',{busy:false,alerts:1,notices:0,blocked:0});
    await page.getByRole('alert').getByRole('button').click();await page.evaluate(()=>window.release(1));await page.getByRole('status').waitFor();
    const controls=await page.locator('.live-race-safety button, .live-race-safety select').evaluateAll(elements=>elements.map(element=>{
      const style=getComputedStyle(element);return {text:element.textContent,color:style.color,background:style.backgroundColor,
        disabled:element.disabled,rect:element.getBoundingClientRect().toJSON()};}));
    assert.ok(controls.every(control=>control.rect.height>=44&&control.rect.x>=0&&control.rect.right<=width),'Safety controls retain visible touch targets inside the viewport');
    await writeFile(path.join(output,`controls-${width}.json`),JSON.stringify(controls,null,2));
    await page.screenshot({path:path.join(output,`safety-recovered-${width}.png`)});
    observations.push({width,name:'uncaught errors',expected:[],actual:errors});if(!baseline)assert.deepEqual(errors,[]);
    await context.close();console.log((baseline?'BASELINE ':'PASS ')+width+'px live safety recovery and request ownership');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline live safety regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
