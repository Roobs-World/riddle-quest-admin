import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const component=path.join(root,'src/web/play/race/components/LiveRaceInviteShare.tsx');
const baseline=process.env.LIVE_NATIVE_INVITE_BASELINE_SOURCE;
const output=path.resolve(process.env.LIVE_NATIVE_INVITE_REPORT_DIR??path.join(root,'builds/test-evidence/game-native-invite-2026-10-03'));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/native-invite-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceInviteShare} from ${JSON.stringify(component)};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root,'src/web/play/sharing/ReferralSharingCapability.tsx'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
import ${JSON.stringify(path.join(root,'src/web/styles.race-lobby.css'))};
window.probe={calls:[],pending:[]};
function share(generation){return input=>{window.probe.calls.push({input:{...input},generation});
  return new Promise((resolve,reject)=>window.probe.pending.push({resolve,reject}));};}
function Harness(){const [challenge,setChallenge]=React.useState('live_'+'a'.repeat(64)),[transport,setTransport]=React.useState(()=>({shareChallenge:share(1)})),
  [fallback,setFallback]=React.useState(()=>({rewardCoins:0,shareLiveRace:share(7)})),[version,setVersion]=React.useState(0);
  window.replace=kind=>{if(kind==='challenge')setChallenge('live_'+'b'.repeat(64));
    if(kind==='transport')setTransport({shareChallenge:share(2)});
    if(kind==='callback'){transport.shareChallenge=share(3);setVersion(value=>value+1);}
    if(kind==='fallback')setTransport(undefined);if(kind==='missing'){setTransport(undefined);setFallback(undefined);}
    if(kind==='restore')setTransport({shareChallenge:share(4)});if(kind==='profile')setVersion(value=>value+1);};
  return <ReferralSharingProvider capability={fallback}><section className='race-screen' role='dialog'>
    <h1>Native invitation fixture</h1><p>Lobby {challenge.slice(-1)} / profile {version}</p><div className='race-panel'>
    <LiveRaceInviteShare challengeId={challenge} transport={transport}/></div></section></ReferralSharingProvider>;}
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);
  root.render(<React.StrictMode><Harness/></React.StrictMode>);window.dispose=()=>{root.unmount();node.remove();};};
window.release=(index,value='success')=>window.probe.pending[index].resolve(value);
window.reject=index=>window.probe.pending[index].reject(new Error('Injected native dialog failure'));
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="background:#142234;margin:0"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',plugins:[{name:'native-invite-baseline',enforce:'pre',async load(id){if(baseline&&id===component)return readFile(baseline,'utf8');}}],build:{outDir:'dist'}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname;
    const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const button=page.locator('.live-race-invite-share > button');
    const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const mount=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.install();await page.evaluate(()=>window.mount());await button.waitFor();};
    const inspect=async(name,expected)=>{await flush();const actual=await page.evaluate(()=>({
      busy:document.querySelector('.live-race-invite-share > button')?.getAttribute('aria-busy')==='true',
      alerts:document.querySelectorAll('[role=alert]').length,calls:window.probe.calls.length}));
      observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    await mount();await button.click();await page.evaluate(()=>document.querySelector('.live-race-invite-share > button').click());
    await page.clock.runFor(60000);
    await inspect('elapsed time never admits an overlapping native dialog',{busy:true,alerts:0,calls:1});
    await page.evaluate(()=>window.release(0,'cancelled'));await inspect('dismissal releases admission without an error',{busy:false,alerts:0,calls:1});
    await button.click();await page.evaluate(()=>window.release(1,'error'));await inspect('current provider failure offers retry',{busy:false,alerts:1,calls:2});
    await button.click();await page.evaluate(()=>window.release(2));await inspect('successful current retry clears failure',{busy:false,alerts:0,calls:3});
    for(const kind of ['challenge','transport','callback','fallback']){
      for(const thrown of [false,true]){
        await mount();await button.click();await page.evaluate(kind=>window.replace(kind),kind);await flush();
        await inspect(kind+' replacement retains native occupancy',{busy:true,alerts:0,calls:1});
        await page.evaluate(()=>document.querySelector('.live-race-invite-share > button').click());
        if(thrown)await page.evaluate(()=>window.reject(0));else await page.evaluate(()=>window.release(0,'error'));
        await inspect(kind+' replacement ignores old '+(thrown?'rejection':'error result'),{busy:false,alerts:0,calls:1});
        if(!baseline){await button.click();const call=await page.evaluate(()=>window.probe.calls[1]);
          assert.equal(call.input.challengeId,'live_'+(kind==='challenge'?'b':'a').repeat(64));
          assert.equal(call.generation,{challenge:1,transport:2,callback:3,fallback:7}[kind]);
          await page.evaluate(()=>window.release(1,'cancelled'));}
      }
      await mount();await button.click();await page.evaluate(()=>window.release(0,'error'));await page.getByRole('alert').waitFor();
      await page.evaluate(kind=>window.replace(kind),kind);await inspect(kind+' replacement removes an earlier failure notice',{busy:false,alerts:0,calls:1});
    }
    await mount();await button.click();await page.evaluate(()=>window.replace('profile'));await page.evaluate(()=>window.release(0,'error'));
    await inspect('ordinary rerender retains current dialog ownership',{busy:false,alerts:1,calls:1});
    await page.evaluate(()=>window.replace('profile'));await inspect('ordinary rerender retains a current failure notice',{busy:false,alerts:1,calls:1});
    await mount();await button.click();await page.evaluate(()=>window.replace('missing'));await flush();assert.equal(await button.count(),0);
    await page.evaluate(()=>window.replace('restore'));await inspect('capability restoration retains pending native occupancy',{busy:true,alerts:0,calls:1});
    await page.evaluate(()=>window.release(0,'error'));await inspect('restored capability ignores the removed provider error',{busy:false,alerts:0,calls:1});
    for(const value of [null,'unknown']){
      await mount();await button.click();await page.evaluate(value=>window.release(0,value),value);
      await inspect('malformed '+String(value)+' outcome exposes retry',{busy:false,alerts:1,calls:1});
    }
    for(const thrown of [false,true]){
      await mount();await button.click();await page.evaluate(()=>window.dispose());
      if(thrown)await page.evaluate(()=>window.reject(0));else await page.evaluate(()=>window.release(0,'error'));
      await page.evaluate(()=>window.mount());await button.waitFor();await inspect('unmounted '+(thrown?'rejection':'error')+' cannot enter a new panel',{busy:false,alerts:0,calls:1});
    }
    const rect=await button.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.height>=48);
    await writeFile(path.join(output,`controls-${width}.json`),JSON.stringify(rect,null,2));
    await page.screenshot({path:path.join(output,`native-invite-${width}.png`)});
    observations.push({width,name:'uncaught errors',expected:[],actual:errors});if(!baseline)assert.deepEqual(errors,[]);
    await context.close();console.log((baseline?'BASELINE ':'PASS ')+width+'px native invitation ownership and exclusion');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline native invitation regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
