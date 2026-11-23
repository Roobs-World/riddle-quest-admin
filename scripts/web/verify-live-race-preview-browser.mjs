import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const component=path.join(root,"src/races/components/invitations/LiveRaceInvitationCard.tsx");
const baseline=process.env.LIVE_PREVIEW_BASELINE_SOURCE;
const reactMode=process.env.LIVE_PREVIEW_REACT_MODE??'development';
assert.ok(['development','production'].includes(reactMode));
const output=path.resolve(process.env.LIVE_PREVIEW_REPORT_DIR??path.join(root,'builds/test-evidence/game-invitation-preview-2026-10-03',reactMode==='production'?'production':''));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/invitation-preview-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {LiveRaceInvitationCard} from ${JSON.stringify(component)};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
import ${JSON.stringify(path.join(root,"src/races/styles/lobby.css"))};
window.probe={calls:[],pending:[],accepted:[],commits:[],timers:new Set(),timerAllocations:0};
window.row=(name='Alice',letter='a',status='available',categoryId='mixed',locale='en')=>({challengeId:'live_'+letter.repeat(64),locale,categoryId,
  creator:{displayName:name,avatarUrl:null,bot:false,correctCount:0},expiresAtMs:Date.now()+900000,status});
window.watchTimers=()=>{const schedule=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window);
  window.setTimeout=(callback,delay,...args)=>{if(delay!==8000)return schedule(callback,delay,...args);window.probe.timerAllocations++;const id=schedule(()=>{window.probe.timers.delete(id);callback(...args);},delay);window.probe.timers.add(id);return id;};
  window.clearTimeout=id=>{window.probe.timers.delete(id);clear(id);};};
function read(generation){return input=>{window.probe.calls.push({generation,input:{...input}});return new Promise((resolve,reject)=>window.probe.pending.push({generation,resolve,reject,settled:false}));};}
function Harness(){const [transport,setTransport]=React.useState(()=>({challenge:read(1)})),[challenge,setChallenge]=React.useState('live_'+'a'.repeat(64)),
  [cached,setCached]=React.useState(window.initialCache),[locale,setLocale]=React.useState('en'),[version,setVersion]=React.useState(0),[shown,setShown]=React.useState(true);
  const changed=React.useRef(false);
  window.replace=kind=>{changed.current=true;if(kind==='transport')setTransport({challenge:read(2)});
    if(kind==='callback'){transport.challenge=read(3);setVersion(value=>value+1);}if(kind==='challenge')setChallenge('live_'+'b'.repeat(64));};
  window.cache=value=>{changed.current=true;setCached(value);};window.profile=()=>setVersion(value=>value+1);window.locale=value=>setLocale(value);
  React.useLayoutEffect(()=>{if(window.closeAtCommit)setShown(false);if(changed.current){changed.current=false;
    const names=[...document.querySelectorAll('.live-race-invitation h2')].map(node=>node.textContent),button=document.querySelector('.live-race-invitation .race-primary');
    const before=window.probe.accepted.length;if(window.tapDuringCommit)button?.click();window.probe.commits.push({names,canAccept:!!button,accepted:window.probe.accepted.length-before});}},[transport,challenge,cached,version]);
  return <section className='race-screen' role='dialog'><h1>Invitation preview fixture</h1><p>Preview profile {version}</p>{shown&&
    <LiveRaceInvitationCard transport={transport} challengeId={challenge} initialChallenge={cached} locale={locale} onAccept={selection=>window.probe.accepted.push(selection)}/>}</section>;}
window.mount=()=>{const node=document.createElement('div');node.id='root';document.body.appendChild(node);const root=createRoot(node);root.render(<React.StrictMode><Harness/></React.StrictMode>);
  window.dispose=()=>{root.unmount();node.remove();};};
window.release=(generation,value)=>{for(const pending of window.probe.pending)if(!pending.settled&&pending.generation===generation){pending.settled=true;pending.resolve(value??window.row());}};
window.reject=generation=>{for(const pending of window.probe.pending)if(!pending.settled&&pending.generation===generation){pending.settled=true;pending.reject(new Error('Injected preview failure'));}};
`);
await writeFile(path.join(scratch,'index.html'),'<html><body style="margin:0;background:#142234"><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
  await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(reactMode)},plugins:[{name:'preview-baseline',enforce:'pre',async load(id){if(baseline&&id===component)return readFile(baseline,'utf8');}}],build:{outDir:'dist',minify:false}});
  server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
    response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(await readFile(file));
  }catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const mount=async(options={})=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.clock.install();await page.evaluate(options=>{
      window.closeAtCommit=!!options.close;window.initialCache=options.cache?window.row():undefined;window.watchTimers();window.mount();},options);await page.getByRole('heading',{name:'Invitation preview fixture'}).waitFor();await flush();};
    const metric=async(name,actual,expected)=>{observations.push({width,name,expected,actual});if(!baseline)assert.deepEqual(actual,expected,name);};
    const inspect=async(name,expected)=>{await flush();await metric(name,await page.evaluate(()=>({names:[...document.querySelectorAll('.live-race-invitation h2')].map(node=>node.textContent),
      canAccept:!!document.querySelector('.live-race-invitation .race-primary'),retry:!![...document.querySelectorAll('.live-race-invitation button')].find(node=>node.textContent==='Retry')})),expected);};
    const load=async()=>{await page.evaluate(()=>window.release(1));await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();};
    await mount();await metric('effect replay dispatches one owned preview request',await page.evaluate(()=>window.probe.calls.length),1);
    await page.evaluate(()=>window.profile());await metric('ordinary rerender preserves a pending read',await page.evaluate(()=>window.probe.calls.length),baseline&&reactMode==='development'?2:1);
    await load();await page.getByRole('button',{name:'Accept challenge',exact:true}).click();
    await metric('explicit acceptance uses the exact validated authority selection',await page.evaluate(()=>window.probe.accepted.at(-1)),{categoryId:'mixed',locale:'en',challengeId:'live_'+'a'.repeat(64)});
    await mount({close:true});await metric('retirement before the queued read prevents transport dispatch',await page.evaluate(()=>window.probe.calls.length),0);
    await metric('early retirement clears the local read deadline',await page.evaluate(()=>window.probe.timers.size),0);
    for(const kind of ['transport','callback','challenge']){
      await mount();await load();await page.evaluate(kind=>{window.tapDuringCommit=true;window.replace(kind);},kind);await flush();
      await metric(kind+' commit removes the retired acceptance control',await page.evaluate(()=>window.probe.commits.at(-1)),{names:[],canAccept:false,accepted:0});
      await page.evaluate(()=>window.tapDuringCommit=false);
      if(!baseline){const generation=kind==='transport'?2:kind==='callback'?3:1;await page.evaluate(({generation,kind})=>window.release(generation,window.row('Carol',kind==='challenge'?'b':'a','available','history')),{generation,kind});
        await page.getByRole('heading',{name:'Carol challenged you',exact:true}).waitFor();await page.getByRole('button',{name:'Accept challenge',exact:true}).click();
        await metric(kind+' replacement accepts the new canonical category',await page.evaluate(()=>window.probe.accepted.at(-1)),{categoryId:'history',locale:'en',challengeId:'live_'+(kind==='challenge'?'b':'a').repeat(64)});}
    }
    await mount();await page.evaluate(()=>window.replace('transport'));await page.evaluate(()=>window.release(1));
    await inspect('late retired receipt cannot populate replacement preview',{names:[],canAccept:false,retry:false});
    await page.evaluate(()=>window.release(2));await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
    await mount({cache:true});await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
    await metric('validated inbox preview uses no authority request',await page.evaluate(()=>window.probe.calls.length),0);
    await metric('validated inbox preview allocates no read deadline',await page.evaluate(()=>window.probe.timerAllocations),0);
    await page.evaluate(()=>{window.tapDuringCommit=true;window.cache(window.row('Carol','a','unavailable','history'));});await flush();
    await metric('fresh unavailable inbox receipt retires acceptance in its first commit',await page.evaluate(()=>window.probe.commits.at(-1)),{names:['Carol challenged you'],canAccept:false,accepted:0});
    await inspect('unavailable server invitation remains unacceptable',{names:['Carol challenged you'],canAccept:false,retry:false});
    await page.evaluate(()=>{window.tapDuringCommit=false;window.cache({status:'available'});});await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
    await inspect('malformed cached receipt exposes recovery without rendering an identity',{names:[],canAccept:false,retry:true});
    await page.getByRole('button',{name:'Retry',exact:true}).click();await flush();
    await metric('explicit retry of malformed inbox data reads the canonical preview',await page.evaluate(()=>window.probe.calls.length),1);
    if(!baseline){await page.evaluate(()=>window.release(1));await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();}
    if(!baseline){await mount({cache:true});await page.evaluate(()=>window.cache({status:'available'}));await page.getByRole('button',{name:'Retry',exact:true}).click();await flush();
      await page.evaluate(()=>window.cache(window.row('Carol','a','unavailable','history')));
      await inspect('fresh cached authority receipt supersedes pending manual recovery',{names:['Carol challenged you'],canAccept:false,retry:false});
      await metric('fresh cache clears the retired recovery deadline',await page.evaluate(()=>window.probe.timers.size),0);
      await page.evaluate(()=>window.release(1));await inspect('late recovery cannot overwrite a newer cached invitation status',{names:['Carol challenged you'],canAccept:false,retry:false});}
    await mount({cache:true});await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
    await page.evaluate(()=>{window.focusTarget=document.querySelector('.live-race-invitation .race-primary');window.focusTarget.focus();window.cache(window.row('Diana','a','available','history'));});await flush();
    await metric('cached receipt refresh preserves keyboard focus',await page.evaluate(()=>document.activeElement===window.focusTarget),true);
    await page.getByRole('button',{name:'Accept challenge',exact:true}).click();
    await metric('refreshed cached preview accepts its current canonical category',await page.evaluate(()=>window.probe.accepted.at(-1)),{categoryId:'history',locale:'en',challengeId:'live_'+'a'.repeat(64)});
    for(const status of ['available','accepted','unavailable','own']){
      await mount();await page.evaluate(status=>window.release(1,window.row('Alice','a',status)),status);await page.getByRole('heading',{name:'Alice challenged you',exact:true}).waitFor();
      await inspect('server '+status+' status gates acceptance',{names:['Alice challenged you'],canAccept:['available','accepted','own'].includes(status),retry:false});
      if(status==='own'){await page.getByRole('button',{name:'Friend lobby',exact:true}).click();await metric('creator recovers only the validated original invitation',await page.evaluate(()=>window.probe.accepted.at(-1)),{categoryId:'mixed',locale:'en',challengeId:'live_'+'a'.repeat(64),resumeChallenge:true});}
    }
    await mount();await load();await page.evaluate(()=>window.locale('fr'));await inspect('content language mismatch hides acceptance immediately',{names:['Alice challenged you'],canAccept:false,retry:false});
    await mount();await page.clock.runFor(8000);await inspect('stalled preview exposes bounded retry',{names:[],canAccept:false,retry:true});
    await page.getByRole('button',{name:'Retry',exact:true}).click();await flush();await page.evaluate(()=>window.release(1));await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
    await inspect('explicit retry recovers a stalled authority preview',{names:['Alice challenged you'],canAccept:true,retry:false});
    await mount();await page.evaluate(()=>window.release(1,window.row('Wrong lobby','b')));await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
    await inspect('mismatched invitation receipt never exposes acceptance',{names:[],canAccept:false,retry:true});
    await mount();await page.evaluate(()=>window.dispose());await metric('unmount clears every preview deadline',await page.evaluate(()=>window.probe.timers.size),0);
    await page.evaluate(()=>window.reject(1));await flush();
    await mount({cache:true});await page.getByRole('button',{name:'Accept challenge',exact:true}).waitFor();
    const rect=await page.getByRole('button',{name:'Accept challenge',exact:true}).boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.height>=48);
    await writeFile(path.join(output,`controls-${width}.json`),JSON.stringify(rect,null,2));await page.screenshot({path:path.join(output,`preview-${width}.png`)});
    observations.push({width,name:'uncaught errors',expected:[],actual:errors});if(!baseline)assert.deepEqual(errors,[]);
    await context.close();console.log((baseline?'BASELINE ':'PASS ')+reactMode+' '+width+'px invitation preview ownership and reads');
  }
  await writeFile(path.join(output,baseline?'browser-before.json':'browser-after.json'),JSON.stringify(observations,null,2));
  if(baseline)assert.ok(observations.every(row=>JSON.stringify(row.actual)===JSON.stringify(row.expected)),'Baseline preview regressions reproduced');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
