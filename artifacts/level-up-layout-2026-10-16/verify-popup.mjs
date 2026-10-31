import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const evidence=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(evidence,'../../packages/portal');
const require=createRequire(path.join(root,'package.json'));
const {build}=await import(require.resolve('vite'));
const playwright=await import(require.resolve('@playwright/test'));
const {chromium}=playwright.default??playwright;
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/level-up-popup-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,'src/play/GameModalView.tsx'))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,'src/play/gameSession.ts'))};
import {setLocaleAndWait} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
applyPlayerPreferences({reducedMotion:true,muted:true,onboardingComplete:true});
const root=createRoot(document.querySelector('#root'));
function Fixture({locale,level}){
  const [paused,setPaused]=React.useState(false);
  window.holdLevel=()=>setPaused(true);
  const noop=()=>{};
  return <div data-fixture={locale+'-'+level}>
    <GameModalView state={{...createInitialGameSession(),paused,modal:'victory',completionAcknowledged:true,
      lastOutcome:{id:locale+'-'+level,kind:'win',riddleId:'layout-riddle',sessionToken:'layout-session',gameMode:'classic',attempts:1,isCorrect:true},
      lastRewards:{leveledUp:true,newLevel:level,coinsEarned:0,newlyUnlockedAchievementIds:[]}}}
      onClose={()=>window.modalProbe.closed++} onNext={()=>window.modalProbe.advanced++}
      onCoinBalancePreview={noop} onContinue={noop} onPurchase={noop} onOpenModal={noop}
      onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop}
      onUpdateUsername={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop}/>
  </div>;
}
window.injectLevel=async(locale,level)=>{
  await setLocaleAndWait(locale);
  window.modalProbe={closed:0,advanced:0};
  root.render(<Fixture key={locale+'-'+level} locale={locale} level={level}/>);
};
`);
let server,browser;
const results=[];
try {
  await build({root:scratch,configFile:false,logLevel:'error',
    resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},
    define:{'process.env.NODE_ENV':'"production"'},build:{outDir:'dist'}});
  server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.woff2')?'font/woff2':'text/html');
      res.end(await readFile(file));
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  for(const [width,height] of [[320,568],[390,844],[1280,844],[844,390]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>typeof window.injectLevel==='function');
    for(const locale of ['en','de','ar','ja','hi','ko','ru','es','fr','it','nl','pl','pt','tr','vi','id'])for(const level of [2,100]){
      await page.evaluate(([locale,level])=>window.injectLevel(locale,level),[locale,level]);
      await page.locator('[data-fixture="'+locale+'-'+level+'"]').waitFor({state:'attached'});
      await page.locator('.fanfare-tabs[data-phase="holding"] .current[data-kind="level"]').waitFor();
      await page.evaluate(()=>window.holdLevel());
      await page.evaluate(()=>document.fonts.ready);
      const layout=await page.locator('.fanfare-tab.current[data-kind="level"]').evaluate(modal=>{
        const number=modal.querySelector('.fanfare-tab-copy strong'),n=number.getBoundingClientRect(),m=modal.getBoundingClientRect();
        return {fontSize:parseFloat(getComputedStyle(number).fontSize),centerOffset:Math.abs(n.x+n.width/2-m.x-m.width/2),
          foregroundSparkles:document.querySelectorAll('.fanfare-burst,.fanfare-tab-icon').length,
          backgroundWheels:document.querySelectorAll('.spinning-wheel-graphic').length,
          overflow:modal.scrollHeight>modal.clientHeight+1,
          fits:n.x>=m.x&&n.right<=m.right&&n.top>=m.top&&n.bottom<=m.bottom&&m.bottom<=innerHeight&&m.top>=0};
      });
      results.push({width,height,locale,level,...layout});
      if(level===2&&['en','de','ar'].includes(locale))await page.screenshot({path:path.join(evidence,`popup-${locale}-${width}x${height}.png`)});
      assert.ok(layout.fontSize>=28,JSON.stringify(results.at(-1)));
      assert.ok(layout.centerOffset<=1,JSON.stringify(results.at(-1)));
      assert.equal(layout.foregroundSparkles,0);
      assert.equal(layout.backgroundWheels,1);
      assert.equal(layout.overflow,false,JSON.stringify(results.at(-1)));
      assert.equal(layout.fits,true,JSON.stringify(results.at(-1)));
      await page.locator('.reward-continue').click();
      assert.deepEqual(await page.evaluate(()=>window.modalProbe),{closed:1,advanced:1});
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {
  await browser?.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  await rm(scratch,{recursive:true,force:true});
  await writeFile(path.join(evidence,'popup-results.json'),JSON.stringify({supportingInjectedChecks:true,results},null,2)+'\n');
}
console.log(JSON.stringify({cases:results.length,passed:true}));
