import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

// Supporting regression: real keyboard events through the whole solo game.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.resolve(root, '../../artifacts/solo-keyboard-input');
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
const owner='keyboard-owner'; let initialized=false;
applyPlayerPreferences({locale:'en',onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type!=='game:ready'||initialized)return;
 initialized=true;setTimeout(async()=>{await setLocaleAndWait('en');
 host({type:'host:init',payload:{protocolVersion:1,sessionId:'keyboard-fixture',locale:'en',gameMode:'classic',
 user:{uid:owner,isAnonymous:false,accountGeneration:1},profile:{username:'Player',coins:570,level:2,xp:150,
 winStreak:1,gamesPlayed:1,wins:1,achievements:[],classicIndex:1},products:[]}});
 host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'keyboard-riddle',sessionToken:'keyboard-session-0000000000001',
 text:'What has a wick surrounded by wax?',answerLength:6,gameMode:'classic',index:1,
 attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'candle',locale:'en'}}}});
 },50);
});
createRoot(document.getElementById('root')).render(<GameFrameApp localBridge/>);
`);
let browser, server;
try {
  await build({root: scratch, configFile: false, logLevel: 'error', build: {outDir: 'dist'}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless: true});
  for (const width of [390, 1280]) for (const mode of ['body', 'slot']) {
    const page = await browser.newPage({viewport: {width, height: 844}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('heading', {name: 'What has a wick surrounded by wax?', exact: true}).waitFor();
    if (mode === 'slot') await page.getByRole('button', {name: 'Letter 1', exact: true}).filter({visible: true}).first().click();
    else await page.getByRole('heading', {name: 'What has a wick surrounded by wax?', exact: true}).click();
    await page.keyboard.type('CANDLE', {delay: 0});
    await page.waitForFunction(() => document.querySelector('.guess-row')?.textContent?.replaceAll(/\s/g, '') === 'CANDLE', null, {timeout: 2000});
    assert.equal((await page.locator('.guess-row').first().innerText()).replaceAll(/\s/g, ''), 'CANDLE', 'Rapid keyboard input must retain every character');
    assert.equal(await page.getByRole('button', {name: 'SUBMIT', exact: true}).isEnabled(), true);
    assert.deepEqual(errors, []);
    await page.screenshot({path: path.join(evidence, `${mode}-${width}.png`)});
    console.log(JSON.stringify({width, mode, input: 'CANDLE', passed: true}));
    await page.close();
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
