import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('/home/craig-beswetherick/Documents/riddle-quest/packages/portal/package.json');
const {build}=await import(require.resolve('vite'));
const {chromium}=require('@playwright/test');

// Supporting regression: real keyboard events through the whole solo game.
const root = '/home/craig-beswetherick/Documents/riddle-quest/packages/portal';
const evidence = path.resolve(root, '../../artifacts/turkish-answer-input-2026-10-08',process.env.TURKISH_INPUT_CANDIDATE==='1'?'candidate':'baseline');
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
applyPlayerPreferences({locale:'tr',onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type!=='game:ready'||initialized)return;
 initialized=true;setTimeout(async()=>{await setLocaleAndWait('tr');
 host({type:'host:init',payload:{protocolVersion:1,sessionId:'keyboard-fixture',locale:'tr',gameMode:'classic',
 user:{uid:owner,isAnonymous:false,accountGeneration:1},profile:{username:'Player',coins:570,level:2,xp:150,
 winStreak:1,gamesPlayed:1,wins:1,achievements:[],classicIndex:1},products:[]}});
 host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'keyboard-riddle',sessionToken:'keyboard-session-0000000000001',
 text:'Which city is on the Turkish Aegean coast?',answerLength:5,gameMode:'classic',index:1,
 attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'izmir',locale:'tr'}}}});
 },50);
});
createRoot(document.getElementById('root')).render(<GameFrameApp localBridge/>);
`);
let browser, server;
try {
  await build({root: scratch, configFile: false, logLevel: 'error',plugins:process.env.TURKISH_INPUT_CANDIDATE==='1'?[{name:'turkish-input-candidate',enforce:'pre',async load(id){if(!id.endsWith('/play/gameSession.ts'))return;let source=await readFile(id,'utf8');return source.replace('const normalizeInputLetter = (letter: string): string | null => {','const normalizeInputLetter = (letter: string, locale: string): string | null => {').replace('graphemes[0]?.toUpperCase()','graphemes[0]?.toLowerCase().toLocaleUpperCase(locale)').replace('normalizeInputLetter(action.letter)','normalizeInputLetter(action.letter, state.riddle?.evaluation?.locale ?? state.locale)');}}]:[], build: {outDir: 'dist'}});
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
  const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'Which city is on the Turkish Aegean coast?',exact:true}).waitFor();await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.type('izmir');await page.waitForFunction(()=>document.querySelector('.guess-row')?.textContent?.replaceAll(/\s/g,'')?.length===5);await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.guess-row .green,.guess-row .red,.guess-row .yellow').length===5);const actual=await page.locator('.guess-row').first().locator('button').evaluateAll(els=>els.map(el=>el.className));await writeFile(path.join(evidence,'observations.json'),JSON.stringify({typed:'izmir',answer:'izmir',contentLocale:'tr',actual,expected:'five green letters'},null,2)+'\n');console.log(JSON.stringify(actual));assert(actual.every(c=>c.includes('green')),'Typing a valid Turkish ASCII answer must solve the question');

} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
