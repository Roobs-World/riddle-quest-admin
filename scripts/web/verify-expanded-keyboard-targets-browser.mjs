import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.env.KEYBOARD_TARGETS_REPORT_DIR ?? path.join(root, 'artifacts/keyboard-targets-20261020/tap-checks'));
const baselineDirectory = process.env.KEYBOARD_BASELINE_DIR;
const allViewports = [
  {width: 320, height: 568},
  {width: 390, height: 844},
  {width: 844, height: 390},
  {width: 1280, height: 900},
];
const viewports = process.env.KEYBOARD_TARGETS_VIEWPORT
  ? allViewports.filter(({width, height}) => `${width}x${height}` === process.env.KEYBOARD_TARGETS_VIEWPORT)
  : allViewports;
const mime = new Map([
  ['.html', 'text/html'], ['.js', 'text/javascript'], ['.css', 'text/css'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'], ['.json', 'application/json'], ['.webm', 'audio/webm'],
]);
await mkdir(output, {recursive: true});
await mkdir(path.join(root, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/expanded-keyboard-'));
const observations = [];
const totals = {nativeTaps: 0, answerCellTaps: 0, heldPresses: 0, gapTaps: 0, nativeAdjustedGapTaps: 0, cases: 0};
let browser;
let browserVersion;
let server;

const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.05 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.05;
const snapshot = page => page.evaluate(() => {
  const bounds = node => {
    const {x, y, width, height, left, right, top, bottom} = node.getBoundingClientRect();
    return {x, y, width, height, left, right, top, bottom};
  };
  return {
    keys: [...document.querySelectorAll('.keyboard button')].map((button, index) => ({
      index, label: button.classList.contains('utility') ? 'Backspace' : button.textContent,
      row: [...button.parentElement.parentElement.children].indexOf(button.parentElement),
      bounds: bounds(button), transform: getComputedStyle(button).transform,
    })),
    actions: [...document.querySelectorAll('.game-input-actions button')].map(button => ({label: button.textContent, bounds: bounds(button)})),
    board: bounds(document.querySelector('.guess-board')),
    cells: [...document.querySelectorAll('.guess-board button.cell')].map((cell, index) => ({index, disabled: cell.disabled, bounds: bounds(cell)})),
    keyboard: bounds(document.querySelector('.keyboard')),
    scale: document.querySelector('[data-viewport-scale]')?.dataset.viewportScale,
    width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
  };
});

try {
  await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
  await writeFile(path.join(scratch, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {GameFrameApp} from ${JSON.stringify(path.join(root, 'src/web/play/GameFrameApp.tsx'))};
import {RaceGameplay} from ${JSON.stringify(path.join(root, 'src/web/play/race/components/RaceGameplay.tsx'))};
import {useRaceGameplayFit} from ${JSON.stringify(path.join(root, 'src/web/play/race/hooks/useRaceGameplayFit.ts'))};
import {editRaceInput} from ${JSON.stringify(path.join(root, 'src/web/play/race/logic/raceInput.ts'))};
import {RACE_RULES, RaceRunViewSchema} from ${JSON.stringify(path.join(root, 'src/core/race'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(root, 'src/web/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey} from ${JSON.stringify(path.join(root, 'src/web/play/guidance/guidanceConfig.ts'))};
import {setLocaleAndWait} from ${JSON.stringify(path.join(root, 'src/web/play/i18n.ts'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.race-lobby.css'))};
import ${JSON.stringify(path.join(root, 'src/web/styles.race-gameplay.css'))};
const query=new URL(location.href).searchParams, locale=query.get('locale')??'en',surface=query.get('surface')??'solo';
window.__keyboardTapProbe=[];window.__actionProbe=[];window.__RIDDLE_QUEST_BROWSER_TEST__=true;
const owner='keyboard-targets-owner';applyPlayerPreferences({locale,onboardingComplete:true,muted:true,reducedMotion:true});
sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',owner),'seen');
localStorage.setItem(createTooltipTourStorageKey('gameTour',owner),'seen');
await setLocaleAndWait(locale);
function host(message){window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:message}));}
let initialized=false;
window.addEventListener('riddle-quest:game-to-host',event=>{if(event.detail.type!=='game:ready'||initialized)return;initialized=true;
setTimeout(()=>{host({type:'host:init',payload:{protocolVersion:1,sessionId:'keyboard-target-fixture',locale,gameMode:'classic',
user:{uid:owner,isAnonymous:false,accountGeneration:1},profile:{username:'Player',coins:570,level:2,xp:150,winStreak:1,gamesPlayed:1,wins:1,achievements:[],classicIndex:1},products:[]}});
host({type:'host:riddleLoaded',payload:{riddle:{riddleId:'keyboard-target-riddle',sessionToken:'keyboard-target-session-000000001',text:'What has keys but cannot open doors?',answerLength:5,gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false,evaluation:{answer:'piano',locale}}}});},50);});
document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('.game-input-actions button'))window.__actionProbe.push(event.target.closest('button').textContent);},true);
function Race(){const screenRef=React.useRef(null),viewportRef=React.useRef(null),gameplayRef=React.useRef(null);
const [input,setInput]=React.useState({letters:['','','','',''],activeSlotIndex:0});
useRaceGameplayFit({active:true,screenRef,viewportRef,gameplayRef});
const run=React.useMemo(()=>RaceRunViewSchema.parse({runId:'keyboard-target-race',role:'creator',status:'active',categoryId:'mixed',locale,rules:RACE_RULES,correctCount:0,wallElapsedMs:1000,totalPenaltyMs:0,adjustedElapsedMs:1000,events:[],serverNowMs:Date.now(),startsAtMs:Date.now()-1000,currentRiddle:{riddleId:'keyboard-target-question',text:'What has keys but cannot open doors?',answerLength:5,position:0,guessesUsed:0,guessesRemaining:5,hintAvailable:true,revealedLetters:[],confirmedGuesses:[]},opponent:{displayName:'Rival',avatarUrl:null,adjustedFinishMs:300000,events:[]}}),[]);
const edit=(kind,value)=>setInput(previous=>editRaceInput(run.currentRiddle,previous,kind,value));
return <section ref={screenRef} className='race-screen race-screen-gameplay' role='dialog' aria-label='Keyboard test race'><RaceGameplay viewportRef={viewportRef} gameplayRef={gameplayRef} run={run} live adjustedNow={1000} opponentCorrect={0} feedback={null} coins={100} currentLetters={input.letters} activeSlotIndex={input.activeSlotIndex} guesses={[]} letterStates={{}} pending={false} allowTypingWhilePending={false} onClose={()=>{}} onSelectSlot={index=>edit('slot',index)} onLetter={letter=>edit('letter',letter)} onText={text=>edit('text',text)} onBackspace={()=>edit('backspace','')} onHint={()=>{}} onSubmit={()=>{}} onSkip={()=>{}}/></section>;}
createRoot(document.querySelector('#root')).render(surface==='race'?<Race/>:<GameFrameApp localBridge/>);
`);

  for (const version of baselineDirectory ? ['before', 'current'] : ['current']) {
    await build({root: scratch, configFile: false, base: './', publicDir: path.join(root, 'public'), logLevel: 'error',
      define: {'process.env.NODE_ENV': JSON.stringify('production')},
      plugins: [{name: 'record-real-keyboard-callbacks', enforce: 'pre', async load(id) {
        if (version === 'before' && id === path.join(root, 'src/web/styles.race-gameplay.css')) {
          return readFile(path.join(baselineDirectory, 'styles.race-gameplay.css'), 'utf8');
        }
        if (version === 'before' && id === path.join(root, 'src/web/styles.css')) {
          const entry = await readFile(id, 'utf8');
          const names = [...entry.matchAll(/@import "\.\/([^";]+)";/g)].map(match => match[1]);
          return (await Promise.all(names.map(name => readFile(path.join(
            ['styles.puzzle.css', 'styles.guidance.css'].includes(name) ? baselineDirectory : path.join(root, 'src'), name), 'utf8')))).join('\n');
        }
        if (id !== path.join(root, 'src/web/play/GameFrameControls.tsx')) return;
        const source = await readFile(id, 'utf8');
        const letter = 'onClick={() => onLetter(letter)}';
        const backspace = 'onClick={onBackspace}';
        assert.equal(source.split(letter).length, 2);
        assert.equal(source.split(backspace).length, 2);
        return source.replace(letter, 'onClick={() => {window.__keyboardTapProbe.push({kind:"letter",value:letter});onLetter(letter);}}')
          .replace(backspace, 'onClick={() => {window.__keyboardTapProbe.push({kind:"backspace"});onBackspace();}}');
      }}], build: {outDir: `dist-${version}`, target: 'esnext'}});
  }

  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const version = url.pathname.split('/')[1];
      if (!['before', 'current'].includes(version)) throw new Error('Unknown version');
      const relative = url.pathname.slice(version.length + 1) || '/index.html';
      const directory = path.join(scratch, `dist-${version}`);
      const file = path.resolve(directory, `.${relative === '/' ? '/index.html' : relative}`);
      if (!file.startsWith(`${directory}${path.sep}`)) throw new Error('Invalid file path');
      response.writeHead(200, {'content-type': mime.get(path.extname(file)) ?? 'application/octet-stream'});
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless: true});
  browserVersion = browser.version();
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const viewport of viewports) for (const locale of ['en', 'tr', 'ar']) for (const surface of ['solo', 'race']) {
    const label = `${surface}-${locale}-${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({viewport, hasTouch: true, isMobile: viewport.width < 821, deviceScaleFactor: 2});
    const page = await context.newPage();
    const errors = [];
    const failedResources = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (response.status() >= 400) failedResources.push({url: response.url(), status: response.status()});});
    const load = async version => {
      await page.goto(`${origin}/${version}/?surface=${surface}&locale=${locale}`);
      await page.locator('.keyboard button').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('.game-content')?.hasAttribute('inert'));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.querySelector('[data-viewport-scale]')?.dataset.viewportScale);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    let before;
    let geometry;
    try {
      if (baselineDirectory) {await load('before'); before = await snapshot(page);}
      await load('current');
      geometry = await snapshot(page);
      const intersections = value => value?.keys.flatMap(key => value.cells.filter(cell => overlaps(key.bounds, cell.bounds)).map(cell => ({key: key.label, cell: cell.index, cellDisabled: cell.disabled,
        intersection: {left: Math.max(key.bounds.left, cell.bounds.left), top: Math.max(key.bounds.top, cell.bounds.top),
          right: Math.min(key.bounds.right, cell.bounds.right), bottom: Math.min(key.bounds.bottom, cell.bounds.bottom)}})));
      const answerCellIntersections = {before: intersections(before), current: intersections(geometry)};
      await writeFile(path.join(output, `${label}-geometry.json`), JSON.stringify({before, current: geometry, answerCellIntersections}, null, 2));
      if (process.env.KEYBOARD_TARGETS_GEOMETRY_ONLY === '1') {
        observations.push({label, viewport, locale, surface, before, geometry});
        console.log(JSON.stringify({label, backspace: {before: before?.keys.find(key => key.label === 'Backspace').bounds.width,
          current: geometry.keys.find(key => key.label === 'Backspace').bounds.width}, answerCellIntersections}));
        continue;
      }
      assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
      assert.equal(geometry.keys.length, locale === 'tr' ? 28 : 27, `${label}: key count`);
      assert.ok(geometry.scrollWidth <= viewport.width + 1, `${label}: no horizontal overflow`);
      const firstKey = geometry.keys.find(key => key.label === 'Q'), backspace = geometry.keys.find(key => key.label === 'Backspace');
      await page.touchscreen.tap(firstKey.bounds.left + 1, firstKey.bounds.top + firstKey.bounds.height / 2);
      await page.waitForFunction(() => document.querySelector('.guess-row .cell-glyph')?.textContent === 'Q');
      await page.touchscreen.tap(backspace.bounds.right - 1, backspace.bounds.top + backspace.bounds.height / 2);
      await page.waitForFunction(() => [...document.querySelectorAll('.guess-row:first-child .cell-glyph')].every(cell => !cell.textContent));
      totals.nativeTaps += 2;
      for (const cell of geometry.cells.filter(cell => !cell.disabled)) {
        for (const side of ['left', 'center', 'right']) {
          const x = side === 'left' ? cell.bounds.left + 1 : side === 'right' ? cell.bounds.right - 1 : cell.bounds.left + cell.bounds.width / 2;
          const y = cell.bounds.top + cell.bounds.height / 2;
          await page.evaluate(() => {window.__keyboardTapProbe = []; window.__actionProbe = [];});
          await page.touchscreen.tap(x, y);
          assert.deepEqual(await page.evaluate(() => ({keys: window.__keyboardTapProbe, actions: window.__actionProbe})), {keys: [], actions: []}, `${label}: ${side} cell tap does not trigger keyboard/actions`);
          assert.equal(await page.locator('.guess-board button.cell').nth(cell.index).getAttribute('aria-current'), 'true', `${label}: ${side} tap selects intended cell ${cell.index}`);
          totals.answerCellTaps++;
        }
      }
      for (const key of geometry.keys) {
        assert.equal(key.transform, 'none', `${label}: stationary key ${key.label}`);
        assert.ok(key.bounds.left >= -0.5 && key.bounds.right <= viewport.width + 0.5 && key.bounds.top >= -0.5 && key.bounds.bottom <= viewport.height + 0.5, `${label}: ${key.label} stays in viewport`);
        for (const other of geometry.keys) if (key.index !== other.index) assert.ok(!overlaps(key.bounds, other.bounds), `${label}: distinct ${key.label}/${other.label} targets`);
        for (const action of geometry.actions) assert.ok(!overlaps(key.bounds, action.bounds), `${label}: ${key.label} separate from ${action.label}`);
        for (const cell of geometry.cells) assert.ok(!overlaps(key.bounds, cell.bounds), `${label}: ${key.label} separate from answer cell ${cell.index}`);
        if (before) assert.ok(key.bounds.width >= before.keys[key.index].bounds.width + 0.2, `${label}: ${key.label} target expands from ${before.keys[key.index].bounds.width} to ${key.bounds.width}; scales ${before.scale}/${geometry.scale}`);
        for (const side of ['left', 'center', 'right']) {
          const x = side === 'left' ? key.bounds.left + 1 : side === 'right' ? key.bounds.right - 1 : key.bounds.left + key.bounds.width / 2;
          const y = key.bounds.top + key.bounds.height / 2;
          await page.evaluate(() => {window.__keyboardTapProbe = []; window.__actionProbe = [];});
          await page.touchscreen.tap(x, y);
          const result = await page.evaluate(() => ({keys: window.__keyboardTapProbe, actions: window.__actionProbe}));
          assert.deepEqual(result, {keys: [key.label === 'Backspace' ? {kind: 'backspace'} : {kind: 'letter', value: key.label}], actions: []}, `${label}: ${side} tap hits only ${key.label}`);
          totals.nativeTaps++;
        }
      }

      for (let index = 0; index < geometry.keys.length - 1; index++) {
        const key = geometry.keys[index], next = geometry.keys[index + 1];
        if (key.row !== next.row) continue;
        const left = key.bounds.left < next.bounds.left ? key : next;
        const right = key.bounds.left < next.bounds.left ? next : key;
        const x = Math.round((left.bounds.right + right.bounds.left) / 2), y = Math.round(key.bounds.top + key.bounds.height / 2);
        const pointInsideKey = await page.evaluate(({x, y}) => Boolean(document.elementFromPoint(x, y)?.closest('.keyboard button')), {x, y});
        await page.evaluate(() => {window.__keyboardTapProbe = []; window.__actionProbe = [];});
        await page.touchscreen.tap(x, y);
        const result = await page.evaluate(() => ({keys: window.__keyboardTapProbe, actions: window.__actionProbe}));
        assert.deepEqual(result.actions, [], `${label}: seam does not trigger actions`);
        assert.ok(result.keys.length <= 1, `${label}: seam produces at most one callback`);
        if (result.keys.length) assert.ok([left, right].some(neighbor => JSON.stringify(result.keys[0]) === JSON.stringify(
          neighbor.label === 'Backspace' ? {kind: 'backspace'} : {kind: 'letter', value: neighbor.label})), `${label}: native touch adjustment stays within immediate seam neighbors`);
        if (!pointInsideKey && result.keys.length) totals.nativeAdjustedGapTaps++;
        totals.gapTaps++;
      }

      const held = geometry.keys.find(key => key.label === 'G');
      const session = await context.newCDPSession(page);
      await page.evaluate(() => {window.__keyboardTapProbe = []; window.__actionProbe = [];});
      await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: held.bounds.left + 1, y: held.bounds.top + held.bounds.height / 2}]});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const pressed = (await snapshot(page)).keys[held.index].bounds;
      for (const property of ['left', 'right', 'top', 'bottom']) assert.ok(Math.abs(pressed[property] - held.bounds[property]) < 0.1, `${label}: pressed ${property} stays fixed`);
      await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      await page.waitForFunction(() => window.__keyboardTapProbe.length === 1);
      assert.deepEqual(await page.evaluate(() => window.__keyboardTapProbe), [{kind: 'letter', value: 'G'}]);
      totals.heldPresses++;
      await session.detach();
      assert.deepEqual(errors, [], `${label}: no browser errors`);
      assert.deepEqual(failedResources, [], `${label}: resources have correct paths and MIME`);
      await page.screenshot({path: path.join(output, `${label}.png`)});
      await rm(path.join(output, `${label}-failure.png`), {force: true});
      observations.push({label, viewport, locale, surface, geometry, before, browserErrors: errors, failedResources,
        improvements: before ? geometry.keys.map(key => ({label: key.label, before: before.keys[key.index].bounds.width, after: key.bounds.width})) : undefined});
      totals.cases++;
      console.log(`PASS ${label}`);
    } catch (error) {
      observations.push({label, viewport, locale, surface, before, geometry, failed: true, error: String(error), browserErrors: errors, failedResources});
      await page.screenshot({path: path.join(output, `${label}-failure.png`)}).catch(() => {});
      throw error;
    } finally {await context.close();}
  }
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
  const hashes = {};
  const baselineHashes = {};
  for (const name of ['styles.puzzle.css', 'styles.guidance.css', 'styles.race-gameplay.css']) {
    hashes[name] = createHash('sha256').update(await readFile(path.join(root, 'src', name))).digest('hex');
    if (baselineDirectory) baselineHashes[name] = createHash('sha256').update(await readFile(path.join(baselineDirectory, name))).digest('hex');
  }
  await writeFile(path.join(output, 'observations.json'), JSON.stringify({totals, browserVersion, hashes, baselineHashes, baselineDirectory, scope: 'Full GameFrameApp with local bridge fixture, real RaceGameplay with real useRaceGameplayFit and fixture run. Test-only callback probes added to native shared keyboard handlers. Chromium native touchscreen dispatch, complete shared/solo/race CSS. Native touch adjustment in a seam may select zero or one immediate neighboring key. No hosted provider or backend journey.', observations}, null, 2));
}
console.log(JSON.stringify(totals));
