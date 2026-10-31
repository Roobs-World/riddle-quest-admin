import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium, firefox} from '@playwright/test';

const portal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.env.CHECKPOINT_WRITER_REACT_MODE ?? 'development';
const engine = process.env.CHECKPOINT_WRITER_BROWSER ?? 'chromium';
assert.ok(['development', 'production'].includes(mode));assert.ok(['chromium', 'firefox'].includes(engine));
const output = path.resolve(process.env.CHECKPOINT_WRITER_REPORT_DIR ?? path.join(portal, '../../builds/test-evidence/checkpoint-writer-recovery-2026-10-06', engine + '-' + mode));
await mkdir(output, {recursive: true});await mkdir(path.join(portal, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(portal, 'node_modules/.cache/checkpoint-writer-recovery-'));
const observations = [];let browser, server, browserVersion;
try {
  await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
  await writeFile(path.join(scratch, 'index.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';
import {PlayHostApp} from ${JSON.stringify(path.join(portal, 'src/play/PlayHostApp.tsx'))};
import {createHostedPlaySession} from ${JSON.stringify(path.join(portal, 'src/play/HostedPlaySession.ts'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(portal, 'src/play/fakeServices.ts'))};
import {PlayerProjectionPersistence} from ${JSON.stringify(path.join(portal, 'src/platform/PlayerProjectionPersistence.ts'))};
import {useGameSessionPersistence} from ${JSON.stringify(path.join(portal, 'src/play/game/hooks/useGameSessionPersistence.ts'))};
import {createSavedGame} from ${JSON.stringify(path.join(portal, 'src/play/GameSessionCheckpoints.ts'))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(path.join(portal, 'src/play/gameSession.ts'))};
import {ControlledGuessBoard,ControlledKeyboard} from ${JSON.stringify(path.join(portal, 'src/play/GameFrameControls.tsx'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal, 'src/play/playerPreferences.ts'))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(portal, 'src/play/guidance/guidanceConfig.ts'))};
import ${JSON.stringify(path.join(portal, 'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
for(const uid of ['jest-guest']){sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');for(const key of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+key,uid),'seen');}
const scenario=new URLSearchParams(location.search).get('scenario');
window.probe={updates:[],writes:[],reads:[],caught:[],errors:[],unhandled:[],flushes:0};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const fixture=createFakeHostServices(),profile=await fixture.loadProfile('jest-guest');
const user={uid:'Alice',displayName:'Alice',isAnonymous:true,accountGeneration:1};
const first={riddleId:'classic_1',text:'What has keys but cannot open doors?',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1,attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false},second={...first,riddleId:'classic_2',sessionToken:'00000000-0000-4000-8000-000000000002',index:2};
function seed(){let state=gameSessionReducer(createInitialGameSession(),{type:'hostInit',locale:'en',gameMode:'classic',user,profile,products:[]});return gameSessionReducer(state,{type:'loadRiddle',riddle:first});}
let restoreState=seed();for(const letter of 'PIAN')restoreState=gameSessionReducer(restoreState,{type:'typeLetter',letter});const restored=scenario==='hook-restore'?createSavedGame(restoreState,1):null;
const initial={schemaVersion:1,updatedAt:1,profile,activeGame:restored};let stored=structuredClone(initial),failOnce=false;
const storage={readPreferences:async()=>({}),writePreferences:async()=>{},readPlayerData:async()=>structuredClone(stored),writePlayerData:async value=>{if(failOnce){failOnce=false;throw new Error('fixture-write-failed');}stored=structuredClone(value);window.probe.writes.push(structuredClone(value));},flush:async()=>{window.probe.flushes++;}};
const persistence=new PlayerProjectionPersistence(storage,initial);
const write=change=>{window.probe.updates.push(structuredClone(change));void persistence.update(change).catch(error=>window.probe.caught.push(error.message));};
window.read=()=>structuredClone(stored);window.drain=()=>persistence.flush();window.saves=()=>window.probe.updates.filter(x=>Object.hasOwn(x,'activeGame')).map(x=>x.activeGame);
window.background=()=>{const old=Object.getOwnPropertyDescriptor(document,'visibilityState');Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});try{document.dispatchEvent(new Event('visibilitychange'));}finally{if(old)Object.defineProperty(document,'visibilityState',old);else delete document.visibilityState;}};
const services={...fixture,loadRiddle:input=>{window.probe.reads.push(input);return fixture.loadRiddle(input);}};
function Host({enabled,tick}){const callback=React.useCallback(change=>write(change),[tick]);const session=createHostedPlaySession({hostServices:services,economyAvailable:false,raceAvailable:false,initialPlayerData:initial,onPlayerDataChange:enabled?callback:undefined});return <PlayHostApp session={session}/>;}
function Game({enabled,tick}){const [state,dispatch]=React.useReducer(gameSessionReducer,undefined,seed),stateRef=React.useRef(state);stateRef.current=state;
 const callback=React.useCallback(activeGame=>write({activeGame}),[tick]);
 useGameSessionPersistence({state,stateRef,dispatch,restoredGame:restored,onSaveGame:enabled?callback:undefined});
 window.replace=kind=>{if(kind==='owner'||kind==='generation'){dispatch({type:'authState',user:{...user,uid:kind==='owner'?'Bob':'Alice',accountGeneration:kind==='generation'?2:1},profile});dispatch({type:'loadRiddle',riddle:second});}else if(kind==='question')dispatch({type:'loadRiddle',riddle:second});else if(kind==='clear'){dispatch({type:'guessResolved',feedback:{guess:[...'PIANO'],feedback:Array(5).fill('green')},attempts:1,isCorrect:true,gameOver:true,canContinue:false});dispatch({type:'completionAcknowledged'});}else if(kind==='hint')dispatch({type:'previewHint',index:1,letter:'X'});};
 window.direct=()=>persistence.update({activeGame:createSavedGame(state)});window.snapshot=()=>createSavedGame(state);
 return <main data-game data-token={state.riddle?.sessionToken} data-owner={state.user?.uid} data-generation={state.user?.accountGeneration} data-draft={state.currentLetters.join('')}><ControlledGuessBoard answerLength={state.riddle?.answerLength??5} currentLetters={state.currentLetters} activeSlotIndex={state.activeSlotIndex} guesses={state.guesses} hintRevealedIndices={state.hintRevealedIndices} onSelectSlot={index=>dispatch({type:'selectSlot',index})}/><ControlledKeyboard letterStates={state.letterStates} onLetter={letter=>dispatch({type:'typeLetter',letter})} onBackspace={()=>dispatch({type:'backspace'})}/></main>;}
function App(){const [enabled,setEnabled]=React.useState(['host-drop','host-stable','hook-drop','hook-stable'].includes(scenario)),[tick,setTick]=React.useState(0),[mounted,setMounted]=React.useState(true);
 window.enable=()=>{if(scenario==='hook-failure')failOnce=true;setEnabled(true);};window.disable=()=>setEnabled(false);window.refresh=()=>setTick(x=>x+1);window.retire=()=>setMounted(false);
 React.useLayoutEffect(()=>{if(enabled&&scenario==='hook-background-commit')window.background();},[enabled]);
 return <div data-enabled={enabled} data-tick={tick} data-mounted={mounted}>{mounted?(scenario.startsWith('host-')?<Host enabled={enabled} tick={tick}/>:<Game enabled={enabled} tick={tick}/>):<output data-retired>Retired fixture</output>}</div>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
`);
  await build({root: scratch, configFile: false, publicDir: path.join(portal, 'public'), logLevel: 'error', define: {'process.env.NODE_ENV': JSON.stringify(mode)}, plugins: [{name: 'checkpoint-writer-baseline', enforce: 'pre', async load(id) {
    const baseline = process.env.CHECKPOINT_WRITER_BASELINE_DIR;
    if (baseline && id.endsWith('/useGameSessionPersistence.ts')) return readFile(path.join(baseline, 'owned-00-before.txt'), 'utf8');
    if (baseline && id.endsWith('/PlayHostApp.tsx')) return readFile(path.join(baseline, 'owned-02-before.txt'), 'utf8');
  }}], build: {outDir: 'dist', minify: false, target: 'esnext'}});
  server = createServer(async (req, res) => {try {
    const name = new URL(req.url, 'http://localhost').pathname, file = path.join(scratch, 'dist', name === '/' ? 'index.html' : name);
    res.setHeader('content-type', ({'.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webm': 'audio/webm'})[path.extname(file)] ?? 'text/html');res.end(await readFile(file));
  } catch {res.writeHead(404).end();}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await (engine === 'firefox' ? firefox : chromium).launch({headless: true, ...(engine === 'firefox' && process.env.CHECKPOINT_WRITER_FIREFOX_EXECUTABLE ? {executablePath: process.env.CHECKPOINT_WRITER_FIREFOX_EXECUTABLE} : {})});browserVersion = browser.version();
  const scenarios = process.env.CHECKPOINT_WRITER_SCENARIOS?.split(',') ?? ['host-late', 'host-drop', 'host-stable', 'hook-late', 'hook-drop', 'hook-background', 'hook-background-commit', 'hook-clear', 'hook-question', 'hook-owner', 'hook-generation', 'hook-restore', 'hook-hint', 'hook-unmount', 'hook-stable', 'hook-never', 'hook-failure', 'hook-queue-control', 'hook-untouched'];
  for (const [width, height] of process.env.CHECKPOINT_WRITER_QUICK === '1' ? [[390, 568]] : [[390, 568], [390, 844], [1280, 844]]) for (const scenario of scenarios) {
    const context = await browser.newContext({viewport: {width, height}}), page = await context.newPage(), external = [];
    await context.route('**/*', route => {if (new URL(route.request().url()).origin === origin) return route.continue();external.push(route.request().url());return route.abort();});
    const metric = (name, actual, expected) => observations.push({width, height, scenario, name, actual, expected});
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const toggle = async enabled => {await page.evaluate(enabled => enabled ? window.enable() : window.disable(), enabled);await page.waitForFunction(enabled => document.querySelector('[data-enabled]')?.dataset.enabled === String(enabled), enabled);await settle();};
    const refresh = async () => {for (let i = 0; i < 32; i++) {await page.evaluate(() => window.refresh());await page.waitForFunction(i => document.querySelector('[data-tick]')?.dataset.tick === String(i + 1), i);}await settle();};
    await page.goto(origin + '/?scenario=' + scenario);await page.locator('.guess-row').first().waitFor();await settle();
    if (scenario === 'hook-restore') await page.waitForFunction(() => document.querySelector('[data-game]')?.dataset.draft === 'PIAN');
    if (!['hook-background', 'hook-untouched', 'hook-restore'].includes(scenario)) {
      // The real keyboard and reducer receive an edit only after checkpoint startup.
      await page.locator('.keyboard .key').filter({hasText: /^P$/}).first().click();await page.waitForFunction(() => document.querySelector('.guess-row')?.textContent.includes('P'));await settle();
    }
    await page.evaluate(() => window.drain());
    const before = await page.evaluate(() => ({saves: window.saves().length, stored: window.read(), board: document.querySelector('.guess-row')}));
    metric('writer absence does not masquerade as durable progress', before.saves, ['host-drop', 'host-stable', 'hook-drop', 'hook-stable'].includes(scenario) ? 1 : 0);
    await page.evaluate(() => {window.originalBoard = document.querySelector('.guess-row');});
    if (scenario.endsWith('-drop')) {await toggle(false);await page.locator('.keyboard .key').filter({hasText: /^I$/}).first().click();await settle();metric('missing writer retains the durable previous draft', await page.evaluate(() => window.read().activeGame.currentLetters.join('')), 'P');}
    if (['hook-clear', 'hook-question', 'hook-owner', 'hook-generation', 'hook-hint'].includes(scenario)) {await page.evaluate(kind => window.replace(kind), scenario.slice(5));await settle();}
    if (scenario === 'hook-background') {await page.evaluate(() => window.background());await settle();}
    if (scenario === 'hook-unmount') {await page.evaluate(() => window.retire());await page.locator('[data-retired]').waitFor();await toggle(true);}
    else if (scenario === 'hook-never') await refresh();
    else if (scenario.endsWith('-stable')) await refresh();
    else if (scenario === 'hook-queue-control') {await page.evaluate(() => window.direct());await settle();}
    else await toggle(true);
    await page.evaluate(() => window.drain());await settle();
    const result = await page.evaluate(() => ({saves: window.saves(), stored: window.read(), errors: window.probe.errors, unhandled: window.probe.unhandled, caught: window.probe.caught, reads: window.probe.reads.length, sameBoard: window.originalBoard === document.querySelector('.guess-row')}));
    const noNewSave = ['hook-unmount', 'hook-never', 'hook-owner', 'hook-generation', 'hook-untouched', 'hook-queue-control'].includes(scenario) || scenario.endsWith('-stable');
    metric('availability delivers the latest pending projection once', result.saves.length - before.saves, noNewSave ? 0 : 1);
    const expectedDraft = scenario.endsWith('-drop') ? 'PI' : scenario === 'hook-restore' ? 'PIAN' : ['hook-background', 'hook-question'].includes(scenario) ? '' : ['hook-clear', 'hook-unmount', 'hook-never', 'hook-owner', 'hook-generation', 'hook-untouched'].includes(scenario) ? null : 'P';
    metric('durable queue contains only the current confirmed draft', result.stored.activeGame?.currentLetters.join('') ?? null, expectedDraft);
    if (scenario === 'hook-question') metric('new question supersedes the old missed draft', result.stored.activeGame?.sessionToken, '00000000-0000-4000-8000-000000000002');
    if (scenario === 'hook-hint') metric('unconfirmed hint never reaches storage', result.stored.activeGame?.hintRevealedIndices, []);
    if (scenario !== 'hook-unmount') metric('availability changes retain the playable board', result.sameBoard, true);
    if (scenario.startsWith('host-')) metric('host writer changes do not refetch authority content', result.reads, 1);
    metric('storage failure remains owned by the existing durability queue', result.caught, scenario === 'hook-failure' ? ['fixture-write-failed'] : []);
    metric('no browser errors', result.errors, []);metric('no unhandled promises', result.unhandled, []);metric('self-contained injected harness', external, []);
    await page.screenshot({path: path.join(output, [width, height, scenario].join('-') + '.png')});await context.close();
  }
} finally {await browser?.close();if (server) await new Promise(resolve => server.close(resolve));await rm(scratch, {recursive: true, force: true});await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');}
const failures = observations.filter(row => JSON.stringify(row.actual) !== JSON.stringify(row.expected));
console.log(JSON.stringify({mode, engine, browserVersion, cases: new Set(observations.map(row => [row.width, row.height, row.scenario].join(':'))).size, checks: observations.length, failures}, null, 2));assert.equal(failures.length, 0, 'Checkpoint writer availability recovery');
