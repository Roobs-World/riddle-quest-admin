import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium, firefox} from '@playwright/test';

const portal = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.env.HOST_COMMIT_REACT_MODE ?? 'development';
assert.ok(['development', 'production'].includes(mode));
const engine = process.env.HOST_COMMIT_BROWSER ?? 'chromium';
assert.ok(['chromium', 'firefox'].includes(engine));
const output = path.resolve(process.env.HOST_COMMIT_REPORT_DIR ?? path.join(portal, 'builds/test-evidence/host-riddle-commit-retirement-2026-10-06', engine + '-' + mode));
await mkdir(output, {recursive: true});
await mkdir(path.join(portal, 'node_modules/.cache'), {recursive: true});
const scratch = await mkdtemp(path.join(portal, 'node_modules/.cache/host-riddle-commit-'));
const observations = [];
let browser, server, activePage;
try {
  await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
  await writeFile(path.join(scratch, 'index.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';
import {useHostRiddleLifecycle} from ${JSON.stringify(path.join(portal, "src/gameplay/hooks/browser/useHostRiddleLifecycle.ts"))};
import {GameFrameApp} from ${JSON.stringify(path.join(portal, "src/gameplay/components/GameFrameApp.tsx"))};
import {createFakeHostServices} from ${JSON.stringify(path.join(portal, "src/gameplay/fixtures/fakeServices.ts"))};
import {applyPlayerPreferences} from ${JSON.stringify(path.join(portal, "src/settings/browser/playerPreferences.ts"))};
import {dispatchLocalBridge,HOST_TO_GAME_EVENT} from ${JSON.stringify(path.join(portal, "src/platform/bridge/browser/localBridge.ts"))};
import {createGuidanceStorageKey,createTooltipTourStorageKey,TOOLTIP_KEYS} from ${JSON.stringify(path.join(portal, "src/onboarding/browser/guidanceConfig.ts"))};
import ${JSON.stringify(path.join(portal, "src/app/styles/game.css"))};
window.__RIDDLE_QUEST_BROWSER_TEST__=true;applyPlayerPreferences({locale:'en',muted:true,reducedMotion:true,onboardingComplete:true});
const scenario=new URLSearchParams(location.search).get('scenario'),[kind,outcome]=scenario.split(':');
window.probe={posts:[],operations:[],notices:[],reads:[],errors:[],unhandled:[],activity:0,retired:false};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
for(const uid of ['Alice','Bob']){sessionStorage.setItem(createGuidanceStorageKey('welcomeSession',uid),'seen');for(const tour of ['gameTour','profileTour'])localStorage.setItem(createTooltipTourStorageKey(tour,uid),'seen');for(const key of Object.keys(TOOLTIP_KEYS))localStorage.setItem(createGuidanceStorageKey('tooltipSeen:'+key,uid),'seen');}
const fixture=createFakeHostServices(),fixtureProfile=await fixture.loadProfile('jest-guest'),original=await fixture.loadRiddle({gameMode:'classic',locale:'en'}),replacement={...original,text:'What has a face and hands but no arms?',sessionToken:'00000000-0000-4000-8000-000000000099',index:2};
const dailyError=()=>Object.assign(new Error('Daily completed'),{code:'daily-completed'});
let release,fail,initialReads=0;const held=new Promise((resolve,reject)=>{release=()=>resolve(original);fail=()=>reject(outcome==='daily-result'?dailyError():new Error('Retired transport unavailable'));});
function load(input){const epoch=document.querySelector('[data-epoch]')?.dataset.epoch;window.probe.reads.push({epoch,...input});
 if(epoch==='0'){initialReads++;if(outcome==='daily-fallback'&&initialReads===1)return Promise.reject(dailyError());if(initialReads<=(outcome==='daily-fallback'?2:1))return held;}
 return Promise.resolve(replacement);}
const oldServices={loadRiddle:load},nextServices={loadRiddle:load},guardA=()=>true,guardB=()=>true,recoverA=()=>{},recoverB=()=>{};
const postToGame=message=>{window.probe.posts.push({epoch:document.querySelector('[data-epoch]')?.dataset.epoch,message});dispatchLocalBridge(HOST_TO_GAME_EVENT,{...message,sentAt:Date.now()});};
const postOperation=(...args)=>window.probe.operations.push(args),setNotice=notice=>window.probe.notices.push(notice),withActivity=async operation=>{window.probe.activity++;try{return await operation();}finally{window.probe.activity--;}};
const never=new Promise(()=>{});
function App(){const [epoch,setEpoch]=React.useState(0),[suspend,setSuspend]=React.useState(false);
 const changed=epoch>0,locale=changed&&(kind==='locale'||kind==='suspended-locale')?'fr':'en',owner=(changed&&kind==='owner'||epoch===1&&kind==='aba')?'Bob':'Alice',services=changed&&(kind==='provider'||kind==='suspended-provider')?nextServices:oldServices;
 const profile={...fixtureProfile,coins:changed&&(kind==='profile'||kind.startsWith('suspended'))?350:100};
 const lifecycle=useHostRiddleLifecycle({userId:owner,accountGeneration:changed&&kind==='generation'?2:1,profile,initialGameMode:'classic',locale,services,canUsePreparedQuestions:changed&&kind==='guard'?guardB:guardA,withActivity,postToGame,postOperation,configurationWarning:null,setNotice,onRecoveryAttempt:changed&&kind==='callback'?recoverB:recoverA});
 React.useLayoutEffect(()=>{window.controls={start:()=>{window.oldCallback=lifecycle.loadRiddle;window.oldResult=lifecycle.loadRiddle({gameMode:outcome?.startsWith('daily')?'challenge':'classic',locale:'en'},'old-read').then(value=>window.probe.oldAccepted=value);},replace:()=>setEpoch(1),return:()=>setEpoch(2),current:()=>lifecycle.loadRiddle({gameMode:'classic',locale},'current-read').then(value=>window.probe.currentAccepted=value),speculate:()=>React.startTransition(()=>{setSuspend(true);setEpoch(1);}),settle:()=>outcome==='failure'||outcome==='daily-result'?fail():release()};
  if(epoch>0&&!suspend){window.probe.committed=true;if(outcome==='new-layout'||outcome==='new-automatic'){const input={gameMode:'classic',locale};lifecycle.loadRiddle(input,outcome==='new-layout'?'current-read':undefined).then(value=>window.probe.currentAccepted=value);}if(kind!=='aba'||epoch===2)window.controls.settle();}
 },[epoch,lifecycle.loadRiddle,suspend]);
 React.useEffect(()=>{postToGame({type:'host:init',payload:{protocolVersion:1,sessionId:'commit-probe',locale,user:{uid:owner,displayName:owner,isAnonymous:true,accountGeneration:changed&&kind==='generation'?2:1},profile,gameMode:'classic',products:[]}});},[epoch]);
 if(suspend){window.probe.speculated=true;throw never;}
 return <div data-epoch={epoch} data-owner={owner} data-locale={locale}><output data-ready>{String(lifecycle.startupComplete)}</output><GameFrameApp localBridge economyAvailable={false}/></div>;
}
const root=createRoot(document.querySelector('#root'));window.retire=()=>{root.unmount();window.probe.retired=true;outcome==='failure'?fail():release();};root.render(<React.StrictMode><React.Suspense fallback={<div>Suspended fixture</div>}><App/></React.Suspense></React.StrictMode>);
`);
  await build({root: scratch, configFile: false, publicDir: path.join(portal, 'public'), logLevel: 'error', define: {'process.env.NODE_ENV': JSON.stringify(mode)}, plugins: [{name: 'host-commit-baseline', enforce: 'pre', async load(id) {
    if (process.env.HOST_COMMIT_BASELINE_FILE && id.endsWith('/useHostRiddleLifecycle.ts')) return readFile(process.env.HOST_COMMIT_BASELINE_FILE, 'utf8');
  }}], build: {outDir: 'dist', minify: false, target: 'esnext'}});
  server = createServer(async (req, res) => {try {
    const pathname = new URL(req.url, 'http://localhost').pathname, file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
    res.setHeader('content-type', ({'.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webm': 'audio/webm', '.woff2': 'font/woff2'})[path.extname(file)] ?? 'text/html');res.end(await readFile(file));
  } catch {res.writeHead(404).end();}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await (engine === 'firefox' ? firefox : chromium).launch({headless: true, ...(engine === 'firefox' && process.env.HOST_COMMIT_FIREFOX_EXECUTABLE ? {executablePath: process.env.HOST_COMMIT_FIREFOX_EXECUTABLE} : {})});
  const contexts = ['locale', 'owner', 'generation', 'provider'];
  const scenarios = process.env.HOST_COMMIT_SCENARIOS?.split(',') ?? [...contexts.flatMap(kind => ['success', 'failure', 'daily-result', 'daily-fallback', 'new-layout', 'new-automatic'].map(outcome => kind + ':' + outcome)), 'profile:success', 'guard:success', 'callback:success', 'suspended-locale:success', 'suspended-provider:success', 'unmount:success', 'unmount:failure', 'unmount:daily-fallback', 'aba:success'];
  for (const [width, height] of process.env.HOST_COMMIT_QUICK === '1' ? [[390, 568]] : [[390, 568], [390, 844], [1280, 844]]) for (const scenario of scenarios) {
    const context = await browser.newContext({viewport: {width, height}}), page = await context.newPage(), external = [];
    activePage = page;
    await context.route('**/*', route => {if (new URL(route.request().url()).origin === origin) return route.continue();external.push(route.request().url());return route.abort();});
    const metric = (name, actual, expected) => observations.push({width, height, scenario, name, actual, expected});
    await page.goto(origin + '/?scenario=' + scenario);await page.waitForFunction(() => Boolean(window.controls));await page.evaluate(() => window.controls.start());
    const [kind, outcome] = scenario.split(':');await page.waitForFunction(count => window.probe.reads.length >= count, outcome === 'daily-fallback' ? 2 : 1);
    if (kind === 'unmount') await page.evaluate(() => window.retire());
    else if (kind.startsWith('suspended')) {await page.evaluate(() => window.controls.speculate());await page.waitForFunction(() => window.probe.speculated);await page.evaluate(() => window.controls.settle());}
    else {await page.evaluate(() => window.controls.replace());if(kind==='aba'){await page.waitForFunction(()=>document.querySelector('[data-epoch]')?.dataset.epoch==='1');await page.evaluate(()=>window.controls.return());}}
    await page.waitForFunction(() => window.probe.oldAccepted !== undefined);
    const retained = ['profile', 'guard', 'callback'].includes(kind) || kind.startsWith('suspended');
    metric('old receipt accepted only while its committed content context remains owned', await page.evaluate(() => window.probe.oldAccepted), retained);
    metric('old operation acknowledgement follows the same ownership', await page.evaluate(() => window.probe.operations.filter(x => x[0] === 'old-read').length), retained ? 1 : 0);
    metric('old question cannot publish after committed retirement', await page.evaluate(() => window.probe.posts.filter(x => x.message.type === 'host:riddleLoaded' && x.message.requestId === 'old-read').length), retained ? 1 : 0);
    metric('late failure cannot publish a retired notice', await page.evaluate(() => window.probe.notices.filter(x => x !== null)), []);
    if (!retained && kind !== 'unmount') {
      if (!outcome.startsWith('new-')) await page.evaluate(() => window.controls.current());
      await page.waitForFunction(() => window.probe.currentAccepted !== undefined);
      metric('replacement request survives preceding passive cleanup', await page.evaluate(() => window.probe.currentAccepted), true);
      await page.getByRole('heading', {name: 'What has a face and hands but no arms?', exact: true}).waitFor();
      metric('replacement startup stays playable', await page.locator('[data-ready]').textContent(), 'true');
      metric('retained old callback cannot admit provider work in a new context', await page.evaluate(async () => {const before = window.probe.reads.length;const accepted = await window.oldCallback({gameMode: 'classic', locale: 'en'}, 'retained-old-callback');return {accepted, reads: window.probe.reads.length - before};}), {accepted: false, reads: 0});
      if (outcome === 'daily-result') metric('obsolete completed Daily cannot admit a Classic fallback', await page.evaluate(() => window.probe.reads.filter(x => x.epoch === '0').map(x => x.gameMode)), ['challenge']);
    } else if (retained) {
      await page.getByRole('heading', {name: 'What has keys but cannot open doors?', exact: true}).waitFor();
      metric('unrelated renders preserve one admitted provider read', await page.evaluate(() => window.probe.reads.length), 1);
      metric('only committed profile may accompany a receipt', await page.evaluate(() => window.probe.posts.find(x => x.message.type === 'host:riddleLoaded').message.payload.profile.coins), kind === 'profile' ? 350 : 100);
      if (kind.startsWith('suspended')) metric('speculative replacement never committed', await page.locator('[data-epoch]').getAttribute('data-epoch'), '0');
    }
    if (kind !== 'unmount') {
      if (await page.getByRole('button', {name: "Let's Play", exact: true}).count()) await page.getByRole('button', {name: "Let's Play", exact: true}).click();
      await page.locator('.guess-row button:not([disabled])').first().click();await page.keyboard.type('p');
      metric('owned question accepts native answer input', await page.locator('.guess-row').first().textContent().then(text => text.includes('P')), true);
    }
    metric('retired loading activity is released', await page.evaluate(() => window.probe.activity), 0);
    metric('no browser errors', await page.evaluate(() => window.probe.errors), []);
    metric('no unhandled rejections', await page.evaluate(() => window.probe.unhandled), []);
    metric('no external traffic', external, []);
    await page.screenshot({path: path.join(output, scenario.replaceAll(':', '-') + '-' + width + '-' + height + '.png')});
    await context.close();
  }
} catch (error) {
  if (activePage) {await writeFile(path.join(output, 'failure.json'), JSON.stringify(await activePage.evaluate(() => ({body:document.body.innerText,probe:window.probe})), null, 2));await activePage.screenshot({path:path.join(output, 'failure.png')});}
  throw error;
} finally {
  await browser?.close();if (server) await new Promise(resolve => server.close(resolve));await rm(scratch, {recursive: true, force: true});
  await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
}
const failures = observations.filter(row => JSON.stringify(row.actual) !== JSON.stringify(row.expected));
console.log(JSON.stringify({engine, mode, cases: new Set(observations.map(row => [row.width, row.height, row.scenario].join('/'))).size, checks: observations.length, failures}, null, 2));
assert.equal(failures.length, 0, 'Committed content ownership fences delivery and retains valid requests');
