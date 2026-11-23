import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mode=process.env.ANSWER_COMMIT_REACT_MODE??'development';
assert.ok(['development','production'].includes(mode));
const baseline=process.env.ANSWER_COMMIT_BASELINE_DIR;
const output=path.resolve(process.env.ANSWER_COMMIT_REPORT_DIR??path.join(root,'builds/test-evidence/answer-keyboard-commit-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/answer-keyboard-commit-'));
const observations=[];let server,browser;
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useAnswerKeyboard} from ${JSON.stringify(path.join(root,'src/web/play/game/hooks/useAnswerKeyboard.ts'))};
window.probe={actions:[],adds:0,removes:0,listeners:new Set(),retained:[],speculative:0,boundaries:[],errors:[],unhandled:[]};
const nativeAdd=window.addEventListener.bind(window),nativeRemove=window.removeEventListener.bind(window);
window.addEventListener=(type,fn,...rest)=>{if(type==='keydown'){window.probe.adds++;window.probe.listeners.add(fn);window.probe.retained.push(fn);}return nativeAdd(type,fn,...rest);};
window.removeEventListener=(type,fn,...rest)=>{if(type==='keydown'){window.probe.removes++;window.probe.listeners.delete(fn);}return nativeRemove(type,fn,...rest);};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
const scenario=new URL(location.href).searchParams.get('scenario')??'spec-callbacks';let unblock;const pending=new Promise(resolve=>unblock=resolve);window.unblock=unblock;
function Suspend({version}){if(version==='B'&&!window.allowB){window.probe.speculative++;throw pending;}return null;}
function Surface({version,active,tick}){useAnswerKeyboard({active,onLetter:letter=>window.probe.actions.push({version,tick,kind:'letter',letter}),onBackspace:()=>window.probe.actions.push({version,tick,kind:'backspace'}),onSubmit:()=>window.probe.actions.push({version,tick,kind:'submit'})});return <section data-version={version} data-active={String(active)}><h1>Visible answer owner: {version}</h1><p>Physical P, Backspace and Enter exercise the actual answer keyboard hook.</p><input aria-label='Unrelated text field'/><button>Other control</button><Suspend version={version}/></section>;}
function App(){const [version,setVersion]=React.useState('A'),[active,setActive]=React.useState(scenario!=='activate-commit'),[mounted,setMounted]=React.useState(true),[tick,setTick]=React.useState(0);
 React.useLayoutEffect(()=>{if(scenario.endsWith('-commit')&&(scenario==='activate-commit'?active:(version==='B'||!active||!mounted))){const event=new KeyboardEvent('keydown',{key:'p',bubbles:true,cancelable:true});window.dispatchEvent(event);window.probe.boundaries.push({visible:document.querySelector('[data-version]')?.dataset.version??null,active:document.querySelector('[data-active]')?.dataset.active??null,listeners:window.probe.listeners.size,prevented:event.defaultPrevented});}},[version,active,mounted]);
 window.refresh=()=>setTick(x=>x+1);window.speculate=()=>React.startTransition(()=>{setVersion('B');if(scenario==='spec-inactive')setActive(false);});window.commit=()=>{window.allowB=true;unblock();setVersion('B');};window.abandon=()=>{setVersion('A');setActive(true);};window.retire=()=>setMounted(false);window.disable=()=>setActive(false);
 return <div data-tick={tick}><React.Suspense fallback={<p>Waiting for replacement</p>}>{mounted?<Surface version={version} active={active} tick={tick}/>:<p data-retired>Answer owner removed</p>}</React.Suspense><button data-speculate onClick={window.speculate}>Prepare suspended replacement</button><button data-commit onClick={window.commit}>Commit replacement</button><button data-retire onClick={window.retire}>Retire answer owner</button><button data-disable onClick={window.disable}>Disable answer owner</button><button data-activate onClick={()=>setActive(true)}>Activate answer owner</button><button data-abandon onClick={window.abandon}>Abandon replacement</button></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'captured-answer-keyboard',async load(id){if(baseline&&id.endsWith('/useAnswerKeyboard.ts'))return readFile(path.join(baseline,'keyboard.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.ANSWER_COMMIT_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.ANSWER_COMMIT_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.ANSWER_COMMIT_SCENARIOS?.split(',')??['spec-callbacks','spec-inactive','abandon','commit','retire','retire-commit','replace-commit','inactive-commit','activate-commit','stable','text-field']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);await page.locator('[data-version="A"]').waitFor();await page.waitForFunction(expected=>window.probe.listeners.size===expected,scenario==='activate-commit'?0:1);await page.evaluate(()=>window.originalOwner=document.querySelector('[data-version]'));
  const initial=await page.evaluate(()=>({adds:window.probe.adds,removes:window.probe.removes}));metric('initial editor owns a listener only when active',await page.evaluate(()=>window.probe.listeners.size),scenario==='activate-commit'?0:1);
  if(['spec-callbacks','spec-inactive','abandon','commit'].includes(scenario)){await page.locator('[data-speculate]').click();await page.waitForFunction(()=>window.probe.speculative>0);metric('suspended replacement retains visible owner A',await page.locator('[data-version]').getAttribute('data-version'),'A');metric('suspended replacement retains active visible editor',await page.locator('[data-active]').getAttribute('data-active'),'true');metric('suspended replacement retains the mounted DOM',await page.evaluate(()=>window.originalOwner===document.querySelector('[data-version]')),true);}
  if(scenario==='retire'||scenario==='retire-commit'){await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();}
  else if(scenario==='inactive-commit'){await page.locator('[data-disable]').click();await page.waitForFunction(()=>document.querySelector('[data-active]')?.dataset.active==='false');}
  else if(scenario==='activate-commit'){await page.locator('[data-activate]').click();await page.waitForFunction(()=>document.querySelector('[data-active]')?.dataset.active==='true');}
  else if(scenario==='replace-commit'){await page.locator('[data-commit]').click();await page.waitForFunction(()=>document.querySelector('[data-version]')?.dataset.version==='B');}
  else if(scenario==='abandon'){await page.locator('[data-abandon]').click();await page.evaluate(()=>{window.allowB=true;window.unblock();});await page.waitForTimeout(40);metric('abandoned replacement leaves owner A visible',await page.locator('[data-version]').getAttribute('data-version'),'A');}
  else if(scenario==='stable'){for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-tick]')?.dataset.tick===String(i+1),i);}}
  if(scenario.endsWith('-commit')){
   metric('commit-boundary event observes the current DOM and ownership',await page.evaluate(()=>window.probe.boundaries),[{visible:scenario==='replace-commit'?'B':['inactive-commit','activate-commit'].includes(scenario)?'A':null,active:['replace-commit','activate-commit'].includes(scenario)?'true':scenario==='inactive-commit'?'false':null,listeners:['replace-commit','activate-commit'].includes(scenario)?1:0,prevented:['replace-commit','activate-commit'].includes(scenario)}]);
   metric('commit-boundary event cannot reach a retired editor',await page.evaluate(()=>window.probe.actions),['replace-commit','activate-commit'].includes(scenario)?[{version:scenario==='replace-commit'?'B':'A',tick:0,kind:'letter',letter:'P'}]:[]);await page.evaluate(()=>window.probe.actions=[]);
  }
  if(scenario==='text-field'){await page.getByRole('textbox',{name:'Unrelated text field'}).focus();await page.keyboard.type('p');await page.keyboard.press('Backspace');await page.keyboard.press('Enter');metric('text fields retain native editing',await page.getByRole('textbox').inputValue(),'');}
  else{await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('p');await page.keyboard.press('Backspace');await page.keyboard.press('Enter');}
  const accepts=!['retire','retire-commit','inactive-commit','text-field'].includes(scenario),version=scenario==='replace-commit'?'B':'A',tick=scenario==='stable'?32:0;
  metric('physical keyboard delivers once to the visible committed owner',await page.evaluate(()=>window.probe.actions),accepts?[{version,tick,kind:'letter',letter:'P'},{version,tick,kind:'backspace'},{version,tick,kind:'submit'}]:[]);
  metric('current editor has exactly the required listener',await page.evaluate(()=>window.probe.listeners.size),['retire','retire-commit','inactive-commit'].includes(scenario)?0:1);
  if(scenario==='commit'){await page.locator('[data-commit]').click();await page.waitForFunction(()=>document.querySelector('[data-version]')?.dataset.version==='B');await page.evaluate(()=>{window.probe.actions=[];document.activeElement?.blur();});await page.keyboard.type('p');await page.keyboard.press('Backspace');await page.keyboard.press('Enter');metric('committed replacement receives each physical action once',await page.evaluate(()=>window.probe.actions),[{version:'B',tick:0,kind:'letter',letter:'P'},{version:'B',tick:0,kind:'backspace'},{version:'B',tick:0,kind:'submit'}]);}
  if(!['retire','retire-commit','inactive-commit'].includes(scenario)){metric('ordinary updates preserve listener registrations',await page.evaluate(()=>({adds:window.probe.adds,removes:window.probe.removes})),scenario==='activate-commit'?{adds:initial.adds+1,removes:initial.removes}:initial);metric('ordinary updates preserve mounted editor identity',await page.evaluate(()=>window.originalOwner===document.querySelector('[data-version]')),true);}
  metric('no browser errors',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promises',await page.evaluate(()=>window.probe.unhandled),[]);await page.screenshot({path:path.join(output,[width,height,scenario].join('-')+'.png')});await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.ANSWER_COMMIT_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.ANSWER_COMMIT_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Answer keyboard commit ownership');
