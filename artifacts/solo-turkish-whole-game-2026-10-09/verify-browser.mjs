import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '/home/craig-beswetherick/Documents/riddle-quest/node_modules/.pnpm/vite@8.3.1_@types+node@26.6.3_@vitejs+devtools@0.7.6_yaml@2.9.1/node_modules/vite/dist/node/index.js';
import {chromium,firefox} from '/home/craig-beswetherick/Documents/riddle-quest/node_modules/.pnpm/@playwright+test@1.63.0/node_modules/@playwright/test/index.mjs';

// Supporting regression: real keyboard events through the whole solo game.
const root = '/home/craig-beswetherick/Documents/riddle-quest/packages/portal';
const evidence = path.resolve(process.env.TURKISH_KEYS_REPORT_DIR??path.join(root,'../../artifacts/turkish-virtual-dotless-key-2026-10-08/permanent',process.env.TURKISH_KEYS_REACT_MODE??'development'));
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
await mkdir(evidence, {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/solo-keyboard-input-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import {GameSubmitGuessMessageSchema} from '@qwordly/core/bridge';import {SubmitSinglePlayerGuessRequestDataSchema} from '@qwordly/core/validation/requestSchemas';import {SubmitSinglePlayerGuessInputSchema} from '@qwordly/core/validation/cloudFunctionsSchemas';
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameFrameApp} from ${JSON.stringify(path.join(root, 'src/play/GameFrameApp.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, 'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root, 'src/play/guidance/guidanceConfig.ts'))};
import {setLocaleAndWait} from ${JSON.stringify(path.join(root, 'src/play/i18n.ts'))};
import ${JSON.stringify(path.join(root, 'src/styles.css'))};
const owner='keyboard-owner'; let initialized=false;window.sentGuesses=[];window.requestChecks=[];window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type==='game:submitGuess'){window.sentGuesses.push(event.detail);window.requestChecks.push({bridge:GameSubmitGuessMessageSchema.safeParse(event.detail).success,callable:SubmitSinglePlayerGuessRequestDataSchema.safeParse(event.detail.payload).success,alternateCallable:SubmitSinglePlayerGuessInputSchema.safeParse(event.detail.payload).success});}});
applyPlayerPreferences({locale:'tr',onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type==='game:requestHint'){setTimeout(()=>{host({type:'host:operationResult',requestId:event.detail.requestId,payload:{operation:'hint',ok:true,data:{index:0,revealedLetter:'İ',newCoins:545}}});window.hintConfirmed=true;},100);return;}if(event.detail.type!=='game:ready'||initialized)return;
 initialized=true;setTimeout(async()=>{await setLocaleAndWait('tr');
 host({type:'host:init',payload:{protocolVersion:1,sessionId:'keyboard-fixture',locale:'tr',gameMode:'classic',
 user:{uid:owner,isAnonymous:false,accountGeneration:1},profile:{username:'Player',coins:570,level:2,xp:150,
 winStreak:1,gamesPlayed:1,wins:1,achievements:[],classicIndex:1},products:[]}});
 host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'keyboard-riddle',sessionToken:'keyboard-session-0000000000001',
 text:'Which city is on the Turkish Aegean coast?',answerLength:5,gameMode:'classic',index:1,
 attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,...(new URL(location.href).searchParams.get('hint')==='true'?{revealedHints:[{index:0,letter:'İ'}]}:{}),evaluation:{answer:new URL(location.href).searchParams.get('answer')??'izmir',locale:'tr'}}}});
 },50);
});
createRoot(document.getElementById('root')).render(<GameFrameApp localBridge/>);
`);
let browser, server;const observations=[];
try {
   await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(process.env.TURKISH_KEYS_REACT_MODE??'development')},build:{outDir:'dist'}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await (process.env.TURKISH_KEYS_ENGINE==='firefox'?firefox:chromium).launch({headless:true,...(process.env.TURKISH_KEYS_ENGINE==='firefox'&&process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH}:{})});
  for(const width of [320,390,1280])for(const method of ['virtual','physical'])for(const hint of [false])for(const answer of ['izmir','IRMAK']){
    const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?hint='+hint+'&answer='+answer);await page.getByRole('heading',{name:'Which city is on the Turkish Aegean coast?',exact:true}).waitFor();await page.evaluate(()=>document.activeElement?.blur());
    assert.equal(await page.locator('.keyboard button').filter({hasText:/^I$/}).count(),1);assert.equal(await page.locator('.keyboard button').filter({hasText:/^İ$/}).count(),1);const text=answer.toLocaleUpperCase('tr');if(method==='physical')await page.keyboard.type(answer);else if(method==='shifted-physical')await page.evaluate(text=>{for(const key of text.toLocaleUpperCase('tr'))window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));},text);else for(const letter of text)await page.locator('.keyboard button').filter({hasText:new RegExp('^'+letter.toLocaleUpperCase('tr')+'$')}).click();
    const draft=await page.locator('.guess-row').first().textContent();assert.equal(draft.replaceAll(/\s/g,''),answer.toLocaleUpperCase('tr'));
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');await page.waitForFunction(()=>window.sentGuesses.length===1);await page.waitForFunction(()=>document.querySelector('.guess-row')?.querySelectorAll('.green').length===5);
    const requestChecks=await page.evaluate(()=>window.requestChecks);assert.deepEqual(requestChecks,[{bridge:true,callable:true,alternateCallable:true}]);const guess=await page.evaluate(()=>window.sentGuesses[0].payload.guess);assert.equal(guess.toLocaleLowerCase('tr'),answer.toLocaleLowerCase('tr'));
    assert.equal(await page.locator('.keyboard button').filter({hasText:answer==='IRMAK'?/^I$/:/^İ$/}).getAttribute('class'),'key green');assert.equal(await page.locator('.keyboard button').filter({hasText:answer==='IRMAK'?/^İ$/:/^I$/}).getAttribute('class'),'key');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
    observations.push({width,method,hint,answer,draft:draft.replaceAll(/\s/g,''),guess,greenLetters:5,requestChecks,browserErrors:errors});await page.close();
  }

} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
