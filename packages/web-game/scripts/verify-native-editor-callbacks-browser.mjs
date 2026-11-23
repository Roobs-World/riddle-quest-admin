import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.NATIVE_CALLBACK_REACT_MODE??'development';
const output=path.resolve(process.env.NATIVE_CALLBACK_REPORT_DIR??path.join(root,'../../builds/test-evidence/native-editor-callbacks-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/native-editor-callbacks-'));
const observations=[];let browser,server;
try {
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {NativeAnswerInput} from ${JSON.stringify(path.join(root,'src/play/race/components/NativeAnswerInput.tsx'))};
import {YouTubeNativeAnswerInput} from ${JSON.stringify(path.join(root,'src/playable/YouTubeNativeAnswerInput.tsx'))};
window.probe={deletions:[],text:[],errors:[],unhandled:[],speculative:0,added:0,removed:0,retained:[]};
const nativeAdd=EventTarget.prototype.addEventListener,nativeRemove=EventTarget.prototype.removeEventListener;
EventTarget.prototype.addEventListener=function(type,fn,...args){if(type==='beforeinput'&&this instanceof HTMLInputElement){window.probe.added++;window.probe.retained.push(fn);}return nativeAdd.call(this,type,fn,...args);};
EventTarget.prototype.removeEventListener=function(type,fn,...args){if(type==='beforeinput'&&this instanceof HTMLInputElement)window.probe.removed++;return nativeRemove.call(this,type,fn,...args);};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const params=new URL(location.href).searchParams,target=params.get('target')??'race',scenario=params.get('scenario')??'commit';
let unblock;const pending=new Promise(resolve=>{unblock=resolve;});window.unblock=unblock;
function Suspend({version}){if(version==='B'&&!window.allowB){window.probe.speculative++;throw pending;}return null;}
function Editor({version,disabled}){const props={disabled,locale:'en',onText:text=>window.probe.text.push({version,text}),onBackspace:()=>window.probe.deletions.push(version),onSubmit:()=>{}};return <><span data-version={version}>{version}</span>{target==='race'?<NativeAnswerInput {...props}/>:<YouTubeNativeAnswerInput {...props} label='Answer'/>}<Suspend version={version}/></>;}
function App(){const [version,setVersion]=React.useState('A'),[disabled,setDisabled]=React.useState(false),[mounted,setMounted]=React.useState(true),[tick,setTick]=React.useState(0);React.useLayoutEffect(()=>{if(!mounted&&scenario==='retire-commit')window.originalInput.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteContentBackward'}));},[mounted]);window.refresh=()=>setTick(x=>x+1);window.speculate=()=>React.startTransition(()=>setVersion('B'));window.commit=()=>{window.allowB=true;unblock();setVersion('B');};window.restore=()=>setVersion('A');window.disable=()=>setDisabled(true);window.retire=()=>setMounted(false);return <div data-tick={tick}><React.Suspense fallback={<p>Waiting</p>}>{mounted?<Editor version={version} disabled={disabled}/>:<p data-retired>Retired</p>}<button>Outside</button></React.Suspense></div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'native-editor-callback-baseline',async load(id){if(process.env.NATIVE_CALLBACK_BASELINE_DIR&&id.endsWith('/useNativeAnswerBackspace.ts'))return readFile(path.join(process.env.NATIVE_CALLBACK_BASELINE_DIR,'backspace.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.NATIVE_CALLBACK_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else {
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.NATIVE_CALLBACK_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const target of process.env.NATIVE_CALLBACK_TARGETS?.split(',')??['race','playable'])for(const scenario of process.env.NATIVE_CALLBACK_SCENARIOS?.split(',')??['commit','abandon','disabled','retire','retire-commit','composition','cancelled','stable']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>{observations.push({width,height,target,scenario,name,actual,expected});if(process.env.NATIVE_CALLBACK_MEASURE_ONLY!=='1')assert.deepEqual(actual,expected,name);};
  await page.goto(url+'/?target='+target+'&scenario='+scenario);const input=page.locator('input');await input.focus();await page.evaluate(()=>{window.originalInput=document.querySelector('input');window.speculate();});await page.waitForFunction(()=>window.probe.speculative>0);
  metric('speculative render retains committed editor',await page.locator('[data-version]').getAttribute('data-version'),'A');metric('speculative render retains native DOM identity',await page.evaluate(()=>window.originalInput===document.querySelector('input')),true);
  await page.keyboard.press('Backspace');metric('physical keyboard uses the visible committed callback',await page.evaluate(()=>window.probe.deletions),['A']);await page.evaluate(()=>{window.probe.deletions=[];});
  const baselineListeners=await page.evaluate(()=>({added:window.probe.added,removed:window.probe.removed}));metric('mounted editor owns exactly one native deletion listener',baselineListeners.added-baselineListeners.removed,1);
  const deletion=()=>page.evaluate(()=>{const event=new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteContentBackward'});document.querySelector('input').dispatchEvent(event);return event.defaultPrevented;});
  if(scenario==='retire'||scenario==='retire-commit'){await page.evaluate(()=>window.retire());await page.waitForFunction(()=>document.querySelector('[data-retired]'));await page.evaluate(()=>{const event=new InputEvent('beforeinput',{cancelable:true,inputType:'deleteContentBackward'});window.probe.retained.forEach(fn=>fn(event));});metric('retired editor cannot delete through retained or commit-boundary events',await page.evaluate(()=>window.probe.deletions),[]);metric('retirement releases its deletion listener',await page.evaluate(()=>window.probe.added-window.probe.removed),0);}
  else if(scenario==='disabled'){await page.evaluate(()=>window.disable());await page.waitForFunction(()=>document.querySelector('input').disabled);metric('disabled native deletion is not consumed',await deletion(),false);metric('disabled editor adds no deletion',await page.evaluate(()=>window.probe.deletions),[]);}
  else if(scenario==='cancelled'){await page.evaluate(()=>{const event=new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteContentBackward'});event.preventDefault();document.querySelector('input').dispatchEvent(event);});metric('cancelled input adds no deletion',await page.evaluate(()=>window.probe.deletions),[]);}
  else {
   if(scenario==='composition'){await page.evaluate(()=>{const input=document.querySelector('input');input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteContentBackward',isComposing:true}));});metric('composition owns its native deletion',await page.evaluate(()=>window.probe.deletions),[]);await page.evaluate(()=>{const input=document.querySelector('input');input.value='中';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'}));});metric('composition commits through the visible callback',await page.evaluate(()=>window.probe.text),[{version:'A',text:'中'}]);}
   if(scenario==='abandon'){await page.evaluate(()=>window.restore());await page.waitForFunction(()=>document.querySelector('[data-version]')?.getAttribute('data-version')==='A');await page.evaluate(()=>{window.allowB=true;window.unblock();});await page.waitForTimeout(30);}
   if(scenario==='stable'){await page.evaluate(()=>window.commit());await page.waitForFunction(()=>document.querySelector('[data-version]')?.getAttribute('data-version')==='B');for(let i=0;i<32;i++){await page.evaluate(()=>window.refresh());await page.waitForFunction(i=>document.querySelector('[data-tick]')?.getAttribute('data-tick')===String(i+1),i);}}
   metric('software deletion is consumed once',await deletion(),true);
   metric('software deletion uses the visible committed callback',await page.evaluate(()=>window.probe.deletions),[scenario==='stable'?'B':'A']);
   if(scenario==='commit'||scenario==='composition'){await page.evaluate(()=>window.commit());await page.waitForFunction(()=>document.querySelector('[data-version]')?.getAttribute('data-version')==='B');await deletion();metric('committed replacement uses its new callback once',await page.evaluate(()=>window.probe.deletions),['A','B']);}
   metric('ordinary committed update retains native editor and focus',await page.evaluate(()=>window.originalInput===document.querySelector('input')&&document.activeElement===window.originalInput),true);
   metric('callback updates never replace the native listener',await page.evaluate(()=>({added:window.probe.added,removed:window.probe.removed})),baselineListeners);
  }
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await context.close();
 }
 }
} finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.NATIVE_CALLBACK_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
console.log(JSON.stringify({mode,checks:observations.length,failures:observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected))},null,2));
