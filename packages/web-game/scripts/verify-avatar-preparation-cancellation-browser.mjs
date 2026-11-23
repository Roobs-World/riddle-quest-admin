import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,copyFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.env.AVATAR_CANCEL_REACT_MODE??'development',baseline=process.env.AVATAR_CANCEL_BASELINE_DIR;
assert.ok(['development','production'].includes(mode));
const output=path.resolve(process.env.AVATAR_CANCEL_REPORT_DIR??path.join(root,'../../builds/test-evidence/avatar-preparation-cancellation-2026-10-05',mode));
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/avatar-cancel-'));
let browser,server;const observations=[];
try{
 await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
 await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useGameOperations} from ${JSON.stringify(path.join(root,'src/play/game/hooks/useGameOperations.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'../hosted/src/play/gameSession.ts'))};
import {parseGameToHostMessage} from '@riddle-quest/core/bridge';
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.probe={sent:[],started:0,completed:0,closed:0,rejected:[],releases:[],errors:[],unhandled:[],owner:null,canvases:0,draws:0,encodes:0,reads:0,encodeReleases:[]};
window.addEventListener('error',e=>probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>probe.unhandled.push(String(e.reason)));
const bytes=await fetch('/source.webp').then(r=>r.blob());const file=new File([bytes],'fixture.webp',{type:'image/webp'});
const heldEncoder=new URLSearchParams(location.search).has('encoder');
const nativeCreate=document.createElement.bind(document);document.createElement=(name,...args)=>{if(name==='canvas')probe.canvases++;return nativeCreate(name,...args);};
const nativeDraw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args){probe.draws++;return nativeDraw.apply(this,args);};
const nativeEncode=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,...args){probe.encodes++;return nativeEncode.call(this,blob=>heldEncoder?probe.encodeReleases.push(()=>callback(blob)):callback(blob),...args);};
const nativeRead=FileReader.prototype.readAsDataURL;FileReader.prototype.readAsDataURL=function(...args){probe.reads++;return nativeRead.apply(this,args);};
const nativeBitmap=window.createImageBitmap.bind(window);window.createImageBitmap=async(...args)=>{const bitmap=await nativeBitmap(...args),close=bitmap.close.bind(bitmap);bitmap.close=()=>{probe.closed++;close();};probe.started++;return new Promise((resolve,reject)=>probe.releases.push(fail=>{if(fail){bitmap.close();reject(new Error('fixture-image-decode-failed'));}else resolve(bitmap);}));};
const noop=()=>{};const user=(uid,generation=1)=>({uid,accountGeneration:generation,isAnonymous:false,platformRegistered:true});
function Controls({state,dispatch,revision}){const stateRef=React.useRef(state);stateRef.current=state;
 const postToHost=React.useCallback(message=>{parseGameToHostMessage(message);probe.sent.push({uid:stateRef.current.user?.uid,generation:stateRef.current.user?.accountGeneration,sender:revision,requestId:message.requestId,webp:message.payload.imageDataUrl.startsWith('data:image/webp;base64,')});},[revision]);
 const operations=useGameOperations({state,stateRef,dispatch,postToHost,playFeedback:noop});
 const upload=invalid=>void operations.updateAvatar(invalid?new File(['bad'],'bad.svg',{type:'image/svg+xml'}):file).then(()=>probe.completed++,error=>{probe.completed++;probe.rejected.push(String(error.message));});
 return <section data-controls><button data-upload onClick={()=>upload(false)}>Prepare avatar</button><button data-invalid onClick={()=>upload(true)}>Invalid image</button><p>Owned by {state.user.uid}, generation {state.user.accountGeneration}, sender {revision}</p></section>;
}
function App(){const [state,dispatch]=React.useReducer(gameSessionReducer,undefined,()=>gameSessionReducer(createInitialGameSession(),{type:'hostInit',locale:'en',gameMode:'classic',user:user('player-a'),products:[],profile:null})),[mounted,setMounted]=React.useState(true),[revision,setRevision]=React.useState(0),[tick,setTick]=React.useState(0);probe.owner=state.user;
 return <main style={{padding:20}}><nav><button data-user onClick={()=>dispatch({type:'authState',user:user(state.user.uid==='player-a'?'player-b':'player-a'),profile:null})}>Switch player</button><button data-generation onClick={()=>dispatch({type:'authState',user:user(state.user.uid,state.user.accountGeneration+1),profile:null})}>New generation</button><button data-sender onClick={()=>setRevision(x=>x+1)}>Replace sender</button><button data-mount onClick={()=>setMounted(x=>!x)}>Mount or retire</button><button data-refresh onClick={()=>setTick(x=>x+1)}>Deliver update</button><span data-tick>{tick}</span></nav>{mounted?<Controls state={state} dispatch={dispatch} revision={revision}/>:<p data-retired>Retired</p>}</main>;
}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
 `);
 await build({root:scratch,configFile:false,publicDir:path.join(root,'public'),logLevel:'error',resolve:{alias:{'@riddle-quest/core/bridge':path.join(root,'../core/src/bridge/index.ts')}},define:{'process.env.NODE_ENV':JSON.stringify(mode)},plugins:[{name:'original-avatar-operations',enforce:'pre',async load(id){if(baseline&&id.endsWith('/useGameOperations.ts'))return readFile(path.join(baseline,'operations.before.txt'),'utf8');if(baseline&&id.endsWith('/avatarImage.ts'))return readFile(path.join(baseline,'image.before.txt'),'utf8');}}],build:{outDir:'dist',minify:false,target:'esnext'}});
 await copyFile(path.join(root,'../../assets/images-web/riddlequest-r.webp'),path.join(scratch,'dist/source.webp'));
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+server.address().port;
 if(process.env.AVATAR_CANCEL_SERVE_ONLY==='1'){console.log(JSON.stringify({url,scratch,mode}));await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 else{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of process.env.AVATAR_CANCEL_QUICK==='1'?[[390,568]]:[[390,568],[390,844],[1280,844]])for(const scenario of process.env.AVATAR_CANCEL_CASES?.split(',')??['active','updates','player','generation','sender','retired','returned-player','superseded','late-failure','current-failure','encoded-player','encoded-superseded','encoded-retired']){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  const metric=(name,actual,expected)=>observations.push({width,height,scenario,name,actual,expected});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const sent=()=>page.evaluate(()=>probe.sent.length);
  const upload=async count=>{await page.locator('[data-upload]').click();await page.waitForFunction(n=>probe.started===n,count);};
  const encoded=scenario.startsWith('encoded-');
  const release=async(index,completed,fail=false)=>{if(!(encoded&&index===0))await page.evaluate(({index,fail})=>probe.releases[index](fail),{index,fail});if(encoded){await page.waitForFunction(n=>probe.encodeReleases.length===n,index+1);await page.evaluate(i=>probe.encodeReleases[i](),index);}await page.waitForFunction(n=>probe.completed===n,completed);await settle();};
  await page.goto(url+(encoded?'?encoder=1':''));await page.locator('[data-upload]').waitFor();await settle();await upload(1);
  metric('preparation waits for the actual held decoder',await sent(),0);
  if(encoded){await page.evaluate(()=>probe.releases[0](false));await page.waitForFunction(()=>probe.encodeReleases.length===1);}
  if(scenario==='updates')for(let update=0;update<32;update++)await page.locator('[data-refresh]').click();
  if(scenario==='player'||scenario==='encoded-player')await page.locator('[data-user]').click();
  if(scenario==='generation')await page.locator('[data-generation]').click();
  if(scenario==='sender')await page.locator('[data-sender]').click();
  if(scenario==='retired'||scenario==='encoded-retired')await page.locator('[data-mount]').click();
  if(scenario==='returned-player'){await page.locator('[data-user]').click();await settle();await page.locator('[data-user]').click();}
  if(scenario==='superseded'||scenario==='encoded-superseded')await upload(2);
  if(scenario==='late-failure')await page.locator('[data-generation]').click();
  await settle();await release(0,1,scenario==='late-failure'||scenario==='current-failure');
  const retained=scenario==='active'||scenario==='updates';
  metric('only the owned latest preparation reaches the host',await sent(),retained?1:0);
  for(const key of ['canvases','draws','encodes','reads'])metric('retired preparation skips '+key,await page.evaluate(k=>probe[k],key),(retained||(encoded&&key!=='reads'))?1:0);
  metric('decoded bitmap is closed after preparation or injected failure',await page.evaluate(()=>probe.closed),1);
  metric('only a current preparation reports an encoding error',await page.evaluate(()=>probe.rejected),scenario==='current-failure'?['fixture-image-decode-failed']:[]);
  if(!retained){
   if(scenario==='retired'||scenario==='encoded-retired')await page.locator('[data-mount]').click();
   if(scenario!=='superseded'&&scenario!=='encoded-superseded')await upload(2);
   await release(1,2);metric('the replacement preparation reaches its current host once',await sent(),1);
  }else metric('a live preparation reaches its host exactly once',await sent(),1);
  for(const key of ['canvases','draws','encodes','reads'])metric('current replacement retains '+key,await page.evaluate(k=>probe[k],key),encoded&&key!=='reads'?2:1);
  metric('every completed bitmap is released',await page.evaluate(()=>probe.closed),retained?1:2);
  const last=await page.evaluate(()=>probe.sent.at(-1)),owner=await page.evaluate(()=>probe.owner);
  metric('the accepted upload belongs to the current player',last.uid,owner.uid);metric('the accepted upload belongs to the current generation',last.generation,owner.accountGeneration);metric('the accepted upload uses the current sender',last.sender,scenario==='sender'?1:0);metric('the real browser encoder produces a validated WebP payload',last.webp,true);
  const beforeInvalid=await sent();await page.locator('[data-invalid]').click();await page.waitForFunction(n=>probe.completed===n,retained?2:3);metric('invalid image retains its existing validation error',await page.evaluate(()=>probe.rejected.at(-1)),'invalid-avatar-file');metric('invalid image sends no additional host request',await sent(),beforeInvalid);
  metric('browser errors',await page.evaluate(()=>probe.errors),[]);metric('unhandled rejections',await page.evaluate(()=>probe.unhandled),[]);
  await page.screenshot({path:path.join(output,[scenario,width,height].join('-')+'.png')});await context.close();
 }
 const failures=observations.filter(row=>JSON.stringify(row.actual)!==JSON.stringify(row.expected));console.log(JSON.stringify({mode,checks:observations.length,failures},null,2));if(process.env.AVATAR_CANCEL_MEASURE_ONLY!=='1')assert.equal(failures.length,0,'Avatar preparation cancellation');
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});if(process.env.AVATAR_CANCEL_SERVE_ONLY!=='1')await writeFile(path.join(output,'observations.json'),JSON.stringify(observations,null,2)+'\n');}
