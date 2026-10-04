import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

// Supporting component regression; real delayed-response evidence is collected on Jest.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.resolve(root, '../../artifacts/solo-guess-ownership');
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
await mkdir(evidence, {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/solo-guess-owner-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions:{jsx:'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameFrameApp} from ${JSON.stringify(path.join(root, 'src/play/GameFrameApp.tsx'))};
import {applyPlayerPreferences,subscribeToPlayerPreferenceChanges} from ${JSON.stringify(path.join(root,'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root,'src/play/guidance/guidanceConfig.ts'))};
import {setLocaleAndWait} from ${JSON.stringify(path.join(root,'src/play/i18n.ts'))};
import {computeFeedback} from ${JSON.stringify(path.resolve(root,'../core/src/game/index.ts'))};
import ${JSON.stringify(path.join(root,'src/styles.css'))};
let initialized=false, locale='en', generation=1, owner='guess-owner', held=[];
const direct=new URL(location.href).searchParams.has('direct');
const profile={username:'Player',coins:570,level:2,xp:150,winStreak:1,gamesPlayed:1,wins:1,achievements:[],classicIndex:1};
applyPlayerPreferences({locale,onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
localStorage.setItem(createGuidanceStorageKey('tooltipSeen:hintAfterWrongGuess',owner),'seen');
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
function riddle(){return {riddleId:'fixture-'+locale,sessionToken:'fixture-session-'+locale+'-'+generation+'-00000000001',
 text:locale==='en'?'English navigation tool':'Outil français de découpe',answerLength:7,gameMode:'classic',index:1,
 attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,...(direct?{}:{evaluation:{answer:locale==='en'?'compass':'ciseaux',locale}})};}
async function initialize(nextLocale=locale,nextGeneration=generation,nextOwner=owner){locale=nextLocale;generation=nextGeneration;owner=nextOwner;
 sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
 localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
 localStorage.setItem(createGuidanceStorageKey('tooltipSeen:hintAfterWrongGuess',owner),'seen');
 await setLocaleAndWait(locale);
 host({type:'host:init',payload:{protocolVersion:1,sessionId:'guess-owner-session',locale,gameMode:'classic',
 user:{uid:owner,isAnonymous:false,accountGeneration:generation},profile,products:[]}});
 host({type:'host:riddleLoaded',payload:{riddle:riddle()}});
}
subscribeToPlayerPreferenceChanges(change=>{if(change.locale)void initialize(change.locale);});
window.addEventListener('riddle-quest:game-to-host',event=>{const message=event.detail;
 if(message.type==='game:ready'&&!initialized){initialized=true;setTimeout(()=>void initialize(),50);}
 if(message.type==='game:submitGuess')held.push(message);
});
window.guessFixture={replace:initialize,held:()=>held.length,release:(ok=true)=>{const message=held[0];if(!message)throw Error('No held guess');
 const feedback=computeFeedback(message.payload.guess,'compass');
 host({type:'host:operationResult',requestId:message.requestId,payload:{operation:'guess',ok,
 ...(ok?{data:{attempts:1,isCorrect:false,gameOver:false,canContinue:false,feedback:[...message.payload.guess].map((letter,index)=>({letter,status:feedback[index]}))}}:
 {error:'Old-owner rejection',errorKind:'rejected'})}});}};
createRoot(document.getElementById('root')).render(<GameFrameApp localBridge/>);
`);
let browser,server;
try {
 await build({root:scratch,configFile:false,logLevel:'error',build:{outDir:'dist'}});
 server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.join(scratch,'dist',pathname==='/'?'index.html':pathname);
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
 res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true});
 const origin='http://127.0.0.1:'+server.address().port;
 for(const direct of [false,true])for(const replacement of ['locale','generation','account','none'])for(const ok of [true,false]){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+(direct?'/?direct=1':''));
  await page.getByRole('heading',{name:'English navigation tool',exact:true}).waitFor();
  for(const letter of 'CAAAAAA')await page.locator('.keyboard').getByRole('button',{name:letter,exact:true}).click();
  await page.locator('.submit-action').click();
  await page.waitForFunction(()=>window.guessFixture.held()>0);
  if(replacement==='locale'){
   await page.getByRole('button',{name:'Settings',exact:true}).click();
   await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('fr');
   await page.getByRole('heading',{name:'Outil français de découpe',exact:true}).waitFor();
  }else if(replacement!=='none'){
   await page.evaluate(replacement=>window.guessFixture.replace('en',replacement==='generation'?2:1,replacement==='account'?'other-owner':'guess-owner'),replacement);
   await page.waitForFunction(()=>document.querySelector('.guess-row')?.textContent==='');
  }
  if(replacement!=='none'){
   for(const letter of 'CI')await page.locator('.keyboard').getByRole('button',{name:letter,exact:true}).click();
   await expectRow(page,0,'CI');
  }
  await page.evaluate(ok=>window.guessFixture.release(ok),ok);
  // Allow the real bridge listener and reducer to finish applying (or rejecting) the response.
  await page.waitForTimeout(75);
  if(replacement!=='none'){
   await expectRow(page,0,'CI');
   assert.equal(await page.locator('.guess-row').nth(1).innerText(),'');
   assert.equal(await page.getByText('Old-owner rejection',{exact:true}).count(),0);
  }else if(ok){
   await expectRow(page,0,'CAAAAAA');
   await page.evaluate(()=>window.guessFixture.release(true));
   await page.waitForTimeout(75);
   assert.equal(await page.locator('.guess-row').nth(1).innerText(),'','Duplicate success must not consume another row');
  }else{
   await page.locator('.game-notice').waitFor();
   assert.ok((await page.locator('.game-notice').innerText()).length>0);
  }
  assert.deepEqual(errors,[]);
  if(replacement==='locale'&&ok&&!direct)await page.screenshot({path:path.join(evidence,'late-english-result-french-draft.png')});
  console.log(JSON.stringify({direct,replacement,ok,passed:true}));
  await page.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
async function expectRow(page,index,text){assert.equal((await page.locator('.guess-row').nth(index).innerText()).replaceAll(/\s/g,''),text);}
