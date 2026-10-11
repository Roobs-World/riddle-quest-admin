import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {protectContent} from '../../packages/core/dist/contentProtection.js';
import {build} from '../../node_modules/.pnpm/vite@8.3.1_@types+node@26.6.3_@vitejs+devtools@0.7.6_yaml@2.9.1/node_modules/vite/dist/node/index.js';
import {chromium,firefox} from '../../node_modules/.pnpm/@playwright+test@1.63.0/node_modules/@playwright/test/index.mjs';
const root=process.cwd(),evidence=path.join(root,'artifacts/content-hex-decoding-fix-2026-10-09'),scratch=await mkdtemp(path.join(root,'packages/portal/node_modules/.cache/hex-content-benchmark-'));
let browser,server;
try{
 await writeFile(scratch+'/index.html','<html><body><script type="module" src="/main.ts"></script></body></html>');
 await writeFile(scratch+'/main.ts',`
import * as baseline from ${JSON.stringify(root+'/packages/core/src/contentProtection.ts')};

import document from ${JSON.stringify(root+'/packages/portal/src/playable/generated/youtube-content-v1.json')};
import {parseYouTubeContentDocument} from ${JSON.stringify(root+'/packages/portal/src/playable/content.ts')};
const sides={baseline};
const canonical=content=>JSON.stringify({...content,riddles:[...content.riddles]});
window.measure=async()=>{
 const observations=[];
 for(const locale of document.locales){
  const expected=parseYouTubeContentDocument(document,locale),envelope=await baseline.protectContent(document.packs[locale]);
  const bytes={...envelope};
  const decoded=await baseline.readProtectedContent(envelope);
  const actual=parseYouTubeContentDocument({...document,packs:{[locale]:decoded}},locale);
  if(canonical(actual)!==canonical(expected)||JSON.stringify(bytes)!==JSON.stringify(envelope))throw new Error('content mismatch:'+locale);
  let tamperRejected=false,invalidRejected=false;
  try{await baseline.readProtectedContent({...envelope,data:(envelope.data.startsWith('00')?'01':'00')+envelope.data.slice(2)});}catch{tamperRejected=true;}
  try{await baseline.readProtectedContent({...envelope,data:envelope.data+'g0'});}catch{invalidRejected=true;}
  if(!tamperRejected||!invalidRejected)throw new Error('integrity rejection:'+locale);
  observations.push({locale,riddles:actual.riddles.size,contentExact:true,ciphertextUnchanged:true,tamperRejected,invalidRejected});
 }
 return {observations,failures:0};
};
`);
 await build({root:scratch,configFile:false,logLevel:'error',resolve:{alias:{'#youtube-content':path.join(root,'packages/portal/src/playable/generated/youtube-content-v1.json')}},define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'dist'}});
 server=createServer(async(req,res)=>{try{const filename=path.join(scratch,'dist',new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);res.setHeader('content-type',filename.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(filename));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const engine=process.env.HEX_BROWSER??'chromium';browser=await(engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='firefox'?{executablePath:'/home/craig-beswetherick/.cache/ms-playwright/firefox-1538/firefox/firefox'}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(()=>window.measure());assert.equal(result.failures,0);assert.equal(result.observations.length,16);assert.deepEqual(errors,[]);
 await writeFile(evidence+'/'+engine+'-locales.json',JSON.stringify({...result,engine,version:browser.version(),errors},null,2)+'\n');console.log(engine+' verified '+result.observations.length+' protected locales');
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
