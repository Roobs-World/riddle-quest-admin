// Supporting injected source check; actual Jest-hosted evidence is separate.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = fileURLToPath(new URL("../../../../packages/web-game/", import.meta.url));
const evidence = path.resolve(process.env.JEST_PREPARATION_FAILURE_EVIDENCE ?? path.join(root, '../../artifacts/jest-preparation-failure'));
await mkdir(evidence, {recursive: true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/jest-preparation-failure-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<html><body><div id="root"></div><div id="host-loading" style="position:fixed;inset:0;background:#333;color:white;z-index:9999">Host loading</div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {JestPlayApp} from ${JSON.stringify(path.join(root,'../../platforms/web/jest/src/JestPlayApp.tsx'))};
window.fixture={calls:[],reads:0};
createRoot(document.getElementById('root')).render(<JestPlayApp/>);
`);

// Replace external authority and the downstream gameplay shell only. The real
// app, startup/commit boundary, failure view, locale loading and gate stay intact.
const overrides = {
  './runtimeMode': `export const resolveJestRuntimeMode=()=>({authHarness:false,mockBackend:false,useSdkPlatform:false});export const shouldEnableJestSubscriptions=()=>false;`,
  './MockJestPlatform': `import {MockJestPlatform as Base} from ${JSON.stringify(path.join(root,'../../platforms/web/jest/src/MockJestPlatform.ts'))};
export class MockJestPlatform extends Base{constructor(){super(false);window.fixture.platform=this;
const progress=this.setLoadingProgress;this.setLoadingProgress=value=>{window.fixture.calls.push(['progress',value]);progress(value);};
const loaded=this.markGameLoaded;this.markGameLoaded=()=>{window.fixture.calls.push(['loaded']);loaded();document.getElementById('host-loading')?.remove();};
const write=this.writePlayerData;this.writePlayerData=async value=>{window.fixture.calls.push(['write']);return write(value);};}}`,
  './createJestBackend': `export const createJestBackend=()=>({exchangeIdentity:async()=>({status:'success',customToken:'fixture',uid:'fixture-uid'})});`,
  '../play/services': `export const resolveHostServicesMode=()=> 'firebase';export const getHostConfigurationWarning=()=>null;export const createHostServices=()=>({preloadInitialRiddles(){},loadRiddle:async()=>({})});`,
  '../firebase': `export const auth={};export const loadUserDocument=async()=>{window.fixture.reads++;if(!sessionStorage.getItem('profile-read-failed')){sessionStorage.setItem('profile-read-failed','yes');throw Error('profile-read-unavailable');}return {coins:670,stats:{level:4,xp:360,wins:4,gamesPlayed:5},progress:{classicIndex:5}};};`,
  'firebase/auth': `export const signInWithCustomToken=async()=>{};`,
  './JestFirebaseAppCheck': `export const ensureJestFirebaseAppCheckReady=async()=>{};`,
  './useJestPresence': `export const useJestPresence=()=>({setPresenceState(){},togglePresence(){}});`,
  './JestProfileSubscriptions': `export const JestProfileSubscriptions=()=>null;`,
  './JestHostedPlaySession': `export const createJestHostedPlaySession=input=>input;`,
  '../play/PlayHostApp': `import React,{useEffect} from 'react';export function PlayHostApp({session,onPlayable}){useEffect(()=>{window.fixture.mountedProfile=session.initialPlayerData?.profile;onPlayable();},[]);return React.createElement("button",null,"Playable");}`,
};
let browser,server;
const cases=[];
try {
  await build({root:scratch,configFile:false,logLevel:'error',
    define:{'import.meta.env.VITE_PLATFORM_TARGET':JSON.stringify('jest')},
    plugins:[{name:'isolated-startup-authority',enforce:'pre',
      resolveId(id,importer){if(importer===path.join(root,'../../platforms/web/jest/src/JestPlayApp.tsx')&&id in overrides)return '\0startup-fixture:'+id;},
      load(id){if(id.startsWith('\0startup-fixture:'))return overrides[id.slice('\0startup-fixture:'.length)];},
    }],
    resolve:{alias:{'@riddle-quest/core/referrals':path.join(root,'../core/src/referrals/index.ts'),'@riddle-quest/core/bridge/constants':path.join(root,'../core/src/bridge/constants.ts'),'@riddle-quest/core/race':path.join(root,'../core/src/race/index.ts')}},
    build:{outDir:'dist'},
  });
  server=createServer(async(request,response)=>{
    try{const pathname=new URL(request.url,'http://localhost').pathname;const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(await readFile(file));}
    catch{response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  for(const width of [320,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install();
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.getByRole('heading',{name:'Startup failed',exact:true}).waitFor();
    const failure=await page.evaluate(()=>({loaded:window.fixture.platform.loaded,progress:window.fixture.platform.progress,calls:window.fixture.calls,reads:window.fixture.reads,mounted:!!window.fixture.mountedProfile,overlay:!!document.getElementById('host-loading')}));
    await page.screenshot({path:path.join(evidence,'failure-'+width+'.png')});
    cases.push({width,failure});await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingInjectedChecks:true,hostedE2E:false,cases},null,2)+'\n');
    assert.equal(failure.loaded,true,'Mandatory profile failure must dismiss the Jest loading overlay to expose Retry');
    assert.equal(failure.overlay,false);assert.equal(failure.mounted,false);assert.equal(failure.calls.some(c=>c[0]==='write'),false);
    assert.equal(failure.progress.at(-1),100);
    // Advance just the local harness timer, not a hosted clock, to prove cleanup.
    await page.clock.fastForward(20_000);
    assert.equal(await page.evaluate(()=>window.fixture.platform.progress.at(-1)),100,'Failure must stop the loading heartbeat');
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await page.getByRole('button',{name:'Playable',exact:true}).waitFor();
    const recovered=await page.evaluate(()=>({profile:window.fixture.mountedProfile,loaded:window.fixture.platform.loaded,overlay:!!document.getElementById('host-loading')}));
    assert.equal(recovered.profile.coins,670);assert.equal(recovered.profile.classicIndex,5);assert.equal(recovered.loaded,true);assert.equal(recovered.overlay,false);assert.deepEqual(errors,[]);
    cases.at(-1).recovered=recovered;await page.screenshot({path:path.join(evidence,'recovered-'+width+'.png')});
    await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingInjectedChecks:true,hostedE2E:false,cases},null,2)+'\n');
    console.log('Preparation failure and native Retry passed at '+width+'px.');await page.close();
  }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
