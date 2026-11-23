import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.env.KEYBOARD_ISOLATION_REPORT_DIR ?? path.join(root, 'artifacts/keyboard-targets-20261020/isolation/controls'));
await mkdir(output, {recursive: true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/keyboard-isolation-'));
const observations = [];
let browser, server;
try {
  await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
  await writeFile(path.join(scratch, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(root, 'src/web/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(root, 'src/web/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(root, 'src/web/play/fakeServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, 'src/web/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(root, 'src/web/play/guidance/guidanceConfig.ts'))};
import {RaceGameplay} from ${JSON.stringify(path.join(root, 'src/web/play/race/components/RaceGameplay.tsx'))};
import {useRaceGameplayFit} from ${JSON.stringify(path.join(root, 'src/web/play/race/hooks/useRaceGameplayFit.ts'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.race-lobby.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.race-gameplay.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;
window.probe={saves:[],guesses:[],completions:[],spends:[],actions:[],errors:[],unhandled:[],hold:false};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession','jest-guest'),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,'jest-guest'),'seen');for(const id of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+id,'jest-guest'),'seen');
const base=createFakeHostServices(),services={...base,submitGuess:async input=>{window.probe.guesses.push(input);if(window.probe.hold)await new Promise(resolve=>window.releaseGuess=resolve);return base.submitGuess(input);},completeGame:async input=>{window.probe.completions.push(input);return base.completeGame(input);},spendCoins:async input=>{window.probe.spends.push(input);return base.spendCoins(input);}};
const session=createHostedPlaySession({hostServices:services,economyAvailable:true,raceAvailable:false,onPlayerDataChange:update=>window.probe.saves.push(update)});
window.draft=()=>Array.from(document.querySelector('.guess-row')?.querySelectorAll('.cell')??[]).map(x=>x.textContent.trim()).join('');
function RaceFixture(){const screenRef=React.useRef(null),viewportRef=React.useRef(null),gameplayRef=React.useRef(null),[pending,setPending]=React.useState(false),[projected,setProjected]=React.useState(false),[letters,setLetters]=React.useState(['P','I','A','N','O']);window.setPending=(value,allow=false)=>{setPending(value);setProjected(allow);};window.raceDraft=()=>letters.join('');
useRaceGameplayFit({active:true,screenRef,viewportRef,gameplayRef});
const run={runId:'keyboard-isolation-race',role:'creator',status:'active',rules:{targetCorrect:10,hintPenaltyMs:30000,skipPenaltyMs:30000},serverNowMs:Date.now(),startsAtMs:Date.now(),locale:'en',correctCount:0,totalPenaltyMs:0,wallElapsedMs:0,adjustedElapsedMs:0,events:[],opponent:{displayName:'Opponent',events:[],adjustedFinishMs:0},currentRiddle:{riddleId:'isolation-riddle',text:'What has keys but cannot open doors?',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]}};
const action=kind=>window.probe.actions.push(kind);return <section ref={screenRef} className='race-screen race-screen-gameplay' role='dialog' aria-label='Keyboard isolation race'><RaceGameplay live viewportRef={viewportRef} gameplayRef={gameplayRef} run={run} adjustedNow={0} opponentCorrect={0} feedback={null} coins={100} currentLetters={letters} activeSlotIndex={0} guesses={[]} letterStates={{}} pending={pending} allowTypingWhilePending={projected} onClose={()=>action('close')} onSelectSlot={()=>action('slot')} onLetter={letter=>{action(letter);setLetters(x=>[letter,...x.slice(1)]);}} onText={text=>action(text)} onBackspace={()=>{action('backspace');setLetters(x=>x.slice(0,-1));}} onHint={()=>action('hint')} onSubmit={()=>action('submit')} onSkip={()=>action('skip')}/></section>;}
createRoot(document.querySelector('#root')).render(new URL(location.href).searchParams.has('race')?<RaceFixture/>:<PlayHostApp session={session}/>);
`);
  await build({root: scratch, configFile: false, publicDir: path.join(root, 'public'), logLevel: 'error', define: {'process.env.NODE_ENV': '"production"'}, resolve: {alias: {'#shop-modal-page': path.join(root, 'src/web/play/modalPages/commerce/ShopModalPage.tsx')}}, build: {outDir: 'dist', minify: false}});
  server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      res.setHeader('content-type', ({'.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.json': 'application/json'})[path.extname(file)] ?? 'text/html');
      res.end(await readFile(file));
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: true});
  for (const [width, height] of [[320, 568], [390, 568], [600, 500], [844, 390], [1280, 844]]) {
    for (const surface of ['solo', 'race']) {
      const context = await browser.newContext({viewport: {width, height}, hasTouch: true});
      const page = await context.newPage();
      const metric = (name, actual, expected = true) => observations.push({surface, width, height, name, actual, expected});
      const settle = () => page.evaluate(async () => {await document.fonts.ready; for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r));});
      try {
        await page.goto(url + (surface === 'race' ? '?race=1' : ''));
        await page.getByText('What has keys but cannot open doors?', {exact: true}).waitFor();
        if (await page.getByRole('button', {name: "Let's Play", exact: true}).count()) await page.getByRole('button', {name: "Let's Play", exact: true}).click();
        await settle();
        const geometry = await page.evaluate(() => {
          const keys = [...document.querySelectorAll('.keyboard .key')], actions = [...document.querySelectorAll('.game-input-actions button')], cells = [...document.querySelectorAll('.guess-board .cell')];
          const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.1;
          const fit = el => {const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;};
          return {noOverlap: keys.every(key => actions.every(action => !intersects(key.getBoundingClientRect(), action.getBoundingClientRect()))), noCellOverlap: keys.every(key => cells.every(cell => !intersects(key.getBoundingClientRect(), cell.getBoundingClientRect()))), fits: keys.every(fit) && actions.every(fit), actionHits: actions.every(el => {const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}), actionNames: actions.map(el => el.textContent.trim()), minimumKeyHeight: Math.min(...keys.map(el=>el.getBoundingClientRect().height)), scale: document.querySelector('.game-content,.race-gameplay-viewport')?.dataset.viewportScale};
        });
        metric('keyboard does not overlap Hint Submit Skip', geometry.noOverlap);
        metric('keyboard does not overlap any answer cell', geometry.noCellOverlap);
        metric('keyboard and all action targets fit viewport', geometry.fits);
        metric('each action owns its center hit target', geometry.actionHits);
        metric('all three actions retain accessible text', geometry.actionNames.length === 3 && geometry.actionNames.every(Boolean));
        metric('physical key height retains existing floor', geometry.minimumKeyHeight >= 32);
        observations.at(-1).geometry = geometry;
        if (surface === 'solo') {
          await page.locator('[data-tooltip=gameHint]').click();
          await page.locator('.modal-hint').waitFor();
          metric('Hint still opens its own modal', await page.locator('.modal-hint').isVisible());
          await page.keyboard.press('Escape');
          await page.locator('.game-modal').waitFor({state: 'hidden'});
          await page.locator('[data-tooltip=gameSkip]').click();
          await page.locator('.modal-skip').waitFor();
          metric('Skip still opens its own modal', await page.locator('.modal-skip').isVisible());
          await page.keyboard.press('Escape');
          await page.locator('.game-modal').waitFor({state: 'hidden'});
          await page.locator('.keyboard .key').filter({hasText: /^P$/}).click();
          await page.getByRole('button', {name: 'Settings', exact: true}).click();
          await page.locator('.modal-settings').waitFor();
          const before = await page.evaluate(() => window.draft());
          metric('visible modal makes gameplay inert', await page.locator('.game-content').getAttribute('inert') !== null);
          const keyBox = await page.locator('.keyboard .key').first().boundingBox();
          await page.mouse.click(keyBox.x + keyBox.width / 2, keyBox.y + keyBox.height / 2);
          metric('tapping behind modal does not edit answer', await page.evaluate(() => window.draft()), before);
          if (!await page.locator('.game-modal').count()) await page.getByRole('button', {name: 'Settings', exact: true}).click();
          for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
          metric('modal keeps focus away from wider keyboard', await page.evaluate(() => document.activeElement?.closest('.game-modal') !== null));
          await page.keyboard.press('Escape');
          await page.locator('.game-modal').waitFor({state: 'hidden'});
          await page.evaluate(() => document.activeElement?.blur());
          await page.keyboard.press('Backspace');
          await page.keyboard.type('piano');
          await page.waitForFunction(() => window.draft() === 'PIANO');
          await page.evaluate(() => window.probe.hold = true);
          await page.locator('.submit-action').click();
          await page.waitForFunction(() => window.probe.guesses.length === 1 && typeof window.releaseGuess === 'function');
          metric('Submit dispatches one authoritative request', await page.evaluate(() => window.probe.guesses.length), 1);
          metric('terminal pending answer disables every virtual key', await page.locator('.keyboard .key:not(:disabled)').count(), 0);
          const held = await page.evaluate(() => window.draft());
          const disabledBox = await page.locator('.keyboard .key').first().boundingBox();
          await page.mouse.click(disabledBox.x + 1, disabledBox.y + disabledBox.height / 2);
          metric('disabled pending key edge cannot edit answer', await page.evaluate(() => window.draft()), held);
          metric('disabled pending actions cannot double submit', await page.evaluate(() => window.probe.guesses.length), 1);
          await page.evaluate(() => {window.probe.hold = false; window.releaseGuess();});
          await page.locator('.modal-victory').waitFor();
          metric('completion still shows victory modal', await page.locator('.modal-victory').isVisible());
        } else {
          const actions = page.locator('.race-actions button');
          await actions.nth(0).click(); await actions.nth(1).click(); await actions.nth(2).click();
          metric('race Hint Submit Skip dispatch only their own actions', await page.evaluate(() => window.probe.actions), ['hint', 'submit', 'skip']);
          await page.evaluate(() => window.setPending(true));
          await page.waitForFunction(() => [...document.querySelectorAll('.keyboard .key')].every(el => el.disabled));
          metric('ordinary pending race disables every virtual key', await page.locator('.keyboard .key:not(:disabled)').count(), 0);
          metric('pending race disables all adjacent actions', await page.locator('.race-actions button:not(:disabled)').count(), 0);
          const prior = await page.evaluate(() => [...window.probe.actions]);
          for (const selector of ['.keyboard .key', '.race-actions button']) {
            const bounds = await page.locator(selector).first().boundingBox();
            await page.mouse.click(bounds.x + 1, bounds.y + bounds.height / 2);
          }
          metric('disabled race edges dispatch no action', await page.evaluate(() => window.probe.actions), prior);
          await page.evaluate(() => window.setPending(true, true));
          await page.waitForFunction(() => document.querySelector('.keyboard .key')?.disabled === false);
          metric('projected pending race keeps intentional typing available', await page.locator('.keyboard .key:disabled').count(), 0);
          metric('projected pending race keeps mutations disabled', await page.locator('.race-actions button:not(:disabled)').count(), 0);
          await page.locator('.keyboard .key').first().click();
          metric('projected pending key dispatches once', await page.evaluate(() => window.probe.actions.at(-1)), 'Q');
        }
        metric('no browser error', await page.evaluate(() => window.probe.errors), []);
        metric('no unhandled promise', await page.evaluate(() => window.probe.unhandled), []);
        await page.screenshot({path: path.join(output, `${surface}-${width}x${height}.png`)});
      } catch (error) {
        await page.screenshot({path: path.join(output, `failure-${surface}-${width}x${height}.png`)});
        throw error;
      } finally {await context.close();}
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2));
}
const failures = observations.filter(row => JSON.stringify(row.actual) !== JSON.stringify(row.expected));
console.log(JSON.stringify({mode: 'production', authority: 'local UI fixtures using real shared components', checks: observations.length, failures}, null, 2));
assert.equal(failures.length, 0, 'Expanded keyboard preserves action, pending and modal isolation');
