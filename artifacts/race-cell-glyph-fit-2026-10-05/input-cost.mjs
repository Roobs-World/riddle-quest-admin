import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const evidence=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(evidence,'../..'),require=createRequire(path.join(repo,'packages/portal/package.json')),{chromium}=require('@playwright/test');
let activePhase='baseline';
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1');if(u.pathname==='/favicon.ico'){res.writeHead(204).end();return;}const m=/^\/(baseline|fixed|production)(\/.*)?$/.exec(u.pathname);if(!m){res.writeHead(404).end();return;}const file=path.join(evidence,m[1]==='production'?activePhase:m[1],'production/built',!m[2]||m[2]==='/'?'index.html':m[2]);res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]??'text/html');res.end(await readFile(file));}catch(error){res.writeHead(500).end(String(error));}});
let browser;const rows=[];
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await writeFile(path.join(evidence,'input-cost-server.json'),JSON.stringify({port,pid:process.pid},null,2));browser=await chromium.launch({headless:true});
 for(const phase of ['baseline','fixed','fixed','baseline'])for(const kind of ['letters','nfd','hi']){
 activePhase=phase;const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+port+'/'+phase+'/?kind='+kind);await page.waitForFunction(()=>window.nativeExercise);await page.evaluate(()=>document.fonts.ready);
 const samples=await page.evaluate(async()=>{
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));await nextFrame();await nextFrame();
 const input=document.querySelector('.race-native-answer-input'),text=window.readUnicode().text,values=[];
 for(let i=0;i<120;i++){
 // A real backspace render opens one slot before a new committed answer edit.
 input.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Backspace'}));await nextFrame();
 input.value=text;const began=performance.now();input.dispatchEvent(new InputEvent('input',{bubbles:true,data:text,inputType:'insertText'}));await Promise.resolve();const ended=performance.now();if(i>=20)values.push(ended-began);await nextFrame();
 }
 return values;
 });
 assert.deepEqual(errors,[]);assert.equal(samples.length,100);const sorted=[...samples].sort((a,b)=>a-b);rows.push({phase,kind,samples,medianMs:sorted[49],p95Ms:sorted[94],maxMs:sorted[99],meanMs:samples.reduce((a,b)=>a+b,0)/samples.length});await page.close();
 }
}finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await writeFile(path.join(evidence,'input-cost.json'),JSON.stringify({scope:'Synthetic browser-task committed-input dispatch and React work through one microtask; excludes frame wait, OS keyboard, network and server latency. Alternating baseline/fixed retained production fixtures; 20 warm-ups and100 measured edits per case. Diagnostic samples, no guaranteed performance threshold.',cases:rows.length,measuredEdits:rows.reduce((n,r)=>n+r.samples.length,0),portClosed:true,rows},null,2));console.log(JSON.stringify(rows.map(({samples,...r})=>r)));}
