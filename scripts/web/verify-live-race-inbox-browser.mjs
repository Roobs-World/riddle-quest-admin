import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const component=path.join(root,'src/web/play/race/components/LiveRaceInbox.tsx');
const baseline=process.env.LIVE_INBOX_BASELINE_SOURCE;
const reactMode=process.env.LIVE_INBOX_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const output=path.resolve(process.env.LIVE_INBOX_REPORT_DIR??path.join(root,'builds/test-evidence/game-live-inbox-2026-10-03',reactMode==='production'?'production':''));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/live-inbox-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceInbox} from ${JSON.stringify(component)};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
import ${JSON.stringify(path.join(root,'src/web/styles.race-lobby.css'))};
window.probe={calls:[],pending:[],accepted:[],challengeReads:0,timers:new Set()};
window.watchTimers=()=>{const schedule=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window);
  window.setTimeout=(callback,delay,...args)=>{if(delay!==8000)return schedule(callback,delay,...args);
    const id=schedule(()=>{window.probe.timers.delete(id);callback(...args);},delay);window.probe.timers.add(id);return id;};
  window.clearTimeout=id=>{window.probe.timers.delete(id);clear(id);};};
window.row=(name='Alice',letter='a',locale='en')=>({challengeId:'live_'+letter.repeat(64),locale,categoryId:'mixed',creator:{displayName:name,avatarUrl:null,bot:false,correctCount:0},expiresAtMs:Date.now()+900000,status:'available'});
function provider(generation){return {inbox:()=>{window.probe.calls.push(generation);return new Promise((resolve,reject)=>window.probe.pending.push({generation,resolve,reject,settled:false}));},
  challenge:()=>{window.probe.challengeReads++;throw new Error('Inbox rows must not fan out additional preview reads');}};}
function Harness(){const [transport,setTransport]=React.useState(()=>provider(1)),[locale,setLocale]=React.useState('en'),[excluded,setExcluded]=React.useState(undefined),[version,setVersion]=React.useState(0);
  window.replace=()=>setTransport(provider(2));window.callback=()=>{transport.inbox=provider(3).inbox;setVersion(value=>value+1);};
  window.locale=value=>setLocale(value);window.exclude=value=>setExcluded(value);window.profile=()=>setVersion(value=>value+1);
  return <section className='race-screen' role='dialog'><h1>Invitation inbox fixture</h1><p>Transport profile {version}</p>
    <LiveRaceInbox transport={transport} locale={locale} excludeId={excluded} onAccept={selection=>window.probe.accepted.push(selection)}/></section>;}
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);
  root.render(<React.StrictMode><Harness/></React.StrictMode>);window.dispose=()=>{root.unmount();node.remove();};};
window.release=(generation,rows)=>{for(const pending of window.probe.pending)if(pending.generation===generation&&!pending.settled){pending.settled=true;pending.resolve(rows);}};
window.reject=generation=>{for(const pending of window.probe.pending)if(pending.generation===generation&&!pending.settled){pending.settled=true;pending.reject(new Error('Injected inbox transport failure'));}};
window.refresh=()=>window.dispatchEvent(new Event('riddle-quest:live-race-inbox-changed'));
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="background:#142234;margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},plugins:[{name:'live-inbox-baseline',enforce:'pre',async load(id){if(baseline&&id===component)return readFile(baseline,'utf8');}}],build:{outDir:'dist',minify:false}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname;
    const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const mount=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.install();await page.evaluate(()=>{window.watchTimers();window.mount();});
      await page.waitForFunction(()=>window.probe.calls.length>0);await flush();};
    const inspect=async(name,expected)=>{await flush();const actual=await page.evaluate(()=>({
      names:[...document.querySelectorAll('.live-race-invitation h2')].map(node=>node.textContent),
      errors:document.querySelectorAll('.race-error').length,accepts:window.probe.accepted.length}));
      observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    const metric=async(name,actual,expected)=>{observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    const load=async()=>{await page.evaluate(()=>window.release(1,[window.row()]));await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();};
    for(const kind of ['replace','callback']){
      await mount();await load();await page.evaluate(kind=>window[kind](),kind);
      await inspect(kind+' removes earlier transport cards before the new inbox settles',{names:[],errors:0,accepts:0});
      await page.evaluate(()=>document.querySelector('.live-race-invitation button')?.click());
      await metric(kind+' cannot accept the retired transport invitation',await page.evaluate(()=>window.probe.accepted.length),0);
      if(baseline)await page.evaluate(()=>window.probe.accepted=[]);
      const generation=kind==='replace'?2:3;
      if(baseline&&kind==='callback')await page.evaluate(()=>window.refresh());
      await page.evaluate(generation=>window.release(generation,[window.row('Carol','b')]),generation);
      await page.getByRole('heading',{name:'Carol challenged you',exact:true}).waitFor();
      await page.getByRole('button',{name:'Accept challenge',exact:true}).click();
      await metric(kind+' accepts only the fresh server selection',await page.evaluate(()=>window.probe.accepted.at(-1)),{categoryId:'mixed',locale:'en',challengeId:'live_'+'b'.repeat(64)});
    }
    await mount();await page.evaluate(()=>window.reject(1));await page.locator('.race-error').waitFor();await page.evaluate(()=>window.replace());
    await inspect('replacement retires the earlier read failure',{names:[],errors:0,accepts:0});
    await page.evaluate(()=>window.release(2,[]));await inspect('empty current inbox remains clear',{names:[],errors:0,accepts:0});
    await mount();await page.evaluate(()=>window.replace());await flush();
    await metric('replacement cancels retired local deadline timers',await page.evaluate(()=>window.probe.timers.size),1);
    await page.evaluate(()=>window.release(1,[window.row()]));await inspect('late retired read cannot populate replacement inbox',{names:[],errors:0,accepts:0});
    await page.evaluate(()=>window.release(2,[window.row('Carol','b')]));await page.getByRole('heading',{name:'Carol challenged you',exact:true}).waitFor();
    await mount();const initialReads=await page.evaluate(()=>window.probe.calls.length);assert.equal(initialReads,reactMode==='development'?2:1);
    await page.evaluate(()=>window.dispose());
    await metric('unmount cancels every inbox deadline',await page.evaluate(()=>window.probe.timers.size),0);
    await page.clock.runFor(15000);await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.refresh();});
    await metric('unmount removes interval and event refresh admission',await page.evaluate(()=>window.probe.calls.length),initialReads);
    await page.evaluate(()=>window.reject(1));await flush();
    await mount();await load();await page.evaluate(()=>window.refresh());const before=await page.evaluate(()=>window.probe.calls.length);
    await page.evaluate(()=>{for(let index=0;index<10;index++){window.refresh();window.dispatchEvent(new Event('focus'));}});
    await metric('refresh burst does not overlap an active read',(await page.evaluate(()=>window.probe.calls.length))-before,0);
    await page.evaluate(()=>window.release(1,[]));await flush();
    await metric('pending notification events coalesce into one immediate follow-up read',(await page.evaluate(()=>window.probe.calls.length))-before,1);
    if(!baseline){await page.evaluate(()=>window.release(1,[window.row('Diana','d')]));await page.getByRole('heading',{name:'Diana challenged you',exact:true}).waitFor();
      await inspect('coalesced follow-up exposes the newly delivered invitation without waiting for polling',{names:['Diana challenged you'],errors:0,accepts:0});}
    await mount();const beforeRetry=await page.evaluate(()=>window.probe.calls.length);
    await page.clock.runFor(8000);await inspect('stalled inbox exposes bounded retry',{names:[],errors:1,accepts:0});
    await page.evaluate(()=>{const button=document.querySelector('.race-error button');for(let index=0;index<10;index++)button.click();});await flush();
    const retryBefore=await page.evaluate(()=>window.probe.calls.length);await page.evaluate(()=>window.release(1,[window.row('Carol','b')]));
    await page.getByRole('heading',{name:'Carol challenged you',exact:true}).waitFor();await inspect('explicit retry recovers the current inbox',{names:['Carol challenged you'],errors:0,accepts:0});
    await metric('manual retry burst admits one read',retryBefore-beforeRetry,1);
    await mount();await page.evaluate(()=>window.release(1,[window.row(),window.row(),window.row('French friend','f','fr')]));await load();
    await inspect('server rows are deduplicated and filtered to the selected content language',{names:['Alice challenged you'],errors:0,accepts:0});
    const profileReads=await page.evaluate(()=>window.probe.calls.length);await page.evaluate(()=>window.profile());await inspect('profile rerender preserves owned inbox rows',{names:['Alice challenged you'],errors:0,accepts:0});
    await metric('profile rerender does not start another authority read',await page.evaluate(()=>window.probe.calls.length),profileReads);
    await page.evaluate(()=>window.exclude('live_'+'a'.repeat(64)));await inspect('launch invitation exclusion changes without another inbox read',{names:[],errors:0,accepts:0});
    await mount();await page.evaluate(()=>window.release(1,[{status:'available'}]));await page.locator('.race-error').waitFor();
    await inspect('malformed authority rows expose retry without rendering identities',{names:[],errors:1,accepts:0});
    await mount();await load();const controls=await page.locator('.live-race-invitation button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
    assert.ok(controls.every(rect=>rect.x>=0&&rect.right<=width&&rect.height>=48));
    await writeFile(path.join(output,`controls-${width}.json`),JSON.stringify(controls,null,2));
    await page.screenshot({path:path.join(output,`inbox-${width}.png`)});
    await metric('inbox previews never fan out additional challenge reads',await page.evaluate(()=>window.probe.challengeReads),0);
    observations.push({width,name:'uncaught errors',expected:[],actual:errors});if(!baseline)assert.deepEqual(errors,[]);
    await context.close();console.log((baseline?'BASELINE ':'PASS ')+width+'px invitation inbox ownership and refresh');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline inbox regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
