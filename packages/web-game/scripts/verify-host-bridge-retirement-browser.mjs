import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.HOST_RETIRE_REACT_MODE??'development',baseline=process.env.HOST_RETIRE_BASELINE_DIR;
const output=path.resolve(process.env.HOST_RETIRE_REPORT_DIR??path.join(root,'../../builds/test-evidence/host-bridge-retirement-2026-10-04',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/host-retire-'));
const source=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {useHostBridgeLifecycle} from ${JSON.stringify(path.join(root,'src/play/useHostBridgeLifecycle.ts'))};
import {useHostAuthSession} from ${JSON.stringify(path.join(root,'src/play/useHostAuthSession.ts'))};
import {createHostMessageRouter,BridgeParserLoadError} from ${JSON.stringify(path.join(root,'src/play/bridgeRouter.ts'))};
import {dispatchLocalBridge,GAME_TO_HOST_EVENT,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(root,'src/play/localBridge.ts'))};
import {configureBrowserErrorReporter} from ${JSON.stringify(path.join(root,'src/observability/browserErrorReporter.ts'))};
import {BRIDGE_PROTOCOL_VERSION} from '@riddle-quest/core/bridge';
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;window.probe={guesses:[],completions:[],errors:[],unhandled:[],suspended:0,calls:[],messages:[],notices:[],recoveries:[],reports:[],bridgeAdds:0,bridgeRemoves:0,visibilityAdds:0,visibilityRemoves:0};
window.addEventListener('error',event=>window.probe.errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>window.probe.unhandled.push(String(event.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const service=createFakeHostServices();const hosted={};for(const version of ['A','B'])hosted[version]=createHostedPlaySession({hostServices:{...service,submitGuess:async input=>{window.probe.guesses.push({version,guess:input.guess,requestId:input.requestId});return service.submitGuess(input);},completeGame:async input=>{window.probe.completions.push(version);return service.completeGame(input);}},economyAvailable:false,raceAvailable:false});
window.hostMessages=[];window.addEventListener(HOST_TO_GAME_EVENT,e=>window.hostMessages.push(e.detail.type));
const scenario=new URL(location.href).searchParams.get('scenario')??'hosted';
const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window),docAdd=document.addEventListener.bind(document),docRemove=document.removeEventListener.bind(document);
window.addEventListener=(type,...args)=>{if(type===GAME_TO_HOST_EVENT)window.probe.bridgeAdds++;return add(type,...args);};window.removeEventListener=(type,...args)=>{if(type===GAME_TO_HOST_EVENT)window.probe.bridgeRemoves++;return remove(type,...args);};document.addEventListener=(type,...args)=>{if(type==='visibilitychange')window.probe.visibilityAdds++;return docAdd(type,...args);};document.removeEventListener=(type,...args)=>{if(type==='visibilitychange')window.probe.visibilityRemoves++;return docRemove(type,...args);};
add(GAME_TO_HOST_EVENT,e=>{if(e.detail?.type==='game:submitGuess')window.lastGuess=e.detail;});
configureBrowserErrorReporter((error,context)=>window.probe.reports.push({message:String(error),context}));
function createLifecycle(id){return {id,callbacks:[],onPause(fn){this.callbacks.push({kind:'pause',fn,active:true});const entry=this.callbacks.at(-1);return()=>{entry.active=false;};},onResume(fn){this.callbacks.push({kind:'resume',fn,active:true});const entry=this.callbacks.at(-1);return()=>{entry.active=false;};}};}const providers={A:createLifecycle('A'),B:createLifecycle('B')};window.fireLifecycle=(kind,id='A',retained=false)=>{for(const entry of providers[id].callbacks)if((entry.active||retained)&&entry.kind===kind)entry.fn();};
window.emitBridge=()=>dispatchLocalBridge(GAME_TO_HOST_EVENT,{type:'game:ready',requestId:'committed-ready',payload:{protocolVersion:BRIDGE_PROTOCOL_VERSION}});
window.visibility=state=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:state});document.dispatchEvent(new Event('visibilitychange'));};
function Bridge({version}){const [notice,setNotice]=React.useState(null);const auth=useHostAuthSession({services:{auth:service.auth},postToGame:React.useCallback(()=>{},[])});
const router=React.useMemo(()=>createHostMessageRouter({ready:()=>{window.probe.calls.push(version);if(window.holdBridge)return new Promise((resolve,reject)=>{window.rejectBridge=()=>reject(scenario.includes('unavailable')?new BridgeParserLoadError(new Error('Fixture validation unavailable')):new Error('Fixture route failed'));window.resolveBridge=resolve;});}}),[version]);
const owned=auth.captureAccount(auth.snapshot.user?.uid);
useHostBridgeLifecycle({router,postToGame:message=>window.probe.messages.push({version,type:message.type}),setNotice:value=>{window.probe.notices.push({version,value});setNotice(value);},ownsMessage:scenario==='speculative-guard'&&version==='B'?()=>false:owned,onUnavailable:scenario==='removed-unavailable'&&version==='B'?undefined:()=>window.probe.recoveries.push(version),lifecycle:scenario==='callback-commit'?providers.A:providers[version]});return <output data-owner={auth.snapshot.user?.uid??''}>{notice??'Ready'}</output>;}
let unblock;const pending=new Promise(resolve=>unblock=resolve);window.unblock=unblock;
function Suspend({version}){if(version==='B'&&!window.allowB){window.probe.suspended++;throw pending;}return null;}
function App(){const [version,setVersion]=React.useState('A'),[mounted,setMounted]=React.useState(true);window.retire=()=>setMounted(false);window.remount=()=>setMounted(true);window.speculate=()=>React.startTransition(()=>setVersion('B'));window.commit=()=>{window.allowB=true;unblock();setVersion('B');};
React.useLayoutEffect(()=>{if(!mounted){window.probe.commit={hostRemoved:!document.querySelector('main,[data-owner]'),listeners:window.probe.bridgeAdds-window.probe.bridgeRemoves};if(scenario==='hosted')dispatchLocalBridge(GAME_TO_HOST_EVENT,{...window.lastGuess,requestId:'retired-guess',payload:{...window.lastGuess.payload,guess:'XXXXX',requestId:'retired-guess'}});else if(scenario==='command'||scenario==='remount')window.emitBridge();else if(scenario.includes('held'))window.rejectBridge();else{window.fireLifecycle('pause');window.fireLifecycle('resume');window.visibility('hidden');window.visibility('visible');}}else if(version==='B'&&['provider-commit','callback-commit'].includes(scenario)){window.probe.commit={hostRemoved:false,listeners:window.probe.bridgeAdds-window.probe.bridgeRemoves};window.fireLifecycle('pause');window.fireLifecycle('resume');}},[mounted,version]);
return <React.Suspense fallback={<p>Waiting</p>}><div data-version={version}>{mounted?(scenario==='hosted'?<PlayHostApp session={hosted[version]}/>:<Bridge version={version}/>):<p data-retired>Retired</p>}<button data-retire onClick={()=>setMounted(false)}>Retire fixture</button><Suspend version={version}/></div></React.Suspense>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`;
await writeFile(path.join(scratch,'main.tsx'),source);await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let server,browser;const observations=[];
try{
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'host-retire-baseline',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useHostBridgeLifecycle.ts'))return readFile(path.join(baseline,'bridge.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false}});
 server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 if(process.env.HOST_RETIRE_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.HOST_RETIRE_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.HOST_RETIRE_SCENARIOS?.split(',')??['hosted','command','lifecycle','held-error','held-unavailable','provider-commit','callback-commit','speculative','remount']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  await page.goto(url+'/?scenario='+scenario);
  if(scenario==='hosted'){
   await page.getByText('What has keys but cannot open doors?',{exact:true}).waitFor();if(await page.getByRole('button',{name:"Let's Play",exact:true}).count())await page.getByRole('button',{name:"Let's Play",exact:true}).click();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('zzzzz');await page.getByRole('button',{name:/^submit$/i}).click();await page.waitForFunction(()=>document.querySelector('.keyboard button.red'));
   metric('visible hosted game admits its explicit answer once',await page.evaluate(()=>window.probe.guesses.length),1);
  }else{await page.waitForFunction(()=>document.querySelector('[data-owner]')?.dataset.owner==='jest-guest');await page.evaluate(()=>window.emitBridge());await page.waitForFunction(()=>window.probe.calls.length===1);}
  if(scenario.includes('held')){await page.evaluate(()=>{window.holdBridge=true;window.emitBridge();});await page.waitForFunction(()=>!!window.rejectBridge);}
  const before=await page.evaluate(()=>({calls:window.probe.calls.length,messages:window.probe.messages.length,hostMessages:window.hostMessages.length,guesses:window.probe.guesses.length}));
  if(['provider-commit','callback-commit'].includes(scenario)){await page.evaluate(()=>window.commit());await page.waitForFunction(()=>document.querySelector('[data-version]')?.dataset.version==='B');}
  else if(scenario==='speculative'){await page.evaluate(()=>window.speculate());await page.waitForFunction(()=>window.probe.suspended>0);await page.evaluate(()=>{window.fireLifecycle('pause');window.fireLifecycle('resume');window.emitBridge();});}
  else{await page.locator('[data-retire]').click();await page.locator('[data-retired]').waitFor();}
  await page.waitForTimeout(100);
  if(scenario==='speculative'){metric('unfinished retirement keeps the committed host available',await page.locator('[data-version]').getAttribute('data-version'),'A');metric('unfinished retirement keeps current commands',await page.evaluate(before=>window.probe.calls.length-before.calls,before),1);metric('unfinished retirement keeps current lifecycle signals',await page.evaluate(()=>window.probe.messages),[{version:'A',type:'host:pause'},{version:'A',type:'host:resume'}]);}
  else if(['provider-commit','callback-commit'].includes(scenario)){
   metric('provider commit exercises the old registered callbacks before passive cleanup',await page.evaluate(()=>window.probe.commit.listeners),1);
   metric('only the committed subscription may deliver during provider commit',await page.evaluate(()=>window.probe.messages),scenario==='provider-commit'?[]:[{version:'B',type:'host:pause'},{version:'B',type:'host:resume'}]);
   await page.evaluate(scenario=>{window.fireLifecycle('pause',scenario==='provider-commit'?'B':'A');window.emitBridge();},scenario);await page.waitForTimeout(40);
   metric('replacement subscription remains immediately usable after setup',await page.evaluate(()=>window.probe.messages.at(-1)),{version:'B',type:'host:pause'});metric('replacement command is delivered once',await page.evaluate(()=>window.probe.calls),['A','B']);
  }else{
   metric('retirement happens before passive bridge listener cleanup',await page.evaluate(()=>window.probe.commit),{hostRemoved:true,listeners:1});
   metric('removed host cannot admit another authority command',await page.evaluate(before=>({calls:window.probe.calls.length-before.calls,guesses:window.probe.guesses.length-before.guesses}),before),{calls:0,guesses:0});
   metric('removed host cannot deliver lifecycle messages',await page.evaluate(before=>window.probe.messages.length-before.messages,before),0);
   metric('removed host cannot report delayed notices or recovery',await page.evaluate(()=>({notices:window.probe.notices,recoveries:window.probe.recoveries,reports:window.probe.reports})),{notices:[],recoveries:[],reports:[]});
   metric('retirement releases bridge and visibility subscriptions',await page.evaluate(()=>({bridge:window.probe.bridgeAdds-window.probe.bridgeRemoves,visibility:window.probe.visibilityAdds-window.probe.visibilityRemoves})),{bridge:0,visibility:0});
   if(scenario==='remount'){await page.evaluate(()=>window.remount());await page.waitForFunction(()=>document.querySelector('[data-owner]')?.dataset.owner==='jest-guest');await page.evaluate(()=>{window.fireLifecycle('pause','A',true);window.emitBridge();});await page.waitForTimeout(40);metric('remount admits one fresh command',await page.evaluate(before=>window.probe.calls.length-before.calls,before),1);metric('retained old callbacks cannot duplicate the remounted lifecycle',await page.evaluate(()=>window.probe.messages),[{version:'A',type:'host:pause'}]);}
  }
  metric('no browser error',await page.evaluate(()=>window.probe.errors),[]);metric('no unhandled promise',await page.evaluate(()=>window.probe.unhandled),[]);await context.close();
 }
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.HOST_RETIRE_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2));}
const failures=observations.filter(x=>JSON.stringify(x.actual)!==JSON.stringify(x.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.HOST_RETIRE_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Host bridge committed retirement assertions');
