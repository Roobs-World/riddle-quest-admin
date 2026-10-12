import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reactRuntime = process.env.RACE_REACT_DEVELOPMENT === "1" ? "development" : "production";
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-profile-ownership-"));
const output = path.resolve(root, "../../artifacts/race-profile-refresh-ownership");
await mkdir(output, {recursive: true});
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, "main.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useHostRaceCoordination} from ${JSON.stringify(path.join(root, "src/play/useHostRaceCoordination.ts"))};
import {useHostAuthSession} from ${JSON.stringify(path.join(root, "src/play/useHostAuthSession.ts"))};
const users={'owner-1':{uid:'owner-1',isAnonymous:false},'owner-2':{uid:'owner-2',isAnonymous:false}};
window.calls=[];window.loads=[];window.providerCalls=[];
const loadProfile=uid=>new Promise(resolve=>window.loads.push({uid,resolve}));
window.authSubscriptions=0;window.authDisposals=0;window.liveSubscriptions=0;
const auth={subscribe:listener=>{window.authSubscriptions++;window.liveSubscriptions++;window.authListener=listener;listener({user:users['owner-1'],profile:{level:1,wins:0,winStreak:0,coins:10}});return()=>{window.authDisposals++;window.liveSubscriptions--;window.authListener=null;};}};
const identity={loadProfile,auth};const authPost=message=>{};
function App(){const host=useHostAuthSession({services:identity,postToGame:authPost}),owner=host.snapshot.user?.uid;
 const setOwner=uid=>window.authListener({user:users[uid],profile:{level:2,wins:1,winStreak:1,coins:222}});
 const coordination=useHostRaceCoordination({authSnapshot:host.snapshot,bridgeUser:host.bridgeUser,ownsAccount:host.ownsAccount,captureAccount:host.captureAccount,locale:'en',race:undefined,identity,
 raceLocalePolicy:'all',applyCoinBalance:(coins,uid)=>{window.calls.push({kind:'coins',coins});host.applyCoinBalance(coins,uid);},replaceProfile:(profile,uid)=>{window.calls.push({kind:'profile',profile});host.replaceProfile(profile,uid);},postToGame:message=>window.calls.push({kind:'bridge',message})});
 window.currentSync=async result=>{const owned=await coordination.syncProgress(result);if(owned!==false)window.providerCalls.push(owner);return owned;};window.switchOwner=setOwner;window.owner=owner;window.profile=host.snapshot.profile;
 return <p>{owner}</p>;}
window.root=createRoot(document.getElementById('root'));const app=<App/>;window.root.render(new URLSearchParams(location.search).get('strict')==='true'?<React.StrictMode>{app}</React.StrictMode>:app);
`);
let browser, server;
try {
  await build({root:scratch,configFile:false,logLevel:"error",define:{"process.env.NODE_ENV":JSON.stringify(reactRuntime)},build:{outDir:"dist"}});
  server=createServer(async(request,response)=>{
    try {const url=new URL(request.url,"http://localhost"),file=path.join(scratch,"dist",url.pathname==="/"?"index.html":url.pathname);
      response.setHeader("Content-Type",file.endsWith(".js")?"text/javascript":"text/html");response.end(await readFile(file));
    }catch{response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  for(const strict of [false,true])for(const width of [1280,390])for(const scenario of ["account","reordered","unmount","pre-render","account-return"]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?strict='+strict);
    await page.waitForFunction(()=>window.owner==='owner-1'&&Boolean(window.currentSync));
    const subscriptions = strict && reactRuntime === 'development' ? 2 : 1;
    assert.equal(await page.evaluate(()=>window.authSubscriptions),subscriptions,'React runtime did not exercise the expected setup count');
    assert.equal(await page.evaluate(()=>window.authDisposals),subscriptions-1,'StrictMode did not replay subscription cleanup');
    assert.equal(await page.evaluate(()=>window.liveSubscriptions),1,'effect replay left duplicate live subscriptions');
    await page.evaluate(()=>{window.oldSync=window.currentSync;void window.currentSync({newCoins:100});});
    if(scenario==="account"){
      await page.evaluate(()=>window.switchOwner('owner-2'));await page.waitForFunction(()=>window.owner==='owner-2');
      await page.evaluate(()=>window.loads[0].resolve({level:1,wins:0,winStreak:0,coins:111}));
    }else if(scenario==='account-return'){
      await page.evaluate(()=>{window.switchOwner('owner-2');window.switchOwner('owner-1');window.loads[0].resolve({level:1,wins:0,winStreak:0,coins:111});});
    }else if(scenario==='pre-render'){
      await page.evaluate(()=>{window.switchOwner('owner-2');void window.oldSync({newCoins:999});window.loads[0].resolve({level:1,wins:0,winStreak:0,coins:111});});
    }else if(scenario==="unmount"){
      await page.evaluate(()=>{window.root.unmount();window.loads[0].resolve({level:1,wins:0,winStreak:0,coins:111});});
    }else{
      await page.evaluate(()=>{void window.currentSync({newCoins:200});window.loads[1].resolve({level:2,wins:1,winStreak:1,coins:222});});
      await page.waitForFunction(()=>window.calls.some(call=>call.kind==='profile'));
      await page.evaluate(()=>window.loads[0].resolve({level:1,wins:0,winStreak:0,coins:111}));
    }
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
    const calls=await page.evaluate(()=>window.calls);
    assert.equal(await page.evaluate(()=>window.providerCalls.length),scenario==='reordered'?2:0,'provider follow-up escaped its account');
    assert.equal(calls.filter(call=>call.kind==='profile').length,scenario==='reordered'?1:0,'stale profile refresh escaped its owner');
    assert.equal(calls.filter(call=>call.kind==='bridge').length,scenario==='reordered'?1:0,'stale auth bridge message escaped its owner');
    if(scenario==='pre-render'){assert.equal(calls.filter(call=>call.kind==='coins').length,1,'auth changed before React render but stale callback applied coins');assert.equal(await page.evaluate(()=>window.profile.coins),222);}
    if(scenario==='reordered')assert.equal(calls.find(call=>call.kind==='profile').profile.coins,222);
    if(scenario!=='reordered'){
      const before=await page.evaluate(()=>window.calls.length);await page.evaluate(()=>{void window.oldSync({newCoins:999});});
      assert.equal(await page.evaluate(()=>window.calls.length),before,'stale callback applied a reward to a replacement account');
    }
    assert.deepEqual(errors,[]);if(scenario==='unmount')assert.equal(await page.evaluate(()=>window.liveSubscriptions),0,'unmount retained authentication subscription');console.log('Profile refresh ownership passed: '+scenario+' at '+width+'px, strict='+strict+', runtime='+reactRuntime+'.');await context.close();
  }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
