import {waitForAnswerInputReady} from "./helpers/answer-readiness.mjs";
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,firefox} from '@playwright/test';

// Supporting regression: real keyboard events through the whole solo game.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.resolve(process.env.HINT_INTENT_REPORT_DIR??path.join(root,'builds/test-evidence/solo-hint-intent-recovery-2026-10-08/permanent',process.env.HINT_INTENT_REACT_MODE??'development'));
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
await mkdir(evidence, {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/solo-keyboard-input-'));
await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
await writeFile(path.join(scratch, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameFrameApp} from ${JSON.stringify(path.join(root, 'src/web/play/GameFrameApp.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, 'src/web/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root, 'src/web/play/guidance/guidanceConfig.ts'))};
import {setLocaleAndWait} from ${JSON.stringify(path.join(root, 'src/web/play/i18n.ts'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.css'))};
const owner='keyboard-owner'; let initialized=false;window.sentGuesses=[];window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type==='game:submitGuess')window.sentGuesses.push(event.detail);});
applyPlayerPreferences({locale:'en',onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
window.saves=[];window.hintRequests=[];window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type==='game:requestHint'){window.hintRequests.push(event.detail);window.failHint=()=>{host({type:'host:operationResult',requestId:event.detail.requestId,payload:{operation:'hint',ok:false,errorKind:'rejected',error:'ErrorMessages.GENERIC_UNEXPECTED_ERROR'}});window.hintFailed=true;};window.hintPending=true;return;}if(event.detail.type!=='game:ready'||initialized)return;
 initialized=true;setTimeout(async()=>{await setLocaleAndWait('en');
 host({type:'host:init',payload:{protocolVersion:1,sessionId:'keyboard-fixture',locale:'en',gameMode:'classic',
 user:{uid:owner,isAnonymous:false,accountGeneration:1},profile:{username:'Player',coins:570,level:2,xp:150,
 winStreak:1,gamesPlayed:1,wins:1,achievements:[],classicIndex:1},products:[]}});
 host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'keyboard-riddle',sessionToken:'keyboard-session-0000000000001',
 text:'What has keys but cannot open doors?',answerLength:5,gameMode:'classic',index:1,
 attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'piano',locale:'en'}}}});
 },50);
});
createRoot(document.getElementById('root')).render(<GameFrameApp localBridge onSaveGame={game=>window.saves.push(game)}/>);
`);
let browser, server;const observations=[];
try {
   await build({root:scratch,configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify(process.env.HINT_INTENT_REACT_MODE??'development')},build:{outDir:'dist'}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await (process.env.HINT_INTENT_ENGINE==='firefox'?firefox:chromium).launch({headless:true,...(process.env.HINT_INTENT_ENGINE==='firefox'&&process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH}:{})});
  for(const width of [390,1280])for(const method of ['physical','virtual'])for(const recovery of ['reject','save','emptied']){
    const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.getByRole('heading',{name:'What has keys but cannot open doors?',exact:true}).waitFor();
    const type=async text=>{await page.evaluate(()=>document.activeElement?.blur());if(method==='physical')await page.keyboard.type(text);else for(const letter of text)await page.locator('.keyboard button').filter({hasText:new RegExp('^'+letter.toUpperCase()+'$')}).click();};
    if(method==='physical')await waitForAnswerInputReady(page);
    await type('c');if(recovery==='emptied')await page.locator('.guess-row').first().locator('.cell').nth(3).click();await page.locator('.game-input-actions button[data-tooltip=gameHint]').first().click();await page.locator('.modal-hint .play-primary').click();
    await page.waitForFunction(()=>window.hintPending&&document.querySelector('.guess-row')?.textContent==='P');await type('an');
    await page.waitForFunction(()=>document.querySelector('.guess-row')?.textContent==='PAN');
    await page.waitForFunction(()=>window.saves.some(game=>game?.currentLetters.join('')==='CAN'));
    if(recovery==='emptied'){await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelector('.guess-row')?.textContent==='P');}
    if(recovery==='save')assert.equal(await page.evaluate(()=>window.saves.findLast(game=>game?.currentLetters.join('')==='CAN').activeSlotIndex),3);
    await page.evaluate(recovery=>{window.expectedDraft=recovery==='emptied'?'C':'CAN';window.failHint();},recovery);await page.waitForFunction(()=>document.querySelector('.guess-row')?.textContent===(window.expectedDraft??'CAN'));
    const slot=await page.locator('.guess-row').first().locator('.cell[aria-current="true"]').evaluate(el=>[...el.parentNode.children].indexOf(el));assert.equal(slot,recovery==='emptied'?1:3);
    await type(recovery==='emptied'?'anon':'on');await page.waitForFunction(()=>document.querySelector('.guess-row')?.textContent==='CANON');
    await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');await page.waitForFunction(()=>window.sentGuesses.length===1);
    const guess=await page.evaluate(()=>window.sentGuesses[0].payload.guess);assert.equal(guess.toLowerCase(),'canon');assert.equal(await page.evaluate(()=>window.hintRequests.length),1);assert.deepEqual(errors,[]);
    observations.push({width,method,recovery,slot,draft:'CANON',guess,browserErrors:errors});await page.close();
  }

} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(evidence,'observations.json'),JSON.stringify(observations,null,2)+'\n');
}
