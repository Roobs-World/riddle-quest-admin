// Supporting injected source check. Hosted Jest verification is recorded separately.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.resolve(process.env.MODAL_CHAIN_FOCUS_EVIDENCE ?? path.join(root, 'artifacts/modal-chain-focus'));
await mkdir(evidence, {recursive: true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/modal-chain-focus-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root,'src/web/play/GameModalView.tsx'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root,'src/hosted/play/gameSession.ts'))};
import ${JSON.stringify(path.join(root,'src/web/styles.css'))};
const noop=()=>{};
function Fixture(){
  const [state,setState]=useState(createInitialGameSession);
  const open=modal=>setState(previous=>({...previous,modal}));
  window.refreshModal=()=>setState(previous=>({...previous,guessPending:!previous.guessPending}));
  window.deliverQuestion=()=>setState(previous=>gameSessionReducer(previous,{type:'loadRiddle',
    riddle:{riddleId:'delayed-question',sessionToken:'delayed-session',text:'A newly issued question',
      answerLength:5,gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false}}));
  return <><main inert={state.modal!==null}>
    <button id="settings-trigger" onClick={()=>open('settings')}>Settings</button>
    <button id="direct-trigger" onClick={()=>open('instructions')}>Direct Help</button>
    <button id="profile-trigger" onClick={()=>open('profile')}>Profile</button>
    <input aria-label="Unsubmitted draft" defaultValue="PE"/>
  </main><GameModalView state={state} onClose={()=>open(null)} onOpenModal={open}
    onContinue={noop} onPurchase={noop} onNext={noop} onToggleMute={noop}
    onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={noop}
    onUpdateUsername={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop}
    onCoinBalancePreview={noop}/></>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`);
let browser, server;
const cases=[];
try {
  await build({root:scratch,configFile:false,logLevel:'error',resolve:{alias:{
    '#shop-modal-page':path.join(root,'src/web/play/modalPages/commerce/ShopModalPage.tsx'),
  }},build:{outDir:'dist'}});
  server=createServer(async(request,response)=>{
    try {
      const pathname=new URL(request.url,'http://localhost').pathname;
      const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
      response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
      response.end(await readFile(file));
    }catch{response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true});
  for(const width of [320,1280]){
    const page=await browser.newPage({viewport:{width,height:844}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    for(const mode of ['escape','button','enter','refresh','direct','credits','about','late-question','profile-late']){
      const direct=mode==='direct',profile=mode==='profile-late';
      const trigger=page.locator(profile?'#profile-trigger':direct?'#direct-trigger':'#settings-trigger');
      await trigger.click();
      if(!direct&&!profile)await page.getByRole('button',{name:mode==='credits'?'Credits ›':mode==='about'?'About ›':'Help ›',exact:true}).click();
      await page.getByRole('dialog').waitFor();
      await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      if(mode==='refresh'){
        await page.evaluate(()=>window.refreshModal());
        await page.waitForFunction(()=>document.activeElement?.matches('.modal-x'));
      }
      if(mode==='late-question'||profile){
        const title=await page.getByRole('dialog').locator('h2').innerText();
        await page.evaluate(()=>window.deliverQuestion());
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
        assert.equal(await page.getByRole('dialog').count(),1,'A late question must preserve the player-owned page');
        assert.equal(await page.getByRole('dialog').locator('h2').innerText(),title);
        assert.equal(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),true);
      }
      if(mode==='button')await page.getByRole('button',{name:'Got It!',exact:true}).click();
      else if(mode==='enter'){
        await page.getByRole('button',{name:'Close',exact:true}).press('Shift+Tab');
        assert.equal(await page.getByRole('button',{name:'Got It!',exact:true}).evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Enter');
      }else await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state:'detached'});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      const restored=await trigger.evaluate(el=>el===document.activeElement);
      await page.screenshot({path:path.join(evidence,mode+'-'+width+'.png')});
      cases.push({mode,width,restored});
      await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingInjectedChecks:true,hostedE2E:false,cases},null,2)+'\n');
      assert.equal(restored,true,'Closing '+mode+' must restore the surviving original gameplay trigger');
      assert.equal(await page.getByRole('textbox',{name:'Unsubmitted draft'}).inputValue(),'PE');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('main')),true);
      console.log('Modal focus chain passed: '+mode+' at '+width+'px.');
    }
    assert.deepEqual(errors,[]);await page.close();
  }
}finally{
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
  await rm(scratch,{recursive:true,force:true});
}
