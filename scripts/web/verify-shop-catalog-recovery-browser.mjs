import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

// Injected component regression evidence only; actual provider recovery is tested on Jest.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.resolve(root, 'artifacts/shop-catalog-recovery');
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
await mkdir(evidence, {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/shop-catalog-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ShopModalPage} from ${JSON.stringify(path.join(root, 'src/web/play/modalPages/commerce/ShopModalPage.tsx'))};
import {ShopSubscriptionContext} from ${JSON.stringify(path.join(root, 'src/web/play/modalPages/commerce/ShopSubscriptionContext.ts'))};
import {GameFrameApp} from ${JSON.stringify(path.join(root, 'src/web/play/GameFrameApp.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, 'src/web/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root,'src/web/play/guidance/guidanceConfig.ts'))};
import {useJestProductCatalog} from ${JSON.stringify(path.join(root, 'platforms/web/jest/src/useJestProductCatalog.ts'))};
import {setLocaleAndWait, tr} from ${JSON.stringify(path.join(root, 'src/web/play/i18n.ts'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.modal-shell.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.modal-rewards.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.modal-commerce.css'))};
const shellMode=new URL(location.href).searchParams.get('shell');
let mode=shellMode?'failure':'healthy', subscriptionMode=shellMode?'failure':'healthy', held=[];
const owner='catalog-owner';
applyPlayerPreferences({locale:'en',onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
const profile={username:'Player',coins:595,level:1,xp:0,winStreak:0,gamesPlayed:0,wins:0,achievements:[],classicIndex:0};
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
let initialized=false;
window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type==='game:ready'&&!initialized){initialized=true;setTimeout(()=>{host({type:'host:init',payload:{protocolVersion:1,sessionId:'catalog-session',locale:'en',gameMode:'classic',user:{uid:owner,isAnonymous:false},profile,products:[]}});host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'catalog-fixture',text:'A musical instrument',answerLength:5,evaluation:{answer:'piano',locale:'en'},sessionToken:'catalog-fixture-token-00000000001',gameMode:'classic',index:0,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}}});},50);}});
const coins=Array.from({length:6},(_,i)=>({productId:'coins-'+i, productType:'consumable',
  name:'Coins '+i, description:'Confirmed coin pack', coins:250*(i+1), displayPrice:'£0.99'}));
const premium={productId:'premium',productType:'subscription',name:'Premium',description:'Provider subscription',
  coins:0,displayPrice:'£0.00',subscriptionStatus:'active',billingPeriod:'monthly'};
const purchases={
  getProducts:async()=>{const current=mode; if(current==='hold')return new Promise(resolve=>held.push(resolve));
    if(current==='delay')await new Promise(resolve=>setTimeout(resolve,150));
    if(current==='throw')throw Error('Injected transport failure');
    return current==='failure'?{status:'retryable-failure'}:{status:'success',value:current==='empty'?[]:coins};},
  getSubscriptions:async()=>subscriptionMode==='failure'?{status:'retryable-failure'}:
    {status:'success',value:mode==='empty'?[]:[premium]}
};
const activity=async operation=>operation(), track=()=>{};
function App(){
 const [player,setPlayer]=React.useState('player-one');
 const session=React.useMemo(()=>({player:{playerId:player,registered:true}}),[player]);
 const [products,,refresh,state]=useJestProductCatalog({purchases,session,subscriptionsEnabled:true,
   withPlatformActivity:activity,trackFunnel:track});
 window.shopFixture={refresh:async(next,subs='healthy')=>{mode=next;subscriptionMode=subs;await refresh();},
   locale:async locale=>{await setLocaleAndWait(locale);document.documentElement.lang=locale;
     document.documentElement.dir=locale==='ar'?'rtl':'ltr';return tr('CommonButtons.RETRY');},
   retryMode:()=>{mode='delay';subscriptionMode='healthy';},
   switchPlayer:()=>{mode='failure';setPlayer('player-two');},
   release:()=>held.splice(0).forEach(resolve=>resolve({status:'success',value:coins}))};
 const context=React.useMemo(()=>({products,refresh,catalogLoading:state.loading,catalogError:state.error,
   cancel:async()=> 'cancelled'}),[products,refresh,state]);
 React.useEffect(()=>{if(shellMode&&initialized)host({type:'host:init',payload:{protocolVersion:1,sessionId:'catalog-session',locale:'en',gameMode:'classic',user:{uid:owner,isAnonymous:false},profile,products:shellMode==='no-provider'?[]:products}});},[products]);
 if(shellMode)return <ShopSubscriptionContext.Provider value={shellMode==='no-provider'?null:context}><GameFrameApp localBridge/></ShopSubscriptionContext.Provider>;
 return <ShopSubscriptionContext.Provider value={context}><div className="game-modal-backdrop">
 <section className="game-modal modal-shop" role="dialog"><h2>Shop</h2>
 <ShopModalPage balance={13765} products={products} onPurchase={()=>{throw Error('Unexpected purchase');}}/>
 </section></div></ShopSubscriptionContext.Provider>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser, server;
try {
 await build({root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;
   const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');
   res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true});
 for(const width of [1280,390,280]){
  const page=await browser.newPage({viewport:{width,height:844}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.querySelectorAll('.game-shop-grid article').length===7);
  for(const locale of ['en','ar','de','es','fr','hi','id','it','ja','ko','nl','pl','pt','ru','tr','vi']){
   await page.evaluate(()=>document.querySelector('.game-modal').scrollTop=0);
   const retryLabel=await page.evaluate(locale=>window.shopFixture.locale(locale),locale);
   await page.evaluate(()=>window.shopFixture.refresh('failure'));
   await page.getByRole('alert').waitFor();
   assert.equal(await page.locator('.game-shop-grid article').count(),7);
   assert.equal(await page.locator('.game-shop-grid button:disabled').count(),6);
   const retry=page.getByRole('button',{name:retryLabel,exact:true});
   assert.equal(await retry.isEnabled(),true);
   const geometry=await retry.evaluate(button=>{const r=button.getBoundingClientRect();
     const alert=button.closest('[role=alert]'),grid=alert.nextElementSibling;
     return {hittable:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),
       overlap:alert.getBoundingClientRect().bottom>grid.getBoundingClientRect().top,
       overflow:alert.scrollWidth> alert.clientWidth};});
   assert.deepEqual(geometry,{hittable:true,overlap:false,overflow:false},locale+' at '+width);
   if(['en','ar','de'].includes(locale))await page.screenshot({path:path.join(evidence,'shop-error-'+locale+'-'+width+'.png')});
   await page.evaluate(()=>window.shopFixture.retryMode());
   await retry.click();
   assert.equal(await retry.isEnabled(),false);
   await page.getByRole('alert').waitFor({state:'hidden'});
   assert.equal(await page.locator('.game-shop-grid button:enabled').count(),6);
  }
  await page.evaluate(()=>window.shopFixture.refresh('empty'));
  assert.equal(await page.locator('.game-shop-grid article').count(),0);
  assert.equal(await page.getByRole('alert').count(),0);
  assert.ok((await page.locator('.game-shop-grid').innerText()).length>0);
  await page.evaluate(()=>window.shopFixture.refresh('failure','failure'));
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('.game-shop-grid').innerText(),'');
  await page.evaluate(()=>window.shopFixture.refresh('healthy'));
  await page.evaluate(()=>window.shopFixture.refresh('healthy','failure'));
  assert.equal(await page.locator('.shop-subscription-card').count(),0);
  assert.equal(await page.locator('.game-shop-grid article').count(),6);
  await page.evaluate(()=>{void window.shopFixture.refresh('hold');});
  await page.evaluate(()=>window.shopFixture.refresh('empty'));
  await page.evaluate(()=>window.shopFixture.release());
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.game-shop-grid article').count(),0,'Late success must not restore an older catalog');
  await page.evaluate(()=>window.shopFixture.refresh('healthy'));
  await page.evaluate(()=>window.shopFixture.switchPlayer());
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('.game-shop-grid article').count(),1,'A different player must not inherit cached coin packs');
  await page.goto('http://127.0.0.1:'+server.address().port+'/?shell=failed');
  await page.getByRole('button',{name:'Buy coins',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('.game-shop-grid article').count(),0);
  await page.evaluate(()=>window.shopFixture.retryMode());
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.getByRole('alert').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelectorAll('.game-shop-grid article').length===7);
  await page.goto('http://127.0.0.1:'+server.address().port+'/?shell=no-provider');
  await page.getByRole('heading',{name:'A musical instrument',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Buy coins',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('Shop catalog recovery passed all 16 locales at '+width+'px; empty, subscription failure, stale reply and owner switch verified.');
  await page.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
