import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";
import {collectFirebaseFixtureExports} from "./firebase-fixture-exports.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mode = process.env.GAMEPLAY_RECEIPT_REACT_MODE ?? "production";
assert.ok(["development", "production"].includes(mode));
const adapterPath = path.join(root, "src/web/play/firebaseServices.ts");
const output = path.resolve(process.env.GAMEPLAY_RECEIPT_REPORT_DIR ?? path.join(root, "builds/test-evidence/game-authority-2026-10-03"));
const baseline = process.env.GAMEPLAY_RECEIPT_BASELINE_SOURCE;
const contentBaseline = process.env.GAMEPLAY_CONTENT_BASELINE_SOURCE;
const paidBaseline = process.env.GAMEPLAY_PAID_BASELINE_SOURCE;
const activityBaseline = process.env.GAMEPLAY_ACTIVITY_BASELINE_SOURCE;
const activityPath=path.join(root,"src/web/play/useHostOperations.ts");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/gameplay-receipts-"));
await mkdir(output, {recursive: true});
const source = await readFile(adapterPath, "utf8");
const imports = collectFirebaseFixtureExports({adapterSource: source, firebaseModulePath: path.join(root, "src/web/firebase.ts")});
const receipt = {attempts: 1, isCorrect: true, coinsEarned: 50, newlyUnlockedAchievementIds: [],
  rewardBreakdown: {newBalance: 350, totalAwarded: 50}};
await writeFile(path.join(scratch, "firebase.ts"), `
export const auth={currentUser:{uid:'Alice',displayName:'Alice',email:null,photoURL:null,isAnonymous:false,
  metadata:{creationTime:'2026-01-01T00:00:00.000Z'}}};
const receipt=${JSON.stringify(receipt)};
export const loadUserDocument=async uid=>{
  window.probe.reads.push(uid);
  if(window.probe.hold)return new Promise(resolve=>window.probe.pending.push({uid,resolve}));
  if(window.probe.fail)throw new Error('Injected optional profile outage');
  await new Promise(resolve=>setTimeout(resolve,window.probe.delayMs));return {coins:350,progress:{classicIndex:window.probe.index}};
};
export const completeGame=async()=>({data:receipt});
export const spendCoins=async()=>{
  window.probe.authorityCalls++;
  if(window.probe.holdAuthority)return new Promise(resolve=>window.probe.pendingAuthority.push(resolve));
  return {data:{newCoins:275}};
};
export const getCurrentClassicRiddle=async input=>{
  window.probe.contentCalls.push({uid:auth.currentUser.uid,input});
  if(window.probe.holdContent)return new Promise(resolve=>window.probe.pendingContent.push({input,resolve}));
  return window.contentReceipt(input.classicIndex);
};
export const getClassicRiddleBuffer=async()=>{
  window.probe.bufferCalls.push(auth.currentUser.uid);
  if(window.probe.holdBuffer)return new Promise(resolve=>window.probe.pendingBuffers.push(resolve));
  return {data:{confirmedClassicIndex:window.probe.index,riddles:[]}};
};
${imports.filter(name => !["auth", "loadUserDocument", "completeGame", "spendCoins", "getCurrentClassicRiddle", "getClassicRiddleBuffer"].includes(name))
  .map(name => `export const ${name}=async()=>({data:{}});`).join("\n")}
`);
await writeFile(path.join(scratch, "auth.ts"), `
export const onAuthStateChanged=(auth,callback)=>{
  window.probe.observers.push(callback);return ()=>window.probe.stops++;
};
export const signOut=async auth=>{auth.currentUser=null;};
`);
await writeFile(path.join(scratch, "main.ts"), `
import {createFirebaseHostServices} from ${JSON.stringify(adapterPath)};
import {auth} from './firebase';
import React from 'react';import {createRoot} from 'react-dom/client';
import {useHostAuthSession} from ${JSON.stringify(path.join(root,"src/web/play/useHostAuthSession.ts"))};
import {useHostOperations} from ${JSON.stringify(activityPath)};
window.probe={reads:[],pending:[],observers:[],stops:0,delayMs:0,hold:false,fail:false,snapshots:[],index:17,contentCalls:[],pendingContent:[],bufferCalls:[],pendingBuffers:[],holdContent:false,holdBuffer:false,authorityCalls:0,holdAuthority:false,pendingAuthority:[]};
window.services=createFirebaseHostServices();
window.measure=async kind=>{
  const started=performance.now();
  const value=kind==='completion'?await window.services.completeGame({riddleId:'riddle-1',gameMode:'classic',sessionToken:'owned-session'}):
    await window.services.spendCoins({reason:'continue',requestId:'owned-request',amount:25,riddleId:'riddle-1',gameMode:'classic',sessionToken:'owned-session'});
  const elapsedMs=performance.now()-started;
  document.querySelector('output').textContent=kind+' confirmed';return {kind,elapsedMs,value};
};
window.select=uid=>{
  auth.currentUser=uid===null?null:{uid,displayName:uid,email:null,photoURL:null,isAnonymous:false,metadata:{creationTime:'2026-01-01T00:00:00.000Z'}};
  window.probe.observers.at(-1)(auth.currentUser);
};
window.subscribe=()=>window.services.auth.subscribe(snapshot=>window.probe.snapshots.push(snapshot));
window.finish=(uid,coins)=>{window.probe.pending.find(entry=>entry.uid===uid).resolve({coins});};
window.contentReceipt=(index,canonical)=>({data:{...(canonical?{classicIndex:canonical}:{}),challenge:{totalQuestions:1,questions:[{
  riddleId:'classic-'+index,text:'Issued puzzle '+index,answerLength:5,questionNumber:1,
  sessionToken:'00000000-0000-4000-8000-'+String(index).padStart(12,'0'),
  attemptsUsed:0,hasUsedContinue:false,awaitingContinue:false
}]}}});
window.loadContent=classicIndex=>{
  window.contentResult=null;
  window.contentPromise=window.services.loadRiddle({gameMode:'classic',locale:'en',...(classicIndex===undefined?{}:{classicIndex}),
    riddleId:'classic-17',sessionToken:'00000000-0000-4000-8000-000000000017'})
    .then(value=>{window.contentResult=value;document.querySelector('output').textContent='Classic '+value.index;})
    .catch(error=>{window.contentResult={code:error.code};});
};
window.releaseContent=canonical=>{
  const held=window.probe.pendingContent.shift();held.resolve(window.contentReceipt(canonical??held.input.classicIndex,canonical));
};
function ActivityHost(){
  const auth=useHostAuthSession({services:window.services,postToGame:()=>{}});
  const activity=useHostOperations({postOperation:()=>{},owner:auth.captureAccount});
  window.probe.startActivity=()=>{
    const owns=auth.captureAccount(auth.snapshot.user?.uid);
    return activity.withActivity(()=>window.services.spendCoins({reason:'continue',requestId:'activity-paid-request',amount:25,
      riddleId:'classic-17',gameMode:'classic',sessionToken:'owned-session'}))
      .then(value=>{if(owns())window.probe.activityReceipt=value;}).catch(error=>{if(owns())window.probe.activityError=error.code;});
  };
  React.useEffect(()=>{window.probe.activityMounted=true;return()=>{window.probe.activityMounted=false;};},[]);
  return React.createElement('p',{'data-activity':activity.activityActive,'data-owner':auth.snapshot.user?.uid},'Activity '+activity.activityActive);
}
window.mountActivity=()=>{
  const node=document.createElement('div');node.id='activity';document.body.appendChild(node);
  const root=createRoot(node);root.render(React.createElement(React.StrictMode,null,React.createElement(ActivityHost)));
  window.disposeActivity=()=>{root.unmount();node.remove();};
};
`);
await writeFile(path.join(scratch, "index.html"), '<html><body><output>Waiting for receipt</output><script type="module" src="/main.ts"></script></body></html>');
let server, browser;
const samples = [];
try {
  await build({root: scratch, configFile: false, logLevel: "error", define: {"process.env.NODE_ENV": JSON.stringify(mode)}, plugins: [{
    name: "injected-gameplay-authority", enforce: "pre",
    resolveId(id, importer) {
      if (importer === adapterPath && id === "../firebase") return path.join(scratch, "firebase.ts");
      if (importer === adapterPath && id === "firebase/auth") return path.join(scratch, "auth.ts");
    },
    async load(id) {
      if ((baseline || contentBaseline || paidBaseline) && id === adapterPath) return readFile(baseline || contentBaseline || paidBaseline, "utf8");
      if (activityBaseline && id === activityPath) return readFile(activityBaseline,"utf8");
    },
  }], build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const file = path.join(scratch, "dist", pathname === "/" ? "index.html" : pathname);
      response.writeHead(200, {"content-type": path.extname(file) === ".js" ? "text/javascript" : "text/html"});
      response.end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({headless: true});
  for (const width of [1280, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {window.probe.delayMs = 300;});
    for (const kind of ["completion", "spend"]) {
      const timings = [];
      for (let run = 0; run < 5; run++) {
        const sample = await page.evaluate(kind => window.measure(kind), kind);
        timings.push(sample.elapsedMs);
        assert.deepEqual(sample.value, kind === "completion" ? receipt : {newCoins: 275});
        assert.equal(await page.locator("output").innerText(), `${kind} confirmed`);
      }
      timings.sort((a, b) => a - b);
      samples.push({width, kind, optionalProfileDelayMs: 300, timingsMs: timings, medianMs: timings[2]});
      if (!baseline) assert.ok(timings[2] < 150, "Committed receipts must not wait for the optional 300ms read");
    }
    // Finish measurement reads before exercising held responses and account replacement.
    await page.waitForTimeout(350);
    if (!baseline) {
      await page.evaluate(() => {window.probe.fail = true;});
      for (const kind of ["completion", "spend"])
        assert.deepEqual((await page.evaluate(kind => window.measure(kind), kind)).value,
          kind === "completion" ? receipt : {newCoins: 275});
      await page.evaluate(() => {
        window.probe.fail = false;window.probe.hold = true;
        window.stop = window.subscribe();window.select('Alice');window.select('Bob');window.finish('Bob',800);
      });
      await page.waitForFunction(() => window.probe.snapshots.at(-1).profile?.coins === 800);
      await page.evaluate(() => window.finish('Alice',10));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.equal(await page.evaluate(() => window.probe.snapshots.at(-1).user.uid), "Bob");
      assert.equal(await page.evaluate(() => window.probe.snapshots.at(-1).profile.coins), 800);
      await page.evaluate(() => {
        window.retired=window.probe.observers[0];window.stop();window.stop=window.subscribe();window.select('Bob');
        window.retired({uid:'Alice',metadata:{creationTime:'2026-01-01T00:00:00.000Z'},isAnonymous:false});
      });
      assert.equal(await page.evaluate(() => window.probe.snapshots.at(-1).user.uid), "Bob");
      await page.evaluate(() => window.stop());
      assert.equal(await page.evaluate(() => window.probe.stops), 2);
      assert.deepEqual(errors, []);
    }
    if (!baseline) {
      await page.reload();
      await page.evaluate(() => {window.stop=window.subscribe();window.select('Alice');});
      await page.waitForFunction(() => window.probe.snapshots.at(-1).profile?.classicIndex === 17);
      await page.evaluate(() => {window.probe.holdContent=true;window.loadContent();window.probe.index=18;window.select('Alice');});
      await page.waitForFunction(() => window.probe.snapshots.at(-1).profile?.classicIndex === 18);
      await page.evaluate(() => window.releaseContent());
      await page.waitForFunction(() => window.contentResult !== null);
      assert.equal(await page.evaluate(() => window.contentResult.index), 17, 'A later profile cannot relabel the admitted legacy question');
      assert.equal(await page.locator('output').innerText(), 'Classic 17');
      await page.evaluate(() => {window.loadContent(17);window.releaseContent(18);});
      await page.waitForFunction(() => window.contentResult !== null);
      assert.equal(await page.evaluate(() => window.contentResult.index), 18, 'Canonical terminal recovery must override the old request hint');
      const buffersBeforeReplacement=await page.evaluate(() => window.probe.bufferCalls.length);
      await page.evaluate(() => {window.loadContent(17);window.select('Bob');window.releaseContent();});
      await page.waitForFunction(() => window.contentResult !== null);
      assert.deepEqual(await page.evaluate(() => window.contentResult), {code:'cancelled'});
      assert.equal(await page.evaluate(() => window.probe.bufferCalls.length), buffersBeforeReplacement, 'Retired receipts cannot start a new account buffer read');
      await page.reload();
      await page.evaluate(() => {
        window.probe.holdBuffer=true;window.services.preloadInitialRiddles('en');
        window.authorityResult=null;
        window.authorityPromise=window.services.loadRiddle({gameMode:'classic',locale:'en',authoritative:true}).then(value=>{window.authorityResult=value;document.querySelector('output').textContent='Classic '+value.index+' recovery confirmed';});
      });
      await page.waitForFunction(() => window.probe.pendingBuffers.length === 2, undefined, {timeout:3000});
      await page.evaluate(() => {
        window.probe.pendingBuffers[1]({data:{confirmedClassicIndex:18,riddles:[{
          classicIndex:18,expiresAtMs:Date.now()+60000,question:window.contentReceipt(18).data.challenge.questions[0],
        }]}});
      });
      await page.waitForFunction(() => window.authorityResult !== null);
      assert.equal(await page.evaluate(() => window.authorityResult.index), 18);
      await page.evaluate(() => window.probe.pendingBuffers[0]({data:{confirmedClassicIndex:17,riddles:[]}}));
      assert.deepEqual(errors, []);
      await page.screenshot({path:path.join(output, `riddle-ownership-${width}.png`)});
      await page.reload();
      await page.evaluate(()=>{
        window.probe.holdAuthority=true;window.probe.sharedResults=[];
        for(let retry=0;retry<3;retry++)window.services.spendCoins({reason:'continue',requestId:'shared-request',amount:25,
          riddleId:'classic-17',gameMode:'classic',sessionToken:'owned-session'}).then(value=>window.probe.sharedResults.push(value));
      });
      assert.equal(await page.evaluate(()=>window.probe.authorityCalls),1,'Repeated paid retries must share one pending SDK call');
      await page.evaluate(()=>window.probe.pendingAuthority[0]({data:{newCoins:275}}));
      await page.waitForFunction(()=>window.probe.sharedResults.length===3);
      assert.deepEqual(await page.evaluate(()=>window.probe.sharedResults),[{newCoins:275},{newCoins:275},{newCoins:275}]);
      await page.reload();
      await page.clock.install();
      await page.evaluate(()=>window.mountActivity());
      await page.waitForFunction(()=>window.probe.activityMounted===true);
      await page.evaluate(()=>window.select('Alice'));
      await page.locator('#activity p[data-owner="Alice"]').waitFor();
      await page.evaluate(()=>{window.probe.holdAuthority=true;window.probe.startActivity();});
      await page.locator('#activity p[data-activity="true"]').waitFor();
      await page.evaluate(()=>window.select('Bob'));
      await page.locator('#activity p[data-owner="Bob"]').waitFor();
      assert.equal(await page.locator('#activity p').getAttribute('data-activity'),'false','Retired account work cannot block the replacement account');
      await page.evaluate(()=>{window.probe.startActivity();});
      await page.locator('#activity p[data-activity="true"]').waitFor();
      await page.clock.runFor(15000);
      assert.equal(await page.evaluate(()=>window.probe.activityError),'deadline-exceeded');
      assert.equal(await page.locator('#activity p').getAttribute('data-activity'),'false','Expired current-account work must release activity');
      await page.evaluate(()=>{window.probe.holdAuthority=false;return window.probe.startActivity();});
      assert.deepEqual(await page.evaluate(()=>window.probe.activityReceipt),{newCoins:275});
      const readsBeforeLateReceipt=await page.evaluate(()=>window.probe.reads.length);
      await page.evaluate(()=>{for(const release of window.probe.pendingAuthority)release({data:{newCoins:0}});});
      await page.evaluate(()=>Promise.resolve());
      assert.deepEqual(await page.evaluate(()=>window.probe.activityReceipt),{newCoins:275});
      assert.equal(await page.evaluate(()=>window.probe.reads.length),readsBeforeLateReceipt,'Expired receipts cannot trigger a late profile refresh');
      await page.screenshot({path:path.join(output,`paid-activity-recovery-${width}.png`)});
      await page.evaluate(()=>window.disposeActivity());
      assert.deepEqual(errors,[]);
    }
    await context.close();
    console.log(`PASS ${width}px: ${baseline ? 'baseline receipt timing' : 'immediate receipts, profile outage, retired accounts, immutable Classic positions, canonical recovery, fresh authority reads, shared paid retries, account-owned activity, and expired paid delivery recovery'}`);
  }
  await writeFile(path.join(output, baseline ? "receipt-timing-before.json" : "receipt-timing-after.json"), JSON.stringify({
    authority: "Production Firebase host adapter with injected SDK/callables and 300ms profile reads; not production latency", samples,
  }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
