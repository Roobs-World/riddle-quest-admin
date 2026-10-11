import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from '../../node_modules/.pnpm/vite@8.3.1_@types+node@26.6.3_@vitejs+devtools@0.7.6_yaml@2.9.1/node_modules/vite/dist/node/index.js';
import {chromium, firefox} from '../../node_modules/.pnpm/@playwright+test@1.63.0/node_modules/@playwright/test/index.mjs';

const portal = path.resolve('packages/portal');
const mode = process.env.HOST_COMMIT_REACT_MODE ?? 'development';
assert.ok(['development', 'production'].includes(mode));
const engine = process.env.HOST_COMMIT_BROWSER ?? 'chromium';
assert.ok(['chromium', 'firefox'].includes(engine));
const output = path.resolve(process.env.HOST_COMMIT_REPORT_DIR ?? path.join(portal, '../../artifacts/host-riddle-commit-retirement-2026-10-06', engine + '-' + mode));
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
import {useHostRiddleLifecycle} from ${JSON.stringify(path.join(portal,'src/play/useHostRiddleLifecycle.ts'))};
window.probe={posts:[],operations:[],notices:[],reads:[],errors:[],unhandled:[],activity:0,mode:'ready'};
window.addEventListener('error',e=>window.probe.errors.push(String(e.error??e.message)));window.addEventListener('unhandledrejection',e=>window.probe.unhandled.push(String(e.reason)));
const parent={riddleId:'classic_1',text:'Current question',answerLength:5,sessionToken:'00000000-0000-4000-8000-000000000001',gameMode:'classic',index:1};const next={...parent,index:2,riddleId:'classic_2',text:'Preview question',sessionToken:'00000000-0000-4000-8000-000000000002'};
const held={};function load(input,signal){window.probe.reads.push({input,signal});const index=input.classicIndex??1;if(window.probe.mode==='preview-failure'&&index===2)return Promise.reject(new Error('Optional unavailable'));if(window.probe.mode==='canonical-failure'&&index===1)return Promise.reject(new Error('Canonical unavailable'));if(window.probe.mode==='held-preview'&&index===2||window.probe.mode==='held-canonical'&&index===1)return new Promise(resolve=>{held[index]=()=>resolve(index===2?next:parent);});return Promise.resolve(index===2?next:{...parent,index,riddleId:'classic_'+index,sessionToken:index===1?parent.sessionToken:'00000000-0000-4000-8000-000000000003'});}
const servicesA={loadRiddle:load},servicesB={loadRiddle:load};const postToGame=message=>window.probe.posts.push(message),postOperation=(...args)=>window.probe.operations.push(args),withActivity=async fn=>{window.probe.activity++;try{return await fn();}finally{window.probe.activity--;}};
function App(){const [epoch,setEpoch]=React.useState(0);const lifecycle=useHostRiddleLifecycle({userId:epoch===1?'Bob':'Alice',profile:{coins:600,classicIndex:1},initialGameMode:'classic',locale:'en',services:epoch===2?servicesB:servicesA,withActivity,postToGame,postOperation,configurationWarning:null,setNotice:notice=>window.probe.notices.push(notice),onRecoveryAttempt:()=>{}});
 React.useLayoutEffect(()=>{window.controls={initial:()=>lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:1},'initial'),preview:()=>{window.previewResult=undefined;window.previewPromise=lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:2},'skip-preview-owned').then(value=>window.previewResult=value);},canonical:(index=1)=>{window.canonicalResult=undefined;window.canonicalPromise=lifecycle.loadRiddle({gameMode:'classic',locale:'en',classicIndex:index},'canonical-owned').then(value=>window.canonicalResult=value);},replaceOwner:()=>setEpoch(1),replaceProvider:()=>setEpoch(2),release:index=>held[index]?.(),mode:value=>window.probe.mode=value};},[lifecycle.loadRiddle]);
 return <main data-epoch={epoch}><h1>Host delivery ownership</h1><output data-ready>{String(lifecycle.startupComplete)}</output><output data-unavailable>{String(lifecycle.startupUnavailable)}</output><button onClick={()=>window.controls.preview()}>Optional Skip preview</button></main>;
}createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
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
  for(const width of [390,1280])for(const scenario of ['success','failure','held-canonical','deadline','owner','provider','late-canonical','recovery']){
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();activePage=page;await page.clock.install();
    const metric=(name,actual,expected)=>observations.push({width,scenario,name,actual,expected});
    await page.goto(origin);await page.waitForFunction(()=>window.controls);await page.evaluate(()=>window.controls.initial());await page.waitForFunction(()=>window.probe.posts.some(x=>x.requestId==='initial'));
    if(scenario==='held-canonical'){await page.evaluate(()=>{window.controls.mode('held-canonical');window.controls.canonical();});await page.waitForFunction(()=>window.probe.reads.length===2);await page.evaluate(()=>window.controls.mode('preview-failure'));}
    else if(['deadline','owner','provider','late-canonical'].includes(scenario))await page.evaluate(()=>window.controls.mode('held-preview'));
    else if(scenario==='failure'||scenario==='recovery')await page.evaluate(()=>window.controls.mode('preview-failure'));
    await page.getByRole('button',{name:'Optional Skip preview'}).click();await page.waitForFunction(()=>window.probe.reads.some(x=>x.input.classicIndex===2));
    if(scenario==='owner'||scenario==='provider'){await page.evaluate(scenario=>scenario==='owner'?window.controls.replaceOwner():window.controls.replaceProvider(),scenario);await page.waitForFunction(()=>document.querySelector('[data-epoch]').dataset.epoch!=='0');}
    if(scenario==='late-canonical'){await page.evaluate(()=>{window.controls.mode('ready');window.controls.canonical(3);});await page.waitForFunction(()=>window.canonicalResult===true);await page.evaluate(()=>window.controls.release(2));}
    if(scenario==='deadline')await page.clock.runFor(15001);
    await page.waitForFunction(()=>window.previewResult!==undefined);
    metric('optional outcome follows current ownership',await page.evaluate(()=>window.previewResult),scenario==='success');
    metric('preview publication follows ownership',await page.evaluate(()=>window.probe.posts.filter(x=>x.requestId==='skip-preview-owned').length),scenario==='success'?1:0);
    if(scenario==='held-canonical'){metric('held canonical signal survives failed preview',await page.evaluate(()=>window.probe.reads[1].signal.aborted),false);await page.evaluate(()=>window.controls.release(1));await page.waitForFunction(()=>window.canonicalResult===true);metric('held canonical delivers normally',await page.evaluate(()=>window.canonicalResult),true);}
    if(scenario==='recovery'){await page.evaluate(()=>{window.controls.mode('canonical-failure');window.controls.canonical(1);});await page.waitForFunction(()=>window.canonicalResult===false);await page.evaluate(()=>window.controls.mode('ready'));await page.clock.runFor(250);metric('automatic retry retains current index',await page.evaluate(()=>window.probe.reads.at(-1).input.classicIndex),1);}
    if(scenario==='deadline'){await page.evaluate(()=>window.controls.release(2));await page.clock.runFor(0);metric('late expired preview cannot publish',await page.evaluate(()=>window.probe.posts.filter(x=>x.requestId==='skip-preview-owned').length),0);}
    metric('optional failure emits no failed operation',await page.evaluate(()=>window.probe.operations.filter(x=>x[0]==='skip-preview-owned')),[]);
    metric('activity released',await page.evaluate(()=>window.probe.activity),0);metric('no browser errors',await page.evaluate(()=>[...window.probe.errors,...window.probe.unhandled]),[]);
    await page.screenshot({path:path.join(output,scenario+'-'+width+'.png')});await context.close();
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
