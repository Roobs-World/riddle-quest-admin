import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const component=path.join(root,"src/platform/bridge/browser/bridgeRouter.ts");
const output=path.join(root,'artifacts/bridge-chunk-recovery-2026-10-03');
await mkdir(output,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/bridge-chunk-recovery-'));
await writeFile(path.join(scratch,'index.html'),'<html><body><button id="retry">Retry</button><output id="status">Ready</output><script type="module" src="/main.ts"></script></body></html>');
await writeFile(path.join(scratch,'main.ts'),`
import {createHostMessageRouter} from ${JSON.stringify(component)};
window.probe={calls:0,errors:[],settled:0};
const router=createHostMessageRouter(new Proxy({},{get:()=>()=>{window.probe.calls++;}}));
window.submit=async()=>{try{await router({type:'game:resize',payload:{width:390,height:844}});document.querySelector('output').textContent='Playable';}catch(error){window.probe.errors.push(String(error));document.querySelector('output').textContent='Unavailable';}finally{window.probe.settled++;}};
document.querySelector('button').onclick=window.submit;window.loaded=true;
`);
let browser;const samples=[];
try{
  browser=await chromium.launch({headless:true});
  for(const variant of ['cached','reset']){
    await build({root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist',minify:false},plugins:[{name:'bridge-reset-diagnostic',enforce:'pre',async load(id){if(id!==component)return;const source=await readFile(id,'utf8');if(variant==='cached')return source;
      const original='  return bridgeParsersPromise;';assert.ok(source.includes(original));return source.replace(original,'  return bridgeParsersPromise.catch((error) => {bridgeParsersPromise = null; throw error;});');}}]});
    const schemaAssets=[];for(const file of await readdir(path.join(scratch,'dist/assets')))if(file.endsWith('.js')&&/BridgeProfileSchema\s*=/.test(await readFile(path.join(scratch,'dist/assets',file),'utf8')))schemaAssets.push(`/assets/${file}`);
    assert.equal(schemaAssets.length,1);
    const server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://localhost').pathname,file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);response.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'text/html'});response.end(await readFile(file));}catch{response.writeHead(404).end();}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const context=await browser.newContext(),page=await context.newPage();let requests=0,fail=true;
    try{
      await page.route('**/assets/*.js',async route=>{if(schemaAssets.includes(new URL(route.request().url()).pathname)){requests++;if(fail){await route.abort('failed');return;}}await route.continue();});
      await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.loaded);await page.locator('button').click();await page.waitForFunction(()=>window.probe.settled===1);
      samples.push({variant,phase:'failed request',requests,...await page.evaluate(()=>window.probe)});
      fail=false;await page.locator('button').click();await page.waitForFunction(()=>window.probe.settled===2);
      samples.push({variant,phase:'restored network same document',requests,...await page.evaluate(()=>window.probe)});
      await page.reload();await page.waitForFunction(()=>window.loaded);await page.locator('button').click();await page.waitForFunction(()=>window.probe.settled===1);
      samples.push({variant,phase:'restored network new document',requests,...await page.evaluate(()=>window.probe)});
    }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
  }
  await writeFile(path.join(output,'diagnostic.json'),JSON.stringify(samples,null,2));console.log(JSON.stringify(samples,null,2));
}finally{await browser?.close();await rm(scratch,{recursive:true,force:true});}
