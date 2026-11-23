// Supporting compiled-source regression. Hosted Jest network checks remain separate.
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import react, {reactCompilerPreset} from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.resolve(process.env.LEADERBOARD_REQUEST_EVIDENCE ?? path.join(root, 'artifacts/leaderboard-requests'));
await mkdir(evidence, {recursive: true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/leaderboard-requests-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React,{useCallback,useReducer,useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
import {GameModalView} from ${JSON.stringify(path.join(root, 'src/web/play/GameModalView.tsx'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(root, 'src/hosted/play/gameSession.ts'))};
import {useGameOperations} from ${JSON.stringify(path.join(root, 'src/web/play/game/hooks/useGameOperations.ts'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.css'))};
const noop=()=>{};
function Fixture(){
 const [state,dispatch]=useReducer(gameSessionReducer,undefined,createInitialGameSession);
 const [revision,setRevision]=useState(0);const stateRef=useRef(state);stateRef.current=state;
 const requests=useRef([]);
 const postToHost=useCallback(message=>{if(message.type==='game:loadLeaderboard')requests.current.push(message);},[revision]);
 const operations=useGameOperations({state,stateRef,dispatch,postToHost,playFeedback:noop});
 window.requestTest={read:()=>requests.current,open:modal=>dispatch({type:'openModal',modal}),
  changeCallback:()=>setRevision(value=>value+1),
  settle:(index,failed=false)=>{const message=requests.current[index];dispatch(failed?
   {type:'leaderboardLoadFailed',requestId:message.requestId}:
   {type:'leaderboardLoaded',requestId:message.requestId,leaderboardType:message.payload.leaderboardType,entries:[]});}};
 return <><main inert={state.modal!==null}><button id="trigger" onClick={()=>dispatch({type:'openModal',modal:'profile'})}>Profile</button></main>
 <GameModalView state={state} onClose={()=>dispatch({type:'closeModal'})} onOpenModal={modal=>dispatch({type:'openModal',modal})}
  onContinue={noop} onPurchase={operations.requestPurchase} onNext={noop} onToggleMute={noop}
  onRequestHint={noop} onRequestSkip={noop} onRequestLeaderboard={operations.requestLeaderboard}
  onUpdateUsername={noop} onUpdateAvatar={async()=>{}} onDeleteAccount={noop} onCoinBalancePreview={noop}/></>;
}createRoot(document.getElementById('root')).render(<Fixture/>);
`);
let browser, server;
const cases = [];
try {
 await build({root:scratch,configFile:false,plugins:[react(),babel({presets:[reactCompilerPreset()]})],logLevel:'error',resolve:{alias:{'#shop-modal-page':path.join(root,'src/web/play/modalPages/commerce/ShopModalPage.tsx')}},build:{outDir:'dist'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true});
 for(const width of [320,1280]){
  const page=await browser.newPage({viewport:{width,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);
  const read=()=>page.evaluate(()=>window.requestTest.read());
  const checkpoint=async(name,expected)=>{
   // Two frames allow effects and the compiled parent to commit before counting commands.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const requests=await read();cases.push({name,width,expected,actual:requests.length,types:requests.map(r=>r.payload.leaderboardType)});
   await writeFile(path.join(evidence,'results.json'),JSON.stringify({supportingCompiledSource:true,hostedE2E:false,cases},null,2)+'\n');
   await page.screenshot({path:path.join(evidence,name+'-'+width+'.png')});
   assert.equal(requests.length,expected,name+' must issue exactly one bridge request per user action');
   console.log(name+' at '+width+'px: '+requests.length+' requests');
  };
  const settle=async(failed=false)=>{const requests=await read();await page.evaluate(({index,failed})=>window.requestTest.settle(index,failed),{index:requests.length-1,failed});await page.locator('.leaderboard-loading').waitFor({state:'hidden'});};
  await page.locator('#trigger').click();await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await checkpoint('initial-open',1);await settle();
  await page.locator('.leaderboard-tabs button').nth(1).click();await checkpoint('changed-metric',2);
  assert.equal(await page.locator('.leaderboard-tabs button:disabled').count(),4,'Pending tabs must prevent repeated requests');
  await settle();
  await page.locator('.leaderboard-tabs button').nth(1).click();await checkpoint('same-metric-refresh',3);await settle(true);
  await page.getByRole('button',{name:'Retry',exact:true}).click();await checkpoint('retry',4);await settle();
  await page.evaluate(()=>window.requestTest.changeCallback());await checkpoint('callback-change',4);
  await page.locator('.leaderboard-tabs button').nth(2).click();await checkpoint('streak',5);await settle();
  await page.locator('.leaderboard-tabs button').nth(3).click();await checkpoint('multiplayer',6);
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  await page.locator('#trigger').click();await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
  await checkpoint('close-and-reopen-pending',7);
  await page.evaluate(()=>window.requestTest.settle(5,true));
  assert.equal(await page.locator('.leaderboard-loading').count(),1,'Older failure must not finish the new read');await settle();
  await page.evaluate(()=>window.requestTest.open('statistics'));await page.getByRole('heading',{name:'Statistics',exact:true}).waitFor();
  await page.evaluate(()=>window.requestTest.open('leaderboard'));await checkpoint('child-page-reentry',8);await settle();
  await page.locator('.leaderboard-tabs button').nth(0).click();await checkpoint('xp',9);await settle();
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('#trigger').evaluate(el=>el===document.activeElement),true,'Closing must return focus to the original trigger');
  await page.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
