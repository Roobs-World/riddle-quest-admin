import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reactRuntime = process.env.RACE_REACT_DEVELOPMENT === "1" ? "development" : "production";
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/race-prefetch-"));
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, "main.tsx"), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useHostRaceCoordination} from ${JSON.stringify(path.join(root, "src/races/hooks/useHostRaceCoordination.ts"))};
import {useHostAuthSession} from ${JSON.stringify(path.join(root, "src/accounts/hooks/useHostAuthSession.ts"))};
const users={'owner-1':{uid:'owner-1',isAnonymous:false},'owner-2':{uid:'owner-2',isAnonymous:false}};
window.accesses=[];window.catalogs=[];window.frames=[];
const failureMode=new URLSearchParams(location.search).get('scenario');
window.authSubscriptions=0;window.authDisposals=0;window.liveSubscriptions=0;
const auth={subscribe:listener=>{window.authSubscriptions++;window.liveSubscriptions++;window.authListener=listener;listener({user:users['owner-1'],profile:null});return()=>{window.authDisposals++;window.liveSubscriptions--;window.authListener=null;};}};
const identity={auth,loadProfile:async()=>null},postToGame=()=>{};
const race={getRaceAccess:()=>{if(failureMode==='access-throw'||failureMode==='access-reject'){window.accesses.push({});if(failureMode==='access-throw')throw new Error('sync-access-failure');return Promise.reject(new Error('async-access-failure'));}return new Promise(resolve=>window.accesses.push({resolve}));},listRaceCategories:()=>{if(failureMode==='catalog-throw'||failureMode==='catalog-reject'){window.catalogs.push({});if(failureMode==='catalog-throw')throw new Error('sync-catalog-failure');return Promise.reject(new Error('async-catalog-failure'));}return new Promise(resolve=>window.catalogs.push({resolve}));}};
const replacementRace={...race};
function App(){const host=useHostAuthSession({services:identity,postToGame});
 const [locale,setLocale]=React.useState('en');window.setLocale=setLocale;
 const [authority,setAuthority]=React.useState(race),[policy,setPolicy]=React.useState('all'),[challenge,setChallenge]=React.useState(undefined);
 window.replaceAuthority=()=>setAuthority(replacementRace);window.setPolicy=setPolicy;window.setChallenge=setChallenge;
 const coordination=useHostRaceCoordination({authSnapshot:host.snapshot,bridgeUser:host.bridgeUser,ownsAccount:host.ownsAccount,captureAccount:host.captureAccount,locale,race:authority,initialRaceChallengeId:challenge,identity,raceLocalePolicy:policy,applyCoinBalance:host.applyCoinBalance,replaceProfile:host.replaceProfile,postToGame});
 window.switchOwner=uid=>window.authListener({user:uid===null?null:{...users[uid]},profile:uid===null?null:{level:2,wins:1,winStreak:1,coins:222}});
 React.useEffect(()=>{if(failureMode==='retire-before-read'&&host.snapshot.user?.uid==='owner-1')window.switchOwner('owner-2');},[host.snapshot.user?.uid]);
 window.owner=host.snapshot.user?.uid;window.categoryCount=coordination.prefetchedCategories.length;
 React.useLayoutEffect(()=>{window.frames.push({owner:window.owner,locale,count:window.categoryCount});});
 return <p>{window.owner}:{window.categoryCount}</p>;}
window.root=createRoot(document.getElementById('root'));const app=<App/>;
window.root.render(new URLSearchParams(location.search).get('strict')==='true'?<React.StrictMode>{app}</React.StrictMode>:app);
`);
let browser, server;
const failures=[];
try {
  await build({root:scratch,configFile:false,logLevel:"error",define:{"import.meta.env.VITE_RACE_TO_10_ENABLED":JSON.stringify("1"),"process.env.NODE_ENV":JSON.stringify(reactRuntime)},build:{outDir:"dist"}});
  server=createServer(async(request,response)=>{
    try {const url=new URL(request.url,"http://localhost"),file=path.join(scratch,"dist",url.pathname==="/"?"index.html":url.pathname);
      response.setHeader("Content-Type",file.endsWith(".js")?"text/javascript":"text/html");response.end(await readFile(file));
    }catch{response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  for(const strict of [false,true])for(const width of [1280,390])for(const scenario of ["profile","access","catalog","account-return","unmount","cached-account","cached-return","cached-locale","cached-signout","cached-authority","cached-policy","cached-deeplink","access-throw","access-reject","catalog-throw","catalog-reject","retire-before-read"]){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    try {
      await page.goto('http://127.0.0.1:'+server.address().port+'/?strict='+strict+'&scenario='+scenario);
      await page.waitForFunction(owner=>window.owner===owner&&window.accesses.length===1,scenario==='retire-before-read'?'owner-2':'owner-1');
    const subscriptions = strict && reactRuntime === 'development' ? 2 : 1;
    assert.equal(await page.evaluate(()=>window.authSubscriptions),subscriptions,'React runtime did not exercise the expected setup count');
    assert.equal(await page.evaluate(()=>window.authDisposals),subscriptions-1,'StrictMode did not replay subscription cleanup');
    assert.equal(await page.evaluate(()=>window.liveSubscriptions),1,'effect replay left duplicate live subscriptions');
      if(scenario==='retire-before-read'){
        await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
        assert.equal(await page.evaluate(()=>window.accesses.length),1,'retired queued preload issued an extra provider read');
        assert.equal(await page.evaluate(()=>window.catalogs.length),0);
      }else if(scenario.endsWith('-throw')||scenario.endsWith('-reject')){
        if(scenario.startsWith('catalog-')){
          await page.evaluate(()=>window.accesses[0].resolve({enabled:true}));
          await page.waitForFunction(()=>window.catalogs.length===1);
        }
        await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
        assert.deepEqual(errors,[],'optional preload escaped its rejection handling');
        assert.equal(await page.locator('#root p').count(),1,'optional preload destroyed the mounted host');
        assert.equal(await page.evaluate(()=>window.categoryCount),0);
        assert.equal(await page.evaluate(()=>window.accesses.length),1);
        assert.equal(await page.evaluate(()=>window.catalogs.length),scenario.startsWith('catalog-')?1:0);
      }else if(scenario==='profile'||scenario.startsWith('cached-')){
        await page.evaluate(()=>window.accesses[0].resolve({enabled:true}));
        await page.waitForFunction(()=>window.catalogs.length===1);
        await page.evaluate(()=>window.catalogs[0].resolve({categories:[{categoryId:'mixed'}]}));
        await page.waitForFunction(()=>window.categoryCount===1);
        await page.evaluate(mode=>{window.frames=[];
          if(mode==='cached-locale')window.setLocale('fr');
          else if(mode==='cached-signout')window.switchOwner(null);
          else if(mode==='cached-authority')window.replaceAuthority();
          else if(mode==='cached-policy'){window.setLocale('fr');window.setPolicy('english-only');}
          else if(mode==='cached-deeplink')window.setChallenge('challenge-link');
          else {window.switchOwner(mode==='profile'?'owner-1':'owner-2');if(mode==='cached-return')window.switchOwner('owner-1');}
        },scenario);
        await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
        if(scenario==='profile'){
          assert.equal(await page.evaluate(()=>window.accesses.length),1,'profile notification repeats access/catalog loading');
          assert.equal(await page.evaluate(()=>window.categoryCount),1,'profile notification discarded cached categories');
        }else{
          const frames=await page.evaluate(()=>window.frames);
          assert.ok(frames.length>0,'replacement never committed');
          assert.ok(frames.every(frame=>frame.count===0),'a committed replacement frame exposed stale cached categories: '+JSON.stringify(frames));
          assert.equal(await page.evaluate(()=>window.accesses.length),['cached-signout','cached-policy'].includes(scenario)?1:2,'replacement access reads do not match eligibility');
          if(scenario==='cached-deeplink'){
            await page.evaluate(()=>window.accesses[1].resolve({enabled:true}));
            await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
            assert.equal(await page.evaluate(()=>window.catalogs.length),1,'deep link issued an unnecessary catalog request');
          }
        }
      }else if(scenario==='catalog'){
        await page.evaluate(()=>window.accesses[0].resolve({enabled:true}));
        await page.waitForFunction(()=>window.catalogs.length===1);
        await page.evaluate(()=>{window.switchOwner('owner-2');window.catalogs[0].resolve({categories:[{categoryId:'stale'}]});});
        await page.waitForFunction(()=>window.owner==='owner-2');
        assert.equal(await page.evaluate(()=>window.categoryCount),0,'stale categories escaped account ownership');
      }else{
        await page.evaluate(mode=>{
          if(mode==='unmount')window.root.unmount();
          else {window.switchOwner('owner-2');if(mode==='account-return')window.switchOwner('owner-1');}
          window.accesses[0].resolve({enabled:true});
        },scenario);
        await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
        assert.equal(await page.evaluate(()=>window.catalogs.length),0,'stale access triggered a catalog request');
        assert.equal(await page.evaluate(()=>window.accesses.length),scenario==='unmount'?1:2,'replacement account visit did not receive exactly one fresh access read');
      }
      assert.deepEqual(errors,[]);
      if(scenario==='unmount')assert.equal(await page.evaluate(()=>window.liveSubscriptions),0,'unmount retained authentication subscription');
      console.log('Category prefetch passed: '+scenario+' at '+width+'px, strict='+strict+', runtime='+reactRuntime+'.');
    }catch(error){failures.push({scenario,width,strict,message:error.message});console.error('Category prefetch FAILED: '+JSON.stringify(failures.at(-1)));}
    finally{await context.close();}
  }
  assert.deepEqual(failures,[],JSON.stringify(failures));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
