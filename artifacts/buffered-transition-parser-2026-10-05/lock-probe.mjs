// Diagnostic only: measure the existing built game without changing its source or budgets.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(folder,'../..');
const artifact=path.resolve(process.env.BUFFERED_TIMING_ARTIFACT_DIR??path.join(root,'artifacts/centered-tooltip-work-2026-10-05/built/jest'));
const {chromium}=createRequire(path.join(root,'packages/portal/package.json'))('@playwright/test');
const output=path.resolve(process.env.BUFFERED_TIMING_REPORT_DIR??path.join(folder,'baseline'));
const runs=Number(process.env.BUFFERED_TIMING_RUNS??10);
const cpuRate=Number(process.env.BUFFERED_TIMING_CPU_RATE??1);
const domObserver=process.env.BUFFERED_TIMING_DOM_OBSERVER!=='0';
const longObserver=process.env.BUFFERED_TIMING_LONG_OBSERVER!=='0';
const captureTrace=process.env.BUFFERED_TIMING_TRACE==='1';
const guidanceSeen=process.env.BUFFERED_TIMING_GUIDANCE_SEEN==='1';
const pairGuidance=process.env.BUFFERED_TIMING_GUIDANCE_PAIR==='1';
const rows=[];
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'probe-source.mjs'),await readFile(fileURLToPath(import.meta.url)));
await writeFile(path.join(output,'parameters.json'),JSON.stringify({runs,cpuRate,domObserver,longObserver,captureTrace,guidanceSeen,pairGuidance,artifact,instrument:process.env.BUFFERED_TIMING_INSTRUMENT==='1'},null,2)+'\n');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(artifact,pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');let contents=await readFile(file);if(process.env.BUFFERED_TIMING_INSTRUMENT==='1'&&path.basename(file)==='bridge-CpH8mEjy.js'){
let code=contents.toString();for(const [needle,replacement] of [
['Le=e=>X.parse(e)','Le=e=>{const w=window.__rqParserWork,t=performance.now();try{return X.parse(e)}finally{if(w)w.parsers.push({type:e?.type,at:t-w.origin,ms:performance.now()-t})}}'],
['$=e=>Q.parse(e)','$=e=>{const w=window.__rqParserWork,t=performance.now();try{return Q.parse(e)}finally{if(w)w.parsers.push({type:e?.type,at:t-w.origin,ms:performance.now()-t})}}']
]){assert.equal(code.split(needle).length,2);code=code.replace(needle,replacement);}contents=code;
}
if(process.env.BUFFERED_TIMING_BOUNDARIES==='1'&&path.basename(file)==='jest-CYvcQS31.js'){
 let code=contents.toString();for(const [needle,replacement] of [
 ['loadRiddle:async e=>{await l({...e.payload,gameMode:t},e.requestId)}','loadRiddle:async e=>{window.__rqMark?.("host-handler:start");await l({...e.payload,gameMode:t},e.requestId);window.__rqMark?.("host-handler:done")}'],
 ['try{h(e.gameMode),ia().catch(()=>void 0);let i=b.current','try{window.__rqMark?.("host-loader:start");h(e.gameMode),ia().catch(()=>void 0);let i=b.current'],
 ['async loadRiddle(t){return(await e()).loadRiddle(t)}','async loadRiddle(t){window.__rqMark?.("services-proxy:start");const loaded=await e();window.__rqMark?.("services-proxy:loaded");return loaded.loadRiddle(t)}']
 ]){assert.equal(code.split(needle).length,2);code=code.replace(needle,replacement);}contents=code;
}res.end(contents);}catch{res.writeHead(404).end();}});
let browser;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--renderer-process-limit=4']});
 for(let run=0;run<runs;run++){
  const caseGuidanceSeen=pairGuidance?run%2===1:guidanceSeen;
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const errors=[],external=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(url.hostname==='cdn.jest.com')return route.fulfill({status:200,contentType:'text/javascript',body:''});external.push(url.origin);return route.abort();});
  await page.addInitScript(guidanceSeen=>{
   window.__RIDDLE_QUEST_BROWSER_TEST__=true;window.__rqInstrument=true;
   localStorage.setItem('riddleQuest:onboarding:jest-guest','seen');
   localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:v2:jest-guest','seen');
   sessionStorage.setItem('riddleQuest:welcomeSession:jest-guest','seen');
   if(guidanceSeen)for(const uid of ['jest-guest','jest-mock-player']){
    localStorage.setItem('riddleQuest:tooltipSequenceSeen:gameTour:v2:'+uid,'seen');
    for(const id of ['achievementEarned','leaderboardFifthCorrectAnswer','classicFromDaily','hintAfterWrongGuess'])localStorage.setItem('riddleQuest:tooltipSeen:'+id+':'+uid,'seen');
   }
  },caseGuidanceSeen);
  await page.goto(origin+'/?harness=jest&registered=1&dailyCompleted=1');
  await page.getByRole('button',{name:/let's play/i}).click();
  await page.locator('.onboarding-card').getByRole('button',{name:/got it/i}).click();
  await page.locator('.onboarding-card').waitFor({state:'hidden'});
  await page.getByText(/what has keys/i).waitFor();
  await page.evaluate(longObserver=>{
   const original=window.dispatchEvent.bind(window);let held=false;
   window.__bufferedTiming={held:0,delivered:0,longTasks:[]};
   window.dispatchEvent=event=>{if(!held&&event.type==='riddle-quest:host-to-game'&&event.detail?.payload?.operation==='guess'){held=true;window.__bufferedTiming.held++;return true;}return original(event);};
   window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail?.type==='game:submitGuess')window.__bufferedTiming.delivered++;});
   if(longObserver&&PerformanceObserver.supportedEntryTypes.includes('longtask')){const observer=new PerformanceObserver(list=>{for(const task of list.getEntries())window.__bufferedTiming.longTasks.push({start:task.startTime,duration:task.duration});});observer.observe({type:'longtask',buffered:true});}
  },longObserver);
  for(const letter of 'PIANO')await page.locator('.keyboard').getByRole('button',{name:letter,exact:true}).click();
  await page.getByRole('button',{name:/^submit$/i}).click();
  await page.locator('.modal-victory').waitFor();
  for(let step=0;step<10&&await page.getByRole('button',{name:/next level/i}).count()===0;step++){
   const previous=await page.locator('.modal-victory .sequence-progress').textContent();
   assert.equal(await page.locator('.modal-victory .reward-chest').count(),0,'Unconfirmed play cannot grant coins');
   await page.locator('.modal-victory .reward-continue').click();
   await page.waitForFunction(prior=>document.querySelector('.modal-victory .sequence-progress')?.textContent!==prior,previous);
  }
  const session=cpuRate!==1||captureTrace?await context.newCDPSession(page):null;
  if(cpuRate!==1)await session.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
  if(captureTrace)await session.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,disabled-by-default-v8.cpu_profiler',transferMode:'ReturnAsStream'});
  const sample=await page.getByRole('button',{name:/next level/i}).evaluate(async (button,{domObserver,captureTrace})=>{
   const trace=window.__bufferedTiming;
   const work={origin:performance.now(),parsers:[],storage:[],dispatch:[],boundaries:[],locks:[]};if(window.__rqInstrument){window.__rqParserWork=work;window.__rqMark=label=>work.boundaries.push({label,at:performance.now()-work.origin});
   const locks=navigator.locks,request=locks.request.bind(locks);locks.request=(name,options,callback)=>{const start=performance.now();work.locks.push({phase:'request',mode:options.mode,at:start-work.origin});return request(name,options,(...args)=>{work.locks.push({phase:'acquired',mode:options.mode,at:performance.now()-work.origin,wait:performance.now()-start});return callback(...args);});};
   const store=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){const start=performance.now();try{return store.call(this,key,value)}finally{work.storage.push({at:start-work.origin,key,bytes:String(value).length,ms:performance.now()-start})}};
   const dispatch=window.dispatchEvent.bind(window);window.dispatchEvent=event=>{const start=performance.now();try{return dispatch(event)}finally{if(event.type.startsWith('riddle-quest:'))work.dispatch.push({at:start-work.origin,type:event.type,message:event.detail?.type,operation:event.detail?.payload?.operation,ms:performance.now()-start})}};
   }
   const guidanceBefore=document.querySelector('.tooltip-backdrop')?.getAttribute('data-tooltip-id')??null;
   const appears=()=>document.querySelector('.riddle-card h1')?.textContent?.includes('face and hands');
   if(captureTrace)performance.mark('RQ-BUFFERED-TRACE:start');
   const start=performance.now();work.origin=start;let domCommitMs=null;const frames=[];
   const observer=new MutationObserver(()=>{if(appears()&&domCommitMs===null)domCommitMs=performance.now()-start;});
   if(domObserver)observer.observe(document.body,{childList:true,subtree:true,characterData:true});
   const clickStart=performance.now();button.click();const clickReturnMs=performance.now()-clickStart;
   while(!appears()){
    if(performance.now()-start>1000){observer.disconnect();throw new Error('Buffered transition waited for the server');}
    await new Promise(resolve=>requestAnimationFrame(time=>{frames.push(time);resolve();}));
   }
   const rafObservedMs=performance.now()-start;
   if(captureTrace)performance.mark('RQ-BUFFERED-TRACE:observed');
   if(domCommitMs===null&&domObserver)domCommitMs=rafObservedMs;
   observer.disconnect();
   await new Promise(resolve=>requestAnimationFrame(resolve));
   const nextFrameMs=performance.now()-start;
   if(captureTrace)performance.mark('RQ-BUFFERED-TRACE:frame');
   await new Promise(resolve=>setTimeout(resolve,0));
   return {clickReturnMs,domCommitMs,rafObservedMs,nextFrameMs,guidanceBefore,guidanceAfter:document.querySelector('.tooltip-backdrop')?.getAttribute('data-tooltip-id')??null,frameTimes:frames.map(time=>time-start),work,longTasks:trace.longTasks.filter(task=>task.start+task.duration>=start&&task.start<=start+nextFrameMs).map(task=>({start:task.start-start,duration:task.duration})),held:trace.held,delivered:trace.delivered};
  },{domObserver,captureTrace});
  if(captureTrace){
   const completed=new Promise(resolve=>session.once('Tracing.tracingComplete',resolve));
   await session.send('Tracing.end');const {stream}=await completed;let trace='';
   while(true){const chunk=await session.send('IO.read',{handle:stream});trace+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString('utf8'):chunk.data;if(chunk.eof)break;}
   await session.send('IO.close',{handle:stream});await writeFile(path.join(output,'trace-'+run+'.json'),trace);
  }
  assert.equal(sample.held,1);assert.equal(sample.delivered,1);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  rows.push({run,cpuRate,domObserver,longObserver,guidanceSeen:caseGuidanceSeen,...sample});console.log(JSON.stringify(rows.at(-1)));
  await context.close();
 }
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
 await writeFile(path.join(output,'observations.json'),JSON.stringify(rows,null,2)+'\n');
}
const summary={runs:rows.length,over100ms:rows.filter(row=>row.rafObservedMs>=100).length,maxDomCommitMs:domObserver?Math.max(...rows.map(row=>row.domCommitMs)):null,maxRafObservedMs:Math.max(...rows.map(row=>row.rafObservedMs))};
console.log(JSON.stringify(summary));
await writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
if(process.env.BUFFERED_TIMING_MEASURE_ONLY!=='1')assert.equal(summary.over100ms,0,'Buffered transition exceeds the unchanged 100ms limit');
