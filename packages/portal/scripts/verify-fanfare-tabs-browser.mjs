import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode=process.env.FANFARE_REACT_MODE??'production';
const integratedOnly=process.env.FANFARE_INTEGRATED_ONLY==='1';
assert(['development','production'].includes(mode));
const output = path.resolve(process.env.FANFARE_REPORT_DIR ?? path.join(root, '../../artifacts/fanfare-tabs-2026-10-16', mode));
await mkdir(output, {recursive:true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive:true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/fanfare-tabs-'));
const source = file => JSON.stringify(path.join(root, 'src', file));
let browser, server;
const observations = [];
try {
  await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
  await writeFile(path.join(scratch, 'index.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameModalView} from ${source('play/GameModalView.tsx')};
import {FanfareTabs} from ${source('play/modalPages/fanfare/FanfareTabs.tsx')};
import {GameHeader} from ${source('play/GameFrameControls.tsx')};
import {CoinFlight} from ${source('play/CoinFlight.tsx')};
import {createInitialGameSession,gameSessionReducer} from ${source('play/gameSession.ts')};
import {applyPlayerPreferences} from ${source('play/playerPreferences.ts')};
import {setLocaleAndWait} from ${source('play/i18n.ts')};
import ${source('styles.css')};
const noop=()=>{},params=new URLSearchParams(location.search);
applyPlayerPreferences({locale:'en',reducedMotion:params.has('reduced'),muted:true,onboardingComplete:true});
const loaded=gameSessionReducer(createInitialGameSession(),{type:'loadRiddle',riddle:{riddleId:'test-win',
 sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',text:'A small stage reward',answerLength:5,
 attemptsUsed:1,hasUsedContinue:false,awaitingContinue:false,acceptedGuesses:[{attempt:1,feedback:[...'PIANO'].map(letter=>({letter,status:'green'}))}]}});
const reward={coinsEarned:50,totalCoins:150,leveledUp:true,newLevel:3,newlyUnlockedAchievementIds:['first_win','perfect_guess']};
window.probe={next:0,close:0,previews:[],phases:[],flights:0,errors:[]};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));
window.addEventListener('unhandledrejection',e=>window.probe.errors.push(String(e.reason)));
window.addEventListener('riddle-quest:victory-dismissed',e=>window.probe.dismissed=e.detail.outcomeKey);
new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n instanceof HTMLElement&&n.matches('.reward-coin-particles'))window.probe.flights++;}).observe(document.body,{childList:true,subtree:true});
let previous='',frame=0;function sample(){frame++;const t=document.querySelector('.fanfare-tabs'),c=t?.querySelector('.current');
 if(document.querySelector('[role="dialog"]'))window.probe.dialogFirstFrame??=frame;
 if(t)window.probe.tabsFirstFrame??=frame;
 const key=t?.dataset.phase+':'+c?.dataset.kind+':'+c?.querySelector('.fanfare-tab-copy strong')?.textContent;
 if(t&&key!==previous){window.probe.phases.push({phase:t.dataset.phase,kind:c?.dataset.kind,time:performance.now()});previous=key;}requestAnimationFrame(sample);}requestAnimationFrame(sample);
function App(){const [state,setState]=React.useState({...loaded,profile:{coins:150,achievements:[]},completionAcknowledged:!params.has('late'),
 lastRewards:params.has('late')?null:params.has('single')?{...reward,coinsEarned:0,leveledUp:false,newlyUnlockedAchievementIds:[]}:reward,
 ...(params.has('purchase')?{modal:'reward',auxiliaryFanfare:{id:'purchase-1',kind:'purchase',coinsAwarded:50,totalCoins:150,achievementIds:['first_win']}}:{})});
 const [preview,setPreview]=React.useState(null),[paused,setPaused]=React.useState(false),[bonus,setBonus]=React.useState(false),bonusSource=React.useRef(null);
 window.confirm=()=>setState(s=>({...s,completionAcknowledged:true,lastRewards:reward}));window.extra=()=>setState(s=>({...s,lastRewards:reward}));
 window.refresh=()=>setState(s=>({...s,profile:{...s.profile}}));window.pause=setPaused;window.retire=()=>setState(s=>({...s,modal:null}));
 window.bonus=()=>{setState(s=>({...s,profile:{...s.profile,coins:175}}));setBonus(true);};
 const balance=value=>{window.probe.previews.push(value);setPreview(value);};
 return <main className="game-app"><GameHeader state={state} displayedCoins={preview??undefined} commerceAvailable={false} onOpenShop={noop} onToggleMute={noop}/>
 <button id="focus-trigger">Keep playing</button><div ref={bonusSource} style={{position:'fixed',bottom:80,left:140}}>Bonus</div>
 {bonus&&<CoinFlight source={bonusSource} amount={25} total={175} onBalancePreview={balance}/>}
 {params.has('integrated')?<GameModalView state={state} interactionBlocked={paused} onClose={()=>{window.probe.close++;setState(s=>({...s,modal:null}));}}
 onNext={()=>{window.probe.next++;window.probe.completedAt=performance.now();}} onCoinBalancePreview={balance} onContinue={noop} onPurchase={noop} onOpenModal={noop} onToggleMute={noop}
 onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop} onUpdateUsername={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop}/>
 :state.modal&&<FanfareTabs state={state} paused={paused} onBalancePreview={balance} onComplete={()=>{window.probe.close++;window.probe.next++;window.probe.completedAt=performance.now();setState(s=>({...s,modal:null}));}}/>}</main>;}
if(params.has('rtl'))await setLocaleAndWait('ar');
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
  await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(mode)},resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},build:{outDir:'dist',target:'esnext'}});
  server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname,file=path.join(scratch,'dist',name==='/'?'index.html':name);
    const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
    res.setHeader('Content-Type',mime[path.extname(file)]??'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  for(const [width,height,query] of integratedOnly?[]:[[390,844,''],[1280,844,''],[320,400,'rtl'],[390,844,'reduced'],[390,844,'late']]){
    const page=await browser.newPage({viewport:{width,height}});await page.goto(url+'/?'+query);
    await page.locator('.fanfare-tab.current').waitFor();await page.locator('#focus-trigger').focus();
    assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('.game-modal-backdrop').count(),0);
    if(query==='late'){await page.waitForTimeout(1400);assert.equal(await page.evaluate(()=>window.probe.next),0);
      assert.equal(await page.locator('.current').getAttribute('data-kind'),'victory');await page.evaluate(()=>window.confirm());}
    await page.waitForFunction(()=>document.querySelector('.fanfare-tabs')?.dataset.phase==='holding');
    if(query!=='reduced'){
      await page.locator('.reward-coin-particle').first().waitFor();
      const flight=await page.locator('.reward-coin-particle').first().evaluate(c=>{const r=document.querySelector('[data-coin-meter] img').getBoundingClientRect();
        return {x:parseFloat(c.style.left)+parseFloat(c.style.getPropertyValue('--coin-travel-x')),y:parseFloat(c.style.top)+parseFloat(c.style.getPropertyValue('--coin-travel-y')),tx:r.left+r.width/2,ty:r.top+r.height/2};});
      assert(Math.abs(flight.x-flight.tx)<2&&Math.abs(flight.y-flight.ty)<2,'Coins land on the counter icon');
      for(let i=0;i<3;i++)await page.evaluate(()=>window.refresh());
      await page.screenshot({path:path.join(output,`coin-flight-${width}-${query||'en'}.png`)});
    }
    if(query!=='reduced'){await page.waitForFunction(()=>document.querySelector('.fanfare-tabs')?.dataset.phase==='leaving');
      await page.waitForTimeout(90);const g=await page.evaluate(()=>{const c=document.querySelector('.current').getBoundingClientRect(),n=document.querySelector('.waiting').getBoundingClientRect();return {x:c.x,up:n.y-c.y};});
      assert(g.x<0&&g.up<86&&g.up>0,'The successor moves up while the predecessor exits left');}
    await page.waitForFunction(()=>window.probe.next===1);
    const probe=await page.evaluate(()=>window.probe);assert.equal(probe.close,1);assert.equal(probe.flights,query==='reduced'?0:1);
    assert.deepEqual(probe.errors,[]);assert.equal(await page.evaluate(()=>document.activeElement.id),'focus-trigger');
    assert.equal(await page.locator('[data-coin-meter] strong').textContent(),'150');
    const holds=probe.phases.filter(p=>p.phase==='holding');assert.equal(holds.length,4);
    for(const [i,hold] of holds.entries()){const leaving=probe.phases.find(p=>p.phase==='leaving'&&p.time>hold.time);
      const end=leaving?.time??holds[i+1]?.time??probe.completedAt;assert(end-hold.time>=960,'Every tab holds for one second');}
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    if(query!=='reduced'){await page.evaluate(()=>window.bonus());await page.locator('.reward-coin-particle').first().waitFor();
      assert.equal(await page.locator('.fanfare-tabs').count(),0,'CoinFlight works independently of tabs');
      await page.waitForFunction(()=>document.querySelector('[data-coin-meter] strong')?.textContent==='175'&&!document.querySelector('.reward-coin-particles'));}
    observations.push({width,height,query,holds:holds.length,flights:probe.flights,completed:probe.next});
    console.log('Passed '+width+'px '+(query||'en'));await page.close();
  }
  for(const scenario of integratedOnly?[]:['pause','retire','extra']){
    const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(url+'/?'+(scenario==='extra'?'single':''));
    await page.waitForFunction(()=>document.querySelector('.fanfare-tabs')?.dataset.phase==='holding');
    if(scenario==='pause'){await page.evaluate(()=>window.pause(true));await page.waitForTimeout(1250);
      assert.equal(await page.locator('.fanfare-tabs').getAttribute('data-phase'),'holding');await page.evaluate(()=>window.pause(false));}
    else if(scenario==='retire'){await page.evaluate(()=>window.retire());await page.waitForTimeout(1100);
      assert.equal(await page.evaluate(()=>window.probe.next),0);assert.equal(await page.locator('.reward-coin-particle').count(),0);
      assert.equal(await page.locator('[data-coin-meter] strong').textContent(),'150');}
    else{await page.waitForFunction(()=>document.querySelector('.fanfare-tabs')?.dataset.phase==='leaving');await page.evaluate(()=>window.extra());}
    if(scenario!=='retire')await page.waitForFunction(()=>window.probe.next===1);
    assert.deepEqual(await page.evaluate(()=>window.probe.errors),[]);observations.push({scenario,completed:await page.evaluate(()=>window.probe.next)});await page.close();
  }
  for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});await page.goto(url+'/?integrated');
    await page.getByRole('dialog').waitFor();
    await page.locator('.fanfare-tab.current[data-kind="level"]').waitFor();
    await page.waitForFunction(()=>Number.isInteger(window.probe.dialogFirstFrame)&&Number.isInteger(window.probe.tabsFirstFrame));
    const paintFrames=await page.evaluate(()=>({dialogFirstFrame:window.probe.dialogFirstFrame,tabsFirstFrame:window.probe.tabsFirstFrame,phases:window.probe.phases}));
    await writeFile(path.join(output,`paint-frames-${width}.json`),JSON.stringify(paintFrames,null,2));
    assert(paintFrames.tabsFirstFrame>paintFrames.dialogFirstFrame,'The result dialog occupies an earlier frame than its notifications: '+JSON.stringify(paintFrames));
    assert.equal(await page.locator('.level-up-summary').count(),0,'Level-up uses a tab, without another dialog');
    await page.locator('.reward-coin-particle').first().waitFor();
    await page.screenshot({path:path.join(output,`integrated-win-${width}.png`)});
    await page.locator('.fanfare-tabs').waitFor({state:'detached'});
    assert.equal(await page.getByRole('dialog').count(),1,'The separate win screen remains available');
    assert.equal(await page.evaluate(()=>window.probe.flights),1);
    await page.locator('.reward-continue').click();
    await page.waitForFunction(()=>window.probe.next===1);
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.deepEqual(await page.evaluate(()=>window.probe.errors),[]);
    observations.push({scenario:'integrated-win',width,completed:1});await page.close();
  }
  for(const query of integratedOnly?[]:['integrated&purchase','single','missing']){
    const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(url+'/?'+query);
    await page.locator('.fanfare-tab.current').waitFor();
    if(query==='missing')await page.locator('[data-coin-meter]').evaluate(meter=>meter.remove());
    if(query.includes('purchase')){
      assert.equal(await page.getByRole('dialog').count(),0);
      await page.waitForFunction(()=>window.probe.close===1);
      assert.equal(await page.evaluate(()=>window.probe.next),0);
      assert.equal(await page.evaluate(()=>window.probe.flights),1);
    }else{
      await page.waitForFunction(()=>window.probe.next===1);
      assert.equal(await page.evaluate(()=>window.probe.flights),0);
    }
    assert.deepEqual(await page.evaluate(()=>window.probe.errors),[]);
    observations.push({query,completed:true});await page.close();
  }
  await writeFile(path.join(output,'verification.json'),JSON.stringify({passed:true,observations},null,2));
  console.log(JSON.stringify({passed:true,mode,scenarios:observations.length,output}));
} finally {
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});
}
