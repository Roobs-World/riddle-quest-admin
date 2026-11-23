// Supporting compiled host/UI checks. Actual Jest response-fault verification is separate.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.resolve(process.env.HOST_TIMEOUT_EVIDENCE??path.join(root,'../../artifacts/host-timeout-copy'));
await mkdir(evidence,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/host-timeout-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root,'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root,'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root,'src/play/fakeServices.ts'))};
import {setLocaleAndWait,tr} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
const services=createFakeHostServices();const originalLoad=services.loadRiddle;let failing=true;
services.loadRiddle=async input=>{if(failing)throw Object.assign(new Error('deadline-exceeded'),{code:'functions/deadline-exceeded'});return originalLoad(input);};
const session=createHostedPlaySession({hostServices:services,initialGameMode:'classic',raceAvailable:false});
window.timeoutTestLocale=setLocaleAndWait;window.timeoutTestCopy=key=>tr(key);window.timeoutTestRecover=()=>{failing=false;};
createRoot(document.getElementById('root')).render(<PlayHostApp session={session}/>);
`);
let browser,server;const cases=[];
try{
 await build({root:scratch,configFile:false,plugins:[react(),babel({presets:[reactCompilerPreset()]})],logLevel:'error',resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},build:{outDir:'dist'}});
 const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.json':'application/json','.html':'text/html'};
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const width of [320,1280]){
  const page=await browser.newPage({viewport:{width,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);
  for(const locale of ['en','es','pt','fr','de','ja','ko','hi','ru','tr','ar','id','it','nl','pl','vi']){
   await page.evaluate(locale=>window.timeoutTestLocale(locale),locale);
   const expected=await page.evaluate(()=>window.timeoutTestCopy('ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE'));
   await page.waitForFunction(expected=>document.querySelector('.game-loading [role=status]')?.textContent===expected,expected);
   assert.equal((await page.locator('body').innerText()).includes('deadline-exceeded'),false,'SDK codes must not be rendered');
   const settings=await page.evaluate(()=>window.timeoutTestCopy('Navigation.SETTINGS_BUTTON'));
   await page.getByRole('button',{name:settings,exact:true}).click();await page.getByRole('dialog').waitFor();
   await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));
   await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
   assert.equal(await page.getByRole('button',{name:settings,exact:true}).evaluate(el=>el===document.activeElement),true,'Recovery Settings must restore its trigger');
   cases.push({locale,width,notice:expected,settingsOpenedAndClosed:true});
   await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingCompiledHost:true,hostedE2E:false,cases},null,2)+'\n');
   await page.screenshot({path:path.join(evidence,locale+'-'+width+'.png')});
   console.log('Translated timeout and Settings passed: '+locale+' at '+width+'px');
  }
  await page.evaluate(()=>window.timeoutTestLocale('en'));await page.evaluate(()=>window.timeoutTestRecover());
  try {await page.locator('.riddle-surface').waitFor();} catch(error) {
   await writeFile(path.join(evidence,'recovery-failure-'+width+'.txt'),await page.locator('body').innerText());
   await page.screenshot({path:path.join(evidence,'recovery-failure-'+width+'.png')});throw error;
  }
  assert.ok((await page.locator('.riddle-surface').innerText()).includes('What has keys but cannot open doors?'),'Recovery must deliver the actual authority fixture question');
  assert.equal(await page.locator('.game-loading [role=status]').count(),0,'Successful automatic recovery must remove the failure');
  await page.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
