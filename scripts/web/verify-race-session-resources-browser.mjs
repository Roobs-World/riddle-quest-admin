import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/race-resources-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RACE_RULES} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {useRaceSession} from ${JSON.stringify(path.join(root,'src/web/play/race/hooks/useRaceSession.ts'))};
const intervals=new Set(),bridge=new Set(),visibility=new Set();
let intervalStarts=0,bridgeAdds=0,visibilityAdds=0,ticks=0;
const setInterval=window.setInterval.bind(window),clearInterval=window.clearInterval.bind(window);
window.setInterval=(callback,delay,...args)=>{const tracked=delay===50&&typeof callback==='function';const id=setInterval(tracked?()=>{ticks++;callback(...args);}:callback,delay,...args);if(tracked){intervals.add(id);intervalStarts++;}return id;};
window.clearInterval=id=>{intervals.delete(id);clearInterval(id);};
const addWindow=window.addEventListener.bind(window),removeWindow=window.removeEventListener.bind(window);
window.addEventListener=(type,listener,options)=>{if(type==='riddle-quest:host-to-game'){bridge.add(listener);bridgeAdds++;}addWindow(type,listener,options);};
window.removeEventListener=(type,listener,options)=>{if(type==='riddle-quest:host-to-game')bridge.delete(listener);removeWindow(type,listener,options);};
const addDocument=document.addEventListener.bind(document),removeDocument=document.removeEventListener.bind(document);
document.addEventListener=(type,listener,options)=>{if(type==='visibilitychange'){visibility.add(listener);visibilityAdds++;}addDocument(type,listener,options);};
document.removeEventListener=(type,listener,options)=>{if(type==='visibilitychange')visibility.delete(listener);removeDocument(type,listener,options);};
window.resources=()=>({intervals:intervals.size,bridge:bridge.size,visibility:visibility.size,intervalStarts,bridgeAdds,visibilityAdds,ticks});
window.commands=[];
function Surface({owner,locale}){const {session,state}=useRaceSession({ownerId:owner,locale},{postToHost:message=>{window.commands.push(message);if(message.type==='game:listRaceCategories')window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:{categories:[],rules:RACE_RULES}}}}));}});
 window.session=session;window.renderedOwner=owner;window.renderedLocale=locale;
 return <p>{owner}:{locale}:{state.stage}</p>;}
function App(){const [mounted,setMounted]=React.useState(true),[owner,setOwner]=React.useState('owner-1'),[locale,setLocale]=React.useState('en');window.setMounted=setMounted;window.setOwner=setOwner;window.setLocale=setLocale;return mounted?<Surface owner={owner} locale={locale}/>:<p>Unmounted</p>;}
window.root=createRoot(document.getElementById('root'));const app=<App/>;window.root.render(new URLSearchParams(location.search).get('strict')==='true'?<React.StrictMode>{app}</React.StrictMode>:app);
`);
let browser,server;const failures=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const runtime of ['production','development']){
  await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(runtime)},plugins:[{name:'resource-leak-negative-control',enforce:'pre',transform(code,id){
   const leak=process.env.RACE_RESOURCE_LEAK_BASELINE;
   if(!leak||!id.endsWith('/play/race/hooks/useRaceSession.ts'))return null;
   assert(['1','interval','bridge','visibility'].includes(leak));
   for(const [kind,site] of [['interval','window.clearInterval(timer);'],['bridge','window.removeEventListener(HOST_TO_GAME_EVENT, handle);'],['visibility','document.removeEventListener("visibilitychange", visible);']]){
    if(leak==='1'||leak===kind){assert(code.includes(site));code=code.replace(site,'/* Deliberate negative-control resource leak. */');}
   }
   return {code,map:null};
  }}],build:{outDir:'dist'}});
  server=createServer(async(request,response)=>{try{const url=new URL(request.url,'http://localhost'),file=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');response.end(await readFile(file));}catch{response.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  for(const strict of [false,true])for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/?strict='+strict);
    await page.waitForFunction(()=>window.resources?.().intervals>0);
    const replay=strict&&runtime==='development'?2:1;
    const initial=await page.evaluate(()=>window.resources());
    assert.deepEqual({intervals:initial.intervals,bridge:initial.bridge,visibility:initial.visibility},{intervals:1,bridge:1,visibility:1});
    assert.equal(initial.intervalStarts,replay);assert.equal(initial.bridgeAdds,replay);assert.equal(initial.visibilityAdds,replay);
    for(let cycle=0;cycle<3;cycle++){
     const owner='owner-'+(cycle+2),locale=cycle%2?'en':'fr';
     const before=await page.evaluate(()=>window.resources());
     await page.evaluate(({owner,locale})=>{window.setOwner(owner);window.setLocale(locale);},{owner,locale});
     await page.waitForFunction(({owner,locale})=>window.renderedOwner===owner&&window.renderedLocale===locale,{owner,locale});
     await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
     const selected=await page.evaluate(()=>window.resources());
     assert.equal(selected.intervalStarts,before.intervalStarts,'entry replacement duplicated scheduling');
     assert.equal(selected.bridgeAdds,before.bridgeAdds+1,'entry replacement did not replace its bridge listener');
     assert.deepEqual({intervals:selected.intervals,bridge:selected.bridge,visibility:selected.visibility},{intervals:1,bridge:1,visibility:1});
     await page.evaluate(()=>window.setMounted(false));
     await page.waitForFunction(()=>document.querySelector('#root p')?.textContent==='Unmounted');
     await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
     const retired=await page.evaluate(()=>window.resources());
     assert.deepEqual({intervals:retired.intervals,bridge:retired.bridge,visibility:retired.visibility},{intervals:0,bridge:0,visibility:0},'unmount retained native browser resources');
     const commandCount=await page.evaluate(()=>window.commands.length);
     await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:'retired',payload:{operation:'raceCategories',ok:false,error:'RaceTo10.ERROR_GENERIC'}}}));});
     await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,125)));
     assert.equal(await page.evaluate(()=>window.resources().ticks),retired.ticks,'retired interval still executed');
     assert.equal(await page.evaluate(()=>window.commands.length),commandCount,'retired browser event dispatched a command');
     await page.evaluate(()=>window.setMounted(true));
     await page.waitForFunction(()=>window.resources().intervals>0);
     const remounted=await page.evaluate(()=>window.resources());
     assert.equal(remounted.intervalStarts,retired.intervalStarts+replay,'remount did not exercise expected effect replay');
     assert.deepEqual({intervals:remounted.intervals,bridge:remounted.bridge,visibility:remounted.visibility},{intervals:1,bridge:1,visibility:1});
    }
    await page.evaluate(()=>window.root.unmount());
    const final=await page.evaluate(()=>window.resources());
    assert.deepEqual({intervals:final.intervals,bridge:final.bridge,visibility:final.visibility},{intervals:0,bridge:0,visibility:0});
    assert.deepEqual(errors,[]);console.log('Browser resource ownership passed: '+runtime+' strict='+strict+' '+width+'px; 3 entry/unmount/remount cycles, exact replay and no retired scheduling.');
   }catch(error){failures.push({runtime,strict,width,message:error.message});console.error('Browser resource ownership FAILED: '+JSON.stringify(failures.at(-1)));}
   finally{await context.close();}
  }
  await new Promise(resolve=>server.close(resolve));server=null;
 }
 assert.deepEqual(failures,[],JSON.stringify(failures));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
