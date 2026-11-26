// Supporting compiled-source regressions; actual hosted Jest checks are separate.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=path.resolve(process.env.RETAINED_MODAL_EVIDENCE??path.join(root,'artifacts/retained-modal-locale'));
await mkdir(evidence,{recursive:true});
await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/retained-modal-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,"src/app/modals/components/GameModalView.tsx"))};
import {createInitialGameSession} from ${JSON.stringify(path.join(root,"src/gameplay/session/gameSession.ts"))};
import {setLocaleAndWait,useLocale,tr} from ${JSON.stringify(path.join(root,"src/localization/browser/i18n.ts"))};
import ${JSON.stringify(path.join(root,"src/app/styles/game.css"))};
const noop=()=>{};
function Fixture(){
  const [modal,setModal]=useState(null);const [blocked,setBlocked]=useState(false);const locale=useLocale();
  window.changeModalLocale=setLocaleAndWait;window.setModalBlocked=setBlocked;
  window.modalCopy=keys=>keys.map(key=>tr(key));window.openTestModal=setModal;
  const state={...createInitialGameSession(),modal,locale};
  return <><main inert={modal!==null}><button id="trigger" onClick={()=>setModal('profile')}>Profile</button></main>
    <div id="owned-modal-surface" inert={blocked||undefined}><GameModalView state={state} interactionBlocked={blocked}
    onClose={()=>setModal(null)} onOpenModal={setModal} onContinue={noop} onPurchase={noop} onNext={noop}
    onToggleMute={noop} onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop}
    onUpdateUsername={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop} onCoinBalancePreview={noop}/></div></>;
}createRoot(document.getElementById('root')).render(<Fixture/>);
`);
const keys={
  profile:['Ranks.CURRENT_RANK','Profile.XP_LEVEL_PREFIX','StatsModal.XP','Profile.TOTAL_COINS_LABEL','Profile.TOTAL_WINS_STAT','Profile.BEST_STREAK_STAT','Profile.DAILY_PUZZLES_STAT','Profile.DELETE_ACCOUNT_BUTTON'],
  settings:['Settings.SOUND_TOGGLE','Settings.LANGUAGE_LABEL','Settings.HELP_BUTTON','Settings.ABOUT_BUTTON'],
  statistics:['StatsModal.GAMES_PLAYED','StatsModal.TOTAL_WINS','StatsModal.AVG_GUESSES'],
  ranks:['Ranks.CURRENT_RANK','Ranks.SUBTITLE'],
  achievements:['Achievements.UNLOCKED_LABEL'],
  instructions:['Instructions.GOAL_DESCRIPTION','Instructions.TIPS_TITLE'],
  credits:['Credits.SUBTITLE','Credits.THANK_YOU_TITLE'],
  about:['AboutLegal.ACCOUNT_DELETION','AboutLegal.DATA_EXPORT'],
  treasure:['CoinShop.COINS_SUFFIX','Navigation.BUY_COINS_BUTTON'],
  username:['Profile.USERNAME_LABEL','Profile.SAVE_BUTTON'],
  shop:['CoinShop.YOUR_BALANCE','CoinShop.NO_PACKS_AVAILABLE'],
  leaderboard:['Leaderboard.TITLE','Leaderboard.NO_SCORES_YET'],
  hint:['GameScreenAlerts.HINT_NOT_ENOUGH_COINS_MESSAGE','LossModal.OPEN_SHOP_BUTTON'],
  skip:['GameScreenAlerts.SKIP_NOT_ENOUGH_COINS_MESSAGE','LossModal.OPEN_SHOP_BUTTON'],
  continue:['LossModal.OPEN_SHOP_BUTTON','Profile.TOTAL_COINS_LABEL'],
};
const requested=(process.env.RETAINED_MODAL_CASES??Object.keys(keys).map(modal=>modal+'-locale').concat(['profile-blocked','settings-blocked','profile-confirm']).join(',')).split(',');
let browser,server;const cases=[];
try{
  await build({root:scratch,configFile:false,plugins:[react(),babel({presets:[reactCompilerPreset()]})],logLevel:'error',resolve:{alias:{'#shop-modal-page':path.join(root,"src/commerce/components/ShopModalPage.tsx")}},build:{outDir:'dist'}});
  server=createServer(async(req,res)=>{try{const file=path.join(scratch,'dist',new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
  for(const width of [320,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);
    for(const testCase of requested){
      const [modal,mode]=testCase.split('-');await page.evaluate(()=>window.changeModalLocale('en'));
      await page.locator('#trigger').click();await page.evaluate(modal=>window.openTestModal(modal),modal);
      await page.getByRole('dialog').waitFor();await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      if(mode==='locale'){
        if(modal==='username')await page.getByRole('textbox').fill('preserved draft');
        await page.evaluate(()=>window.changeModalLocale('pt'));
        const expected=await page.evaluate(keys=>window.modalCopy(keys),keys[modal]);
        const text=await page.getByRole('dialog').innerText();
        for(const label of expected)assert.ok(text.includes(label),modal+' must update retained label: '+label);
        if(modal==='username')assert.equal(await page.getByRole('textbox').inputValue(),'preserved draft','Locale updates must preserve transient form state');
      }else{
        if(mode==='confirm')await page.getByRole('button',{name:'Delete Account',exact:true}).click();
        await page.evaluate(()=>window.setModalBlocked(true));await page.waitForFunction(()=>document.querySelector('#owned-modal-surface').inert);
        await page.waitForFunction(()=>!document.querySelector('[role="dialog"]')?.contains(document.activeElement));
        await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1,'Blocked modal keyboard listeners must be suspended');
        await page.evaluate(()=>window.setModalBlocked(false));
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const activeDialog=page.getByRole(mode==='confirm'?'alertdialog':'dialog');
        assert.equal(await activeDialog.evaluate(el=>el.contains(document.activeElement)),true,'Unblocking '+modal+' must restore focus inside the surviving dialog');
        await page.keyboard.press('Shift+Tab');assert.equal(await activeDialog.evaluate(el=>el.contains(document.activeElement)),true);
        await page.keyboard.press('Tab');assert.equal(await page.getByRole('button',{name:mode==='confirm'?'Cancel':'Close',exact:true}).evaluate(el=>el===document.activeElement),true);
        if(mode==='confirm'){await page.keyboard.press('Escape');await page.getByRole('alertdialog').waitFor({state:'detached'});assert.equal(await page.getByRole('dialog').count(),1);}
      }
      await page.screenshot({path:path.join(evidence,testCase+'-'+width+'.png')});cases.push({testCase,width,passed:true});
      await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingCompiledSource:true,hostedE2E:false,cases},null,2)+'\n');
      await page.evaluate(()=>window.openTestModal(null));await page.getByRole('dialog').waitFor({state:'detached'});
      console.log('Retained modal passed: '+testCase+' at '+width+'px');
    }await page.close();
  }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
