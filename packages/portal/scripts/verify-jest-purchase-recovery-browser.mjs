import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, symlink, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';

// Supporting injected full-app E2E; uploaded Jest sandbox validation remains separate.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json'));
const {build}=await import(pathToFileURL(require.resolve('vite')));
const {chromium}=require('@playwright/test');
const ts=require('typescript');
const react=(await import(pathToFileURL(require.resolve('@vitejs/plugin-react')))).default;
const scratch=await mkdtemp('/tmp/riddle-quest-jest-purchase-e2e-');
const evidence=path.resolve(process.env.JEST_PURCHASE_RECOVERY_EVIDENCE_DIR??path.join(scratch,'evidence'));
await mkdir(evidence,{recursive:true});
await symlink(path.join(root,'node_modules'),path.join(scratch,'node_modules'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="root"></div><div id="host-loading" style="position:fixed;inset:0;z-index:9999;background:#111;color:white">Host loading</div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {JestPlayApp} from ${JSON.stringify(path.join(root,'src/jest/JestPlayApp.tsx'))};
import {configureBrowserErrorReporter} from ${JSON.stringify(path.join(root,'src/observability/browserErrorReporter.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.caught=[];configureBrowserErrorReporter((error,context)=>window.caught.push({message:String(error),context}));
createRoot(document.getElementById('root')).render(<JestPlayApp/>);
`);

// Compose the maintained SDK fixture with injected external purchase outcomes.
// Application modules, request deadlines and the downstream game remain real.
const sdkSource=await readFile(path.join(root,'src/jest/__tests__/authentication.jest-sdk-harness.ts'),'utf8');
const sdkFixture=path.join(scratch,'sdk-fixture.mjs');
await writeFile(sdkFixture,ts.transpileModule(sdkSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {installJestSdkHarness}=await import(pathToFileURL(sdkFixture));
let sdkSetup;
await installJestSdkHarness({addInitScript:async(fn,arg)=>{sdkSetup=`(${fn.toString()})(${JSON.stringify(arg)});`;}});
const purchaseSetup=()=>{
  const sdk=window.JestSDK,state=window.__RIDDLE_QUEST_JEST_AUTH_TEST__;
  const key=new URLSearchParams(location.search).get('case');
  const readPending=()=>{
    const done=JSON.parse(sessionStorage.getItem('completedPurchaseTokens')??'[]');
    return {purchases:key!=='cold'&&!done.includes('recoverable-token')?[{purchaseToken:'recoverable-token',productSku:'com.roobsworld.riddlequest.coinpack1'}]:[],purchasesSigned:'signed-recovery-page',hasMore:false};
  };
  window.readPendingPurchases=readPending;
  sdk.payments.getIncompletePurchases=async()=>{
    state.calls.push('sdk.payments.getIncompletePurchases');
    if(key.startsWith('sdk-read')&&!sessionStorage.getItem('read-stalled')){
      sessionStorage.setItem('read-stalled','1');state.calls.push('stall:read');
      await new Promise(()=>{});
    }
    return readPending();
  };
  sdk.payments.completePurchase=async({purchaseToken})=>{
    state.calls.push('sdk.payments.completePurchase:'+purchaseToken);
    const attempts=JSON.parse(sessionStorage.getItem('purchaseAcknowledgmentAttempts')??'[]');attempts.push(purchaseToken);
    sessionStorage.setItem('purchaseAcknowledgmentAttempts',JSON.stringify(attempts));
    if(key.startsWith('sdk-complete')&&!sessionStorage.getItem('completion-stalled')){
      sessionStorage.setItem('completion-stalled','1');state.calls.push('stall:complete');
      await new Promise(()=>{});
    }
    const done=JSON.parse(sessionStorage.getItem('completedPurchaseTokens')??'[]');if(!done.includes(purchaseToken))done.push(purchaseToken);
    sessionStorage.setItem('completedPurchaseTokens',JSON.stringify(done));return {result:'success'};
  };
  const loaded=sdk.markGameLoaded;sdk.markGameLoaded=()=>{loaded();document.getElementById('host-loading')?.remove();};
};
const sourcePaths=JSON.parse(await readFile(path.join(root,'tsconfig.json'),'utf8')).compilerOptions.paths;
const aliases=Object.entries(sourcePaths).filter(([key])=>!key.includes('*')).sort((a,b)=>b[0].length-a[0].length).map(([key,values])=>({find:new RegExp('^'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'),replacement:path.resolve(root,values[0])}));
const sourceHashes={};
const {createHash}=await import('node:crypto');
for(const name of ['JestPlayApp.tsx','JestSdkPlatform.ts','startup.ts','backend.ts','purchases.ts','createJestBackend.ts'])sourceHashes[name]=createHash('sha256').update(await readFile(path.join(root,'src/jest',name))).digest('hex');
let browser,server;
const authority=new Map();
const cases=[];
const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.webm':'audio/webm','.ttf':'font/ttf','.json':'application/json','.html':'text/html'};
const sockets=new Set();
try {
  await build({root:scratch,configFile:false,logLevel:'error',plugins:[react(),{name:'test-purchase-authority-boundary',enforce:'pre',resolveId(id,importer){if(importer===path.join(root,'src/jest/JestPlayApp.tsx')&&id==='./createJestBackend')return '\0purchase-authority';},load(id){if(id==='\0purchase-authority')return `import {JestBackendClient} from ${JSON.stringify(path.join(root,'src/jest/backend.ts'))};export const createJestBackend=()=>new JestBackendClient('/__authority/'+new URLSearchParams(location.search).get('case'));`;}}],define:{'import.meta.env.VITE_PLATFORM_TARGET':JSON.stringify('jest')},resolve:{alias:aliases},build:{outDir:path.join(scratch,'dist'),target:'esnext'}});
  server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/__authority/')){
      const [, ,key,operation]=url.pathname.split('/');
      const record=authority.get(key)??{requests:[],grantAttempts:0,grants:0,aborted:0,grantedTokens:[],balance:300};authority.set(key,record);
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      record.requests.push({operation,purchaseToken:payload.purchaseToken??null});
      res.setHeader('Content-Type','application/json');
      if(operation==='grantJestPurchase'){
        record.grantAttempts++;
        assert.equal(payload.purchaseToken,'recoverable-token');assert.equal(payload.purchaseSigned,'signed-recovery-page');
        if(record.grantAttempts===1&&key.startsWith('timeout')){res.on('close',()=>record.aborted++);return;}
        if(record.grantAttempts===1&&key.startsWith('rejected')){res.writeHead(503).end(JSON.stringify({error:'temporary'}));return;}
        const granted=!record.grantedTokens.includes(payload.purchaseToken);
        if(granted){record.grants++;record.grantedTokens.push(payload.purchaseToken);record.balance+=250;}
        res.end(JSON.stringify({granted,purchaseToken:payload.purchaseToken,coinsAwarded:granted?250:0,newCoins:record.balance}));return;
      }
      if(operation==='exchangeJestIdentity'){res.end(JSON.stringify({customToken:'mock',uid:'jest-mock-player'}));return;}
      if(operation==='syncJestSubscriptions'){res.end(JSON.stringify({verified:true,activeSkus:[],blockedSkus:[]}));return;}
      if(operation==='verifyJestReferrals'){res.end(JSON.stringify({verified:true}));return;}
      throw Error('Unexpected authority operation: '+operation);
    }
    const candidate=path.join(scratch,'dist',url.pathname==='/'?'index.html':url.pathname);
    const file=path.extname(candidate)?candidate:path.join(scratch,'dist/index.html');
    try{res.writeHead(200,{'content-type':types[path.extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404).end();}
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  const baseline=process.argv.includes('--sdk-stall-baseline');
  for(const width of baseline?[390]:[390,1280])for(const outcome of baseline?['sdk-read','sdk-complete']:['cold','timeout','rejected','sdk-read','sdk-complete']){
    const key=outcome==='cold'?'cold':outcome+'-'+width;
    const context=await browser.newContext({viewport:{width,height:844}});
    const page=await context.newPage();const errors=[],consoleErrors=[],failed=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    page.on('requestfailed',req=>failed.push({url:req.url(),error:req.failure()?.errorText}));
    await page.clock.install();
    await page.addInitScript({content:sdkSetup+`(${purchaseSetup.toString()})();`});
    await page.route('https://cdn.jest.com/sdk/sdk.v1.js',route=>route.fulfill({contentType:'text/javascript',body:'/* SDK injected by test */'}));
    const started=Date.now();
    await page.goto(base+'/?harness=jest-auth&registered=1&case='+key);
    if(outcome!=='cold'){
      if(outcome.startsWith('sdk-'))await page.waitForFunction(marker=>window.__RIDDLE_QUEST_JEST_AUTH_TEST__.calls.includes(marker),outcome==='sdk-read'?'stall:read':'stall:complete');
      if(outcome==='timeout'){
        const deadline=Date.now()+10_000;
        while(!(authority.get(key)?.grantAttempts)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
        assert.equal(authority.get(key)?.grantAttempts,1,'Held grant request must reach the authority fixture.');
      }
      if(outcome!=='rejected')await page.clock.fastForward(15_100);
      if(baseline){
        await page.waitForTimeout(100);
        const observed=await page.evaluate(()=>({calls:window.__RIDDLE_QUEST_JEST_AUTH_TEST__.calls,pending:window.readPendingPurchases(),completed:JSON.parse(sessionStorage.getItem('completedPurchaseTokens')??'[]'),overlay:!!document.getElementById('host-loading'),retryVisible:[...document.querySelectorAll('button')].some(button=>button.innerText==='Retry'),startupFailureVisible:document.body.innerText.includes('Startup failed')}));
        cases.push({width,outcome,advancedClockMs:15_100,observed,authority:structuredClone(authority.get(key)??null),requiredBehaviorFailed:!observed.startupFailureVisible||!observed.retryVisible});
        await page.screenshot({path:path.join(evidence,key+'-red-baseline.png')});await context.close();console.log('RED BASELINE '+outcome+': Retry visible='+observed.retryVisible+', host overlay='+observed.overlay);continue;
      }
      await page.getByRole('heading',{name:'Startup failed',exact:true}).waitFor({timeout:25_000});
      const failure=await page.evaluate(()=>({calls:window.__RIDDLE_QUEST_JEST_AUTH_TEST__.calls,pending:window.readPendingPurchases(),completed:JSON.parse(sessionStorage.getItem('completedPurchaseTokens')??'[]'),caught:window.caught,overlay:!!document.getElementById('host-loading')}));
      assert.equal(failure.overlay,false,'The host overlay must expose the failure and Retry.');
      assert.deepEqual(failure.completed,[],'Failed recovery must not acknowledge the purchase.');
      assert.equal(failure.pending.purchases[0]?.purchaseToken,'recoverable-token','Failed recovery must preserve the original incomplete token.');
      assert.equal(failure.calls.filter(call=>call.startsWith('sdk.payments.completePurchase')).length,outcome==='sdk-complete'?1:0);
      assert.equal(failure.calls.includes('sdk.markGameLoaded'),true);
      assert.equal(failure.calls.includes('sdk.progress:100'),true,'Failure must dismiss the manual-loading overlay.');
      const state=authority.get(key)??{requests:[],grantAttempts:0,grants:0};
      assert.equal(state.grantAttempts,outcome==='sdk-read'?0:1);assert.equal(state.grants,outcome==='sdk-complete'?1:0);assert.equal(state.requests.some(req=>req.operation==='exchangeJestIdentity'),false,'Recovery failure must stop identity/session entry.');
      const expected={timeout:'grantJestPurchase timed out.',rejected:'grantJestPurchase failed (503)','sdk-read':'Jest incomplete purchase read timed out','sdk-complete':'Jest purchase completion timed out'}[outcome];
      assert.ok(failure.caught.some(item=>item.message.includes(expected)),'Exercise the actual request or SDK failure boundary.');
      const retry=page.getByRole('button',{name:'Retry',exact:true});assert.equal(await retry.isEnabled(),true);await retry.focus();assert.equal(await retry.evaluate(el=>el===document.activeElement),true);
      await page.screenshot({path:path.join(evidence,key+'-failure.png')});
      cases.push({width,outcome,failure,failedReadyMs:Date.now()-started});
      await retry.click();
    }
    await page.getByRole('button',{name:/let's play/i}).waitFor({timeout:20_000});
    const recovered=await page.evaluate(()=>({calls:window.__RIDDLE_QUEST_JEST_AUTH_TEST__.calls,pending:window.readPendingPurchases(),completed:JSON.parse(sessionStorage.getItem('completedPurchaseTokens')??'[]'),acknowledgmentAttempts:JSON.parse(sessionStorage.getItem('purchaseAcknowledgmentAttempts')??'[]'),overlay:!!document.getElementById('host-loading')}));
    assert.equal(recovered.overlay,false);assert.deepEqual(recovered.pending.purchases,[]);
    if(outcome!=='cold'){
      assert.deepEqual(recovered.completed,['recoverable-token'],'Retry must complete the same token exactly once.');
      assert.deepEqual(recovered.acknowledgmentAttempts,outcome==='sdk-complete'?['recoverable-token','recoverable-token']:['recoverable-token'],'Only the original completion attempt and explicit Retry may acknowledge the retained purchase.');
      const state=authority.get(key);assert.equal(state.grantAttempts,outcome==='sdk-read'?1:2);assert.equal(state.grants,1);assert.equal(state.balance,550,'Durable grant replay must not award currency twice.');
      assert.deepEqual(state.requests.filter(req=>req.operation==='grantJestPurchase').map(req=>req.purchaseToken),outcome==='sdk-read'?['recoverable-token']:['recoverable-token','recoverable-token']);
      cases.at(-1).recovered=recovered;cases.at(-1).authority=structuredClone(state);
    }else {assert.deepEqual(recovered.acknowledgmentAttempts,[],'Cold startup with an empty queue must not acknowledge a purchase.');cases.push({width,outcome,recovered,readyMs:Date.now()-started});}
    await page.getByRole('button',{name:/let's play/i}).click();
    const gotIt=page.getByRole('button',{name:/got it/i});if(await gotIt.isVisible())await gotIt.click();
    await page.locator('.riddle-card h1').waitFor({timeout:15_000});
    assert.equal(await page.getByRole('heading',{name:'Startup failed',exact:true}).count(),0);
    assert.deepEqual(errors,[],'No uncaught errors during startup, failure, native Retry, or playable recovery.');
    const unexpectedConsole=consoleErrors.filter(message=>!((outcome==='rejected'&&message.includes('503 (Service Unavailable)'))||(outcome==='timeout'&&message.includes('net::ERR_ABORTED'))));
    assert.deepEqual(unexpectedConsole,[],'No unexpected console errors.');
    const unexpectedFailed=failed.filter(req=>!req.url.includes('cdn.jest.com/sdk/sdk.v1.js')&&!(outcome==='timeout'&&req.url.endsWith('/grantJestPurchase')));
    assert.deepEqual(unexpectedFailed,[],'No unexpected failed network requests.');
    cases.at(-1).browser={pageErrors:errors,consoleErrors,failedRequests:failed};
    await page.screenshot({path:path.join(evidence,key+'-'+width+'-playable.png')});
    await context.close();
    await writeFile(path.join(evidence,'results.json'),JSON.stringify({status:'running',supportingInjectedChecks:true,hostedE2E:false,sourceHashes,cases},null,2));
    console.log('PASS '+outcome+' '+width+'px: real app startup/recovery, original token retained, no unexpected browser errors.');
  }
  for(const [name,hash]of Object.entries(sourceHashes))assert.equal(createHash('sha256').update(await readFile(path.join(root,'src/jest',name))).digest('hex'),hash,'Source changed while the browser gate ran: '+name);
  await writeFile(path.join(evidence,'results.json'),JSON.stringify({status:baseline?'red-baseline':'passed',supportingInjectedChecks:true,hostedE2E:false,sourceHashes,cases},null,2));
  if(baseline)process.exitCode=1;
  console.log('EVIDENCE '+evidence);
}catch(error){await writeFile(path.join(evidence,'failure.json'),JSON.stringify({status:'failed',message:String(error),stack:error.stack,cases,authority:[...authority]},null,2));console.error('FAIL EVIDENCE '+evidence);throw error;}
finally{await browser?.close();for(const socket of sockets)socket.destroy();if(server)await new Promise(resolve=>server.close(resolve));for(const name of ['dist','main.tsx','index.html','tsconfig.json','sdk-fixture.mjs','node_modules'])await rm(path.join(scratch,name),{recursive:true,force:true});}
