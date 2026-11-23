// Supporting compiled caller checks; actual Jest transport failures are verified separately.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react,{reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import {chromium} from '@playwright/test';

const root=fileURLToPath(new URL("../../../../packages/web-game/", import.meta.url));
const evidence=path.resolve(process.env.JEST_STARTUP_COPY_EVIDENCE??path.join(root,'../../artifacts/jest-startup-copy'));
await mkdir(evidence,{recursive:true});await mkdir(path.join(root,'node_modules/.cache'),{recursive:true});
const scratch=await mkdtemp(path.join(root,'node_modules/.cache/startup-copy-'));
await writeFile(path.join(scratch,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch,'main.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';
import {JestPlayApp} from ${JSON.stringify(path.join(root,'../../platforms/web/jest/src/JestPlayApp.tsx'))};
import {setLocaleAndWait,tr} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.JestSDK={init:async()=>{throw new Error('Jest SDK internal request conversation-test-private failed');},markGameLoaded:()=>{},setLoadingProgress:()=>{}};
await setLocaleAndWait(new URLSearchParams(location.search).get('locale')??'en');
window.startupCopy=key=>tr(key);
createRoot(document.getElementById('root')).render(<JestPlayApp/>);
`);
let browser,server;const cases=[];
try{
 await build({root:scratch,configFile:false,plugins:[react(),babel({presets:[reactCompilerPreset()]})],logLevel:'error',resolve:{alias:{'#shop-modal-page':path.join(root,'src/play/modalPages/commerce/ShopModalPage.tsx')}},build:{outDir:'dist',target:'esnext'}});
 const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm','.json':'application/json','.html':'text/html'};
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const width of [320,1280])for(const locale of ['en','es','pt','fr','de','ja','ko','hi','ru','tr','ar','id','it','nl','pl','vi']){
  const page=await browser.newPage({viewport:{width,height:844}});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?harness=jest-auth&locale='+locale);
  await page.getByRole('alert').waitFor();
  const expected=await page.evaluate(()=>({title:window.startupCopy('ErrorMessages.FATAL_STARTUP_TITLE'),body:window.startupCopy('ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE'),retry:window.startupCopy('CommonButtons.RETRY')}));
  assert.equal(await page.getByRole('alert').locator('p').innerText(),expected.body);
  assert.equal(await page.getByRole('heading').innerText(),expected.title);
  assert.equal((await page.locator('body').innerText()).includes('conversation-test-private'),false,'Provider request details must not reach the startup UI');
  const retry=page.getByRole('button',{name:expected.retry,exact:true});assert.equal(await retry.isEnabled(),true);
  await retry.focus();assert.equal(await retry.evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(pageErrors,[]);
  cases.push({locale,width,title:expected.title,message:expected.body,retryEnabledAndFocused:true});
  await page.screenshot({path:path.join(evidence,locale+'-'+width+'.png')});await page.close();
  await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingCompiledCaller:true,hostedE2E:false,cases},null,2)+'\n');
  console.log('Startup failure copy passed: '+locale+' at '+width+'px');
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
