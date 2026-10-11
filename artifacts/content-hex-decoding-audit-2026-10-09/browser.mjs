import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {protectContent} from '../../packages/core/dist/contentProtection.js';
import {build} from '../../node_modules/.pnpm/vite@8.3.1_@types+node@26.6.3_@vitejs+devtools@0.7.6_yaml@2.9.1/node_modules/vite/dist/node/index.js';
import {chromium,firefox} from '../../node_modules/.pnpm/@playwright+test@1.63.0/node_modules/@playwright/test/index.mjs';
const root=process.cwd(),evidence=path.join(root,'artifacts/content-hex-decoding-audit-2026-10-09'),scratch=await mkdtemp(path.join(root,'packages/portal/node_modules/.cache/hex-content-benchmark-'));
let browser,server;
try{
 await writeFile(scratch+'/index.html','<html><body><script type="module" src="/main.ts"></script></body></html>');
 await writeFile(scratch+'/main.ts',`
import * as baseline from ${JSON.stringify(evidence+'/baseline.ts')};
import * as candidate from ${JSON.stringify(evidence+'/candidate.ts')};
import document from ${JSON.stringify(root+'/packages/portal/src/playable/generated/youtube-content-v1.json')};
import {parseYouTubeContentDocument} from ${JSON.stringify(root+'/packages/portal/src/playable/content.ts')};
const sides={baseline,candidate};
const canonical=content=>JSON.stringify({...content,riddles:[...content.riddles]});
window.measureCold=async(side,locale,envelope)=>{
 const start=performance.now();
 const content=parseYouTubeContentDocument({...document,packs:{[locale]:await sides[side].readProtectedContent(envelope)}},locale);
 const elapsedMs=performance.now()-start;
 if(canonical(content)!==canonical(parseYouTubeContentDocument(document,locale)))throw new Error('cold content mismatch');
 return {elapsedMs,riddles:content.riddles.size};
};
window.measure=async()=>{
 const samples=[];let operations=0,failures=0;
 for(const locale of ['en','hi']){
  const envelope=await baseline.protectContent(document.packs[locale]);
  const expected=canonical(parseYouTubeContentDocument(document,locale));
  const load=async side=>parseYouTubeContentDocument({...document,packs:{[locale]:await sides[side].readProtectedContent(envelope)}},locale);
  for(const side of Object.keys(sides))for(let warm=0;warm<5;warm++)if(canonical(await load(side))!==expected)throw new Error('warmup mismatch');
  for(let round=0;round<9;round++)for(const side of round%2?['candidate','baseline']:['baseline','candidate']){
   const count=20,start=performance.now();let content;
   for(let i=0;i<count;i++){content=await load(side);operations++;}
   const elapsedMs=performance.now()-start;
   if(canonical(content)!==expected){failures++;throw new Error('content mismatch');}
   samples.push({locale,side,round,count,elapsedMs,perOperationMs:elapsedMs/count,riddles:content.riddles.size,classicQuestions:content.classicOrder.length,ciphertextBytes:envelope.data.length/2});
  }
 }
 return {operations,failures,samples,scope:'Protected locale decryption, UTF-8/JSON decoding and actual domain validation; excludes module/network/SDK/paint'};
};
`);
 await build({root:scratch,configFile:false,logLevel:'error',resolve:{alias:{'#youtube-content':path.join(root,'packages/portal/src/playable/generated/youtube-content-v1.json')}},define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'dist'}});
 server=createServer(async(req,res)=>{try{const filename=path.join(scratch,'dist',new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);res.setHeader('content-type',filename.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(filename));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const engine=process.env.HEX_BROWSER??'chromium';browser=await(engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'?{executablePath:'/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox'}:{})});
 if(process.env.HEX_COLD==='1'){
  const content=JSON.parse(await readFile(path.join(root,'packages/portal/src/playable/generated/youtube-content-v1.json'),'utf8')),samples=[];
  for(const locale of ['en','hi']){
   const envelope=await protectContent(content.packs[locale]);
   for(let round=0;round<9;round++)for(const side of round%2?['candidate','baseline']:['baseline','candidate']){
    const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measureCold==='function');
    const result=await page.evaluate(({side,locale,envelope})=>window.measureCold(side,locale,envelope),{side,locale,envelope});
    assert.deepEqual(errors,[]);assert(result.riddles>0);samples.push({locale,side,round,...result});await page.close();
   }
  }
  const summary=[];for(const locale of ['en','hi'])for(const side of ['baseline','candidate']){const values=samples.filter(row=>row.locale===locale&&row.side===side).map(row=>row.elapsedMs).sort((a,b)=>a-b);summary.push({locale,side,medianMs:values[4],rangeMs:[values[0],values.at(-1)]});}
  await writeFile(evidence+'/'+engine+'-cold-browser.json',JSON.stringify({engine,version:browser.version(),samples,summary,failures:0,scope:'First decryption plus domain validation in a fresh page; excludes entry/network/SDK/paint'},null,2)+'\n');console.log(JSON.stringify(summary));
 }else{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(()=>window.measure());assert.equal(result.failures,0);assert.deepEqual(errors,[]);
 const summary=[];
 for(const locale of ['en','hi'])for(const side of ['baseline','candidate']){const values=result.samples.filter(row=>row.locale===locale&&row.side===side).map(row=>row.perOperationMs).sort((a,b)=>a-b);summary.push({locale,side,medianMs:values[4],rangeMs:[values[0],values.at(-1)]});}
 await writeFile(evidence+'/'+engine+'-browser.json',JSON.stringify({...result,engine,version:browser.version(),errors,summary},null,2)+'\n');console.log(JSON.stringify(summary));
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
