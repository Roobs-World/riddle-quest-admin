import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,firefox} from '@playwright/test';

// Supporting regression: real keyboard events through the whole solo game.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.resolve(process.env.TURKISH_INPUT_REPORT_DIR??path.join(root,'../../builds/test-evidence/turkish-answer-input-2026-10-08/permanent',process.env.TURKISH_INPUT_REACT_MODE??'development'));
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
await mkdir(evidence, {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/solo-keyboard-input-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameFrameApp} from ${JSON.stringify(path.join(root, 'src/play/GameFrameApp.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, 'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root, 'src/play/guidance/guidanceConfig.ts'))};
import {setLocaleAndWait} from ${JSON.stringify(path.join(root, 'src/play/i18n.ts'))};
import ${JSON.stringify(path.join(root, 'src/styles.css'))};
const owner='keyboard-owner'; let initialized=false;window.sentGuesses=[];window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type==='game:submitGuess')window.sentGuesses.push(event.detail);});
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
 attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,...(new URL(location.href).searchParams.get('hint')==='true'?{revealedHints:[{index:0,letter:'İ'}]}:{}),evaluation:{answer:'izmir',locale:'tr'}}}});
 },50);
});
createRoot(document.getElementById('root')).render(<GameFrameApp localBridge/>);
`);
let browser, server;const observations=[];
try {
   await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(process.env.TURKISH_INPUT_REACT_MODE??'development')},build:{outDir:'dist'}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await (process.env.TURKISH_INPUT_ENGINE==='firefox'?firefox:chromium).launch({headless:true,...(process.env.TURKISH_INPUT_ENGINE==='firefox'&&process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH}:{})});
  for(const width of [390,1280])for(const method of ['physical','virtual','shifted-physical'])for(const hint of [false,true,'paid']){
    const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?hint='+hint);await page.getByRole('heading',{name:'Which city is on the Turkish Aegean coast?',exact:true}).waitFor();await page.evaluate(()=>document.activeElement?.blur());
    if(hint==='paid'){await page.locator('.game-input-actions button[data-tooltip=gameHint]').first().click();await page.locator('.modal-hint .play-primary').click();await page.waitForFunction(()=>window.hintConfirmed);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const cls=await page.locator('.keyboard button').filter({hasText:/^İ$/}).getAttribute('class');assert.equal(cls,'key green');}if(hint===true)assert.equal(await page.locator('.keyboard button').filter({hasText:/^İ$/}).getAttribute('class'),'key green');const text=hint?'zmir':'izmir';if(method==='physical')await page.keyboard.type(text);else if(method==='shifted-physical')await page.evaluate(text=>{for(const key of text.toLocaleUpperCase('tr'))window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));},text);else for(const letter of text)await page.locator('.keyboard button').filter({hasText:new RegExp('^'+letter.toLocaleUpperCase('tr')+'$')}).click();
    const draft=await page.locator('.guess-row').first().textContent();assert.equal(draft.replaceAll(/\s/g,''),'İZMİR');
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');await page.waitForFunction(()=>window.sentGuesses.length===1);await page.waitForFunction(()=>document.querySelector('.guess-row')?.querySelectorAll('.green').length===5);
    const guess=await page.evaluate(()=>window.sentGuesses[0].payload.guess);assert.equal(guess.toLocaleLowerCase('tr'),'izmir');
    assert.equal(await page.locator('.keyboard button').filter({hasText:/^İ$/}).getAttribute('class'),'key green');assert.deepEqual(errors,[]);
    observations.push({width,method,hint,draft:draft.replaceAll(/\s/g,''),guess,greenLetters:5,browserErrors:errors});await page.close();
  }

} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
