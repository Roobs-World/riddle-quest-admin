import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium, firefox} from '@playwright/test';

const portal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.env.ATTEMPT_RETIRE_REACT_MODE ?? 'development';
const engine = process.env.ATTEMPT_RETIRE_BROWSER ?? 'chromium';
assert.ok(['development', 'production'].includes(mode));
assert.ok(['chromium', 'firefox'].includes(engine));
const output = path.resolve(process.env.ATTEMPT_RETIRE_REPORT_DIR ?? path.join(portal, '../../builds/test-evidence/attempt-recovery-commit-retirement-2026-10-06', engine + '-' + mode));
await mkdir(output, {recursive: true});await mkdir(path.join(portal, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(portal, 'node_modules/.cache/attempt-recovery-retirement-'));
let browser, server, activePage, browserVersion;
const observations = [];
try {
  await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
  await writeFile(path.join(scratch, 'index.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';
import {useAttemptRecovery} from ${JSON.stringify(path.join(portal, 'src/play/game/hooks/useAttemptRecovery.ts'))};
import {gameSessionReducer,createInitialGameSession} from ${JSON.stringify(path.join(portal, 'src/play/gameSession.ts'))};
import {ContinueModalPage} from ${JSON.stringify(path.join(portal, 'src/play/modalPages/commerce/ContinueActions.tsx'))};
import {ControlledGuessBoard,ControlledKeyboard} from ${JSON.stringify(path.join(portal, 'src/play/GameFrameControls.tsx'))};
import {createFakeHostServices} from ${JSON.stringify(path.join(portal, 'src/play/fakeServices.ts'))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal, 'src/play/playerPreferences.ts'))};
import ${JSON.stringify(path.join(portal, 'src/styles.css'))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const [kind,outcome]=new URLSearchParams(location.search).get('scenario').split(':');
window.probe={requests:[],actions:[],errors:[],unhandled:[],oldDone:false,newDone:false};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const fixture=createFakeHostServices(),profile=await fixture.loadProfile('jest-guest'),riddle={...await fixture.loadRiddle({gameMode:'classic',locale:'en'}),attemptsUsed:5,awaitingContinue:true};
const initial=gameSessionReducer(gameSessionReducer(createInitialGameSession(),{type:'hostInit',user:{uid:'Alice',isAnonymous:true,accountGeneration:1},profile,locale:'en',gameMode:'classic',products:[]}),{type:'loadRiddle',riddle});
let resolveOld,rejectOld,resolveNew;const oldWork=new Promise((resolve,reject)=>{resolveOld=resolve;rejectOld=reject;}),newWork=new Promise(resolve=>resolveNew=resolve);
function adapter(provider){return {request:input=>{window.probe.requests.push({provider,...input});return window.probe.requests.length===1?oldWork:newWork;}};}
const oldCapability=adapter(1),newCapability=adapter(2),never=new Promise(()=>{});
window.finishOld=()=>outcome==='failure'?rejectOld(new Error('Retired provider transport failed')):resolveOld(outcome==='unavailable'?{status:'unavailable',message:'fixture'}:outcome==='cancelled'?{status:'cancelled'}:{status:'success',value:{newCoins:900}});
window.finishNew=()=>resolveNew({status:'success',value:{newCoins:350}});
function App(){const [epoch,setEpoch]=React.useState(0),[suspend,setSuspend]=React.useState(false),[state,reduce]=React.useReducer(gameSessionReducer,initial);
 const stateRef=React.useRef(state);stateRef.current=state;
 const dispatch=React.useCallback(action=>{window.probe.actions.push({epoch:document.querySelector('[data-epoch]')?.dataset.epoch,action});reduce(action);},[kind==='dispatch'?epoch:0]);
 const observedState=suspend&&kind==='suspended-profile'?{...state,profile:{...state.profile,username:'Uncommitted'}}:state;
 const capability=kind==='disable'&&epoch?undefined:epoch&&(kind==='provider'||kind==='suspended-provider')?newCapability:oldCapability;
 const recovery=useAttemptRecovery({capability,state:observedState,stateRef,dispatch});
 React.useLayoutEffect(()=>{window.controls={replace:()=>setEpoch(1),reopen:()=>setEpoch(2),speculate:()=>React.startTransition(()=>{setSuspend(true);setEpoch(1);}),current:()=>{void recovery.request().then(()=>window.probe.newDone=true);},pending:()=>recovery.isPending()};},[epoch,recovery.request]);
 React.useLayoutEffect(()=>{if(!epoch||suspend)return;
  if(kind==='account'||kind==='generation'||kind==='aba'){reduce({type:'authState',user:{uid:(kind==='account'||kind==='aba')&&epoch===1?'Bob':'Alice',isAnonymous:true,accountGeneration:kind==='generation'?2:1},profile});reduce({type:'loadRiddle',riddle:{...riddle,sessionToken:kind==='aba'&&epoch===2?riddle.sessionToken:'00000000-0000-4000-8000-000000000002'}});}
  if(kind==='question')reduce({type:'loadRiddle',riddle:{...riddle,sessionToken:'00000000-0000-4000-8000-000000000002'}});
  if(kind==='locale')reduce({type:'hostInit',user:initial.user,profile,locale:'fr',gameMode:'classic',products:[]});
  if(kind==='modal')reduce({type:'openModal',modal:epoch===1?'settings':'continue'});
  if(kind==='profile')reduce({type:'profileUpdated',profile:{...profile,coins:500,username:'Latest confirmed profile'}});
 },[epoch,suspend]);
 if(suspend){window.probe.speculated=true;throw never;}
 return <main data-epoch={epoch} data-user={state.user?.uid} data-generation={state.user?.accountGeneration} data-token={state.riddle?.sessionToken} data-modal={state.modal??'none'} data-pending={recovery.pending} data-coins={state.profile?.coins} data-username={state.profile?.username}>
 {state.modal==='continue'?<ContinueModalPage balance={state.profile?.coins??0} onRecoverAttempt={capability?()=>{if(!window.oldCallback){window.oldCallback=recovery.request;void recovery.request().then(()=>window.probe.oldDone=true);}else window.controls.current();}:undefined} pending={recovery.pending} onContinue={()=>{}} onSkip={()=>{}} onOpenModal={()=>{}} commerceAvailable={false}/>:null}
 {state.modal===null?<><ControlledGuessBoard answerLength={state.riddle?.answerLength??5} currentLetters={state.currentLetters} activeSlotIndex={state.activeSlotIndex} guesses={state.guesses} hintRevealedIndices={state.hintRevealedIndices} onSelectSlot={index=>reduce({type:'selectSlot',index})}/><ControlledKeyboard letterStates={state.letterStates} onLetter={letter=>reduce({type:'typeLetter',letter})} onBackspace={()=>reduce({type:'backspace'})}/></>:null}
 </main>;
}
const root=createRoot(document.querySelector('#root'));window.retire=()=>root.unmount();root.render(<React.StrictMode><React.Suspense fallback={<div>Suspended fixture</div>}><App/></React.Suspense></React.StrictMode>);
`);
  await build({root: scratch, configFile: false, publicDir: path.join(portal, 'public'), logLevel: 'error', define: {'process.env.NODE_ENV': JSON.stringify(mode), 'import.meta.env.VITE_PLATFORM_TARGET': JSON.stringify('facebook')}, plugins: [{name: 'attempt-retirement-baseline', enforce: 'pre', async load(id) {
    if (process.env.ATTEMPT_RETIRE_BASELINE_FILE && id.endsWith('/useAttemptRecovery.ts')) return readFile(process.env.ATTEMPT_RETIRE_BASELINE_FILE, 'utf8');
  }}], build: {outDir: 'dist', minify: false, target: 'esnext'}});
  server = createServer(async (req, res) => {try {
    const name = new URL(req.url, 'http://localhost').pathname, file = path.join(scratch, 'dist', name === '/' ? 'index.html' : name);
    res.setHeader('content-type', ({'.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webm': 'audio/webm'})[path.extname(file)] ?? 'text/html');res.end(await readFile(file));
  } catch {res.writeHead(404).end();}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await (engine === 'firefox' ? firefox : chromium).launch({headless: true, ...(engine === 'firefox' && process.env.ATTEMPT_RETIRE_FIREFOX_EXECUTABLE ? {executablePath: process.env.ATTEMPT_RETIRE_FIREFOX_EXECUTABLE} : {})});
  browserVersion = browser.version();
  const contexts = ['account', 'generation', 'provider', 'question', 'locale', 'modal', 'dispatch'];
  const scenarios = process.env.ATTEMPT_RETIRE_SCENARIOS?.split(',') ?? [...contexts.flatMap(kind => ['success', 'failure', 'unavailable', 'cancelled'].map(outcome => kind + ':' + outcome)), 'aba:success', 'disable:success', 'unmount:success', 'unmount:failure', 'profile:success', 'suspended-provider:success', 'suspended-profile:success', 'active:success', 'active:failure', 'active:cancelled', 'active:unavailable'];
  for (const [width, height] of process.env.ATTEMPT_RETIRE_QUICK === '1' ? [[390, 568]] : [[390, 568], [390, 844], [1280, 844]]) for (const scenario of scenarios) {
    const context = await browser.newContext({viewport: {width, height}}), page = await context.newPage(), external = [];
    activePage = page;await context.route('**/*', route => {if (new URL(route.request().url()).origin === origin) return route.continue();external.push(route.request().url());return route.abort();});
    const metric = (name, actual, expected) => observations.push({width, height, scenario, name, actual, expected});
    await page.goto(origin + '/?scenario=' + scenario);await page.locator('.loss-video-action').click();await page.waitForFunction(() => window.probe.requests.length === 1);
    metric('one active request locks competing continuation controls', await page.locator('.loss-continue-action').isDisabled(), true);
    const [kind, outcome] = scenario.split(':'), retained = ['profile', 'active'].includes(kind) || kind.startsWith('suspended');
    if (kind === 'unmount') await page.evaluate(() => window.retire());
    else if (kind.startsWith('suspended')) {await page.evaluate(() => window.controls.speculate());await page.waitForFunction(() => window.probe.speculated);}
    else if (kind !== 'active') {await page.evaluate(() => window.controls.replace());await page.waitForFunction(() => document.querySelector('[data-epoch]')?.dataset.epoch === '1');
      if (['modal', 'aba'].includes(kind)) {await page.evaluate(() => window.controls.reopen());await page.waitForFunction(() => document.querySelector('[data-epoch]')?.dataset.epoch === '2' && document.querySelector('[data-modal]')?.dataset.modal === 'continue');}}
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    metric('retirement settles the local caller without waiting for provider completion', await page.evaluate(() => window.probe.oldDone), !retained);
    if (!retained && !['unmount', 'disable'].includes(kind)) {
      metric('replacement continuation controls are immediately usable', await page.locator('.loss-video-action').isEnabled(), true);
      const before = await page.evaluate(() => window.probe.requests.length);await page.evaluate(() => {void window.oldCallback();});
      metric('retained old callback cannot admit provider work', await page.evaluate(() => window.probe.requests.length), before);
      await page.evaluate(() => {window.controls.current();window.controls.current();});
      metric('replacement synchronous admission deduplicates repeated calls', await page.evaluate(() => window.probe.requests.length), 2);
    } else if (kind === 'disable') {
      metric('removed provider exposes no video action', await page.locator('.loss-video-action').count(), 0);
      metric('removed provider releases the paid continuation controls', await page.locator('.loss-continue-action').isEnabled(), true);
    } else if (retained) {
      await page.evaluate(() => {window.controls.current();window.controls.current();});
      metric('unchanged committed context retains one provider request', await page.evaluate(() => window.probe.requests.length), 1);
    }
    const beforeActions = await page.evaluate(() => window.probe.actions.length);await page.evaluate(() => window.finishOld());
    await page.waitForFunction(() => window.probe.oldDone);await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (!retained) {
      metric('retired receipt cannot change notice, balance or attempts', await page.evaluate(before => window.probe.actions.slice(before), beforeActions), []);
      if (!['unmount', 'disable'].includes(kind)) {
        metric('old finally cannot unlock the replacement request', await page.locator('[data-pending]').getAttribute('data-pending'), 'true');
        await page.evaluate(() => window.finishNew());await page.waitForFunction(() => window.probe.newDone);
        if (await page.evaluate(() => window.probe.requests.length === 2)) await page.waitForFunction(() => document.querySelector('[data-modal]')?.dataset.modal === 'none');
        metric('replacement continuation restores its editable board', await page.locator('[data-modal]').getAttribute('data-modal'), 'none');
        metric('current continuation applies its authoritative balance', await page.locator('[data-coins]').getAttribute('data-coins'), '350');
      }
    } else {
      metric('owned completion applies only its expected grant', await page.locator('[data-modal]').getAttribute('data-modal'), outcome === 'success' ? 'none' : 'continue');
      metric('suspended profile cannot enter the accepted receipt', await page.locator('[data-username]').getAttribute('data-username'), kind === 'profile' ? 'Latest confirmed profile' : 'Guest Solver');
      metric('owned failures keep the existing translated recovery notice', await page.evaluate(() => window.probe.actions.filter(x => x.action.type === 'setNotice' && x.action.notice !== null).map(x => x.action.notice)), ['failure', 'unavailable'].includes(outcome) ? ['ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE'] : []);
    }
    if (await page.locator('.keyboard').count()) {
      await page.locator('.keyboard').getByRole('button', {name: 'P', exact: true}).click();
      metric('continued question accepts native keyboard-button input', await page.locator('.guess-row').first().textContent().then(text => text.includes('P')), true);
    }
    metric('no browser errors', await page.evaluate(() => window.probe.errors), []);
    metric('no unhandled rejections', await page.evaluate(() => window.probe.unhandled), []);
    metric('no external traffic', external, []);
    await page.screenshot({path: path.join(output, scenario.replaceAll(':', '-') + '-' + width + '-' + height + '.png')});await context.close();
  }
} catch (error) {
  if (activePage) {await writeFile(path.join(output, 'failure.json'), JSON.stringify(await activePage.evaluate(() => ({body: document.body.innerText, probe: window.probe})), null, 2));await activePage.screenshot({path: path.join(output, 'failure.png')});}
  throw error;
} finally {
  await browser?.close();if (server) await new Promise(resolve => server.close(resolve));await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
}
const failures = observations.filter(row => JSON.stringify(row.actual) !== JSON.stringify(row.expected));
console.log(JSON.stringify({engine, mode, browserVersion, cases: new Set(observations.map(row => [row.width, row.height, row.scenario].join('/'))).size, checks: observations.length, failures}, null, 2));
assert.equal(failures.length, 0, 'Continuation ownership releases retired controls and rejects stale completion');
