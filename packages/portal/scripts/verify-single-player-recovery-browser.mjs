import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/solo-recovery-"));
const output = path.resolve(process.env.SOLO_RECOVERY_REPORT_DIR ?? path.join(root, "../../builds/test-evidence/game-reliability-2026-10-02"));
await mkdir(output, {recursive: true});
const completionPath = path.join(root, "src/play/game/hooks/useCompletionDelivery.ts");
const lifecyclePath = path.join(root, "src/play/useHostRiddleLifecycle.ts");
const raceInputPath = path.join(root, "src/play/race/components/NativeAnswerInput.tsx");
const playableInputPath = path.join(root, "src/playable/YouTubeNativeAnswerInput.tsx");
const authPath = path.join(root, "src/play/useHostAuthSession.ts");
const sessionPath = path.join(root, "../hosted/src/play/gameSession.ts");
const samples = [];
const baselineFiles = new Set((process.env.SOLO_RECOVERY_BASELINE_FILES ?? "").split(",").filter(Boolean));
const source = `
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useCompletionDelivery} from ${JSON.stringify(completionPath)};
import {useHostRiddleLifecycle} from ${JSON.stringify(lifecyclePath)};
import {RIDDLE_LOAD_DEADLINE_MS} from ${JSON.stringify(path.join(root, "src/play/riddleLoadDeadline.ts"))};
import {NativeAnswerInput} from ${JSON.stringify(raceInputPath)};
import {YouTubeNativeAnswerInput} from ${JSON.stringify(playableInputPath)};
import {useHostAuthSession} from ${JSON.stringify(authPath)};
import {useHostOperations} from ${JSON.stringify(path.join(root, "src/play/useHostOperations.ts"))};
import {createInitialGameSession,gameSessionReducer} from ${JSON.stringify(sessionPath)};
window.probe={calls:[],messages:[],acknowledged:0,ready:false};
window.contentDeadlineMs=RIDDLE_LOAD_DEADLINE_MS;
const root=createRoot(document.getElementById('root'));
const question={riddleId:'classic_2',text:'A tall animal',answerLength:7,
  sessionToken:'00000000-0000-4000-8000-000000000002',gameMode:'classic',index:2};
const outcome={id:'classic-win',kind:'win',riddleId:'classic_2',gameMode:'classic',
  sessionToken:question.sessionToken,attempts:1,isCorrect:true};
const dispatch=()=>{window.probe.acknowledged++;};
const post=message=>{window.probe.calls.push({message,at:performance.now()});
  if(window.probe.accept)window.probe.ack(true,message.requestId);};
function Completion(){
  window.probe.ack=useCompletionDelivery({outcome,dispatch,postToHost:post});
  useEffect(()=>{window.probe.ready=true;return()=>{window.probe.ready=false;};},[]);
  return <p>Completion acknowledgement: {window.probe.acknowledged}</p>;
}
const services={loadRiddle:async input=>{
  window.probe.calls.push({input,at:performance.now()});
  if(window.probe.hold)return new Promise(resolve=>{window.probe.release=()=>resolve(question);});
  if(window.probe.fail)throw new Error('Injected connection outage');return question;
}};
const postToGame=message=>window.probe.messages.push(message);
const options={userId:'player',initialGameMode:'classic',locale:'en',services,
  withActivity:operation=>operation(),postToGame,postOperation:()=>{},configurationWarning:null,
  setNotice:()=>{},onRecoveryAttempt:()=>{}};
function Startup(){
  const [profile,setProfile]=useState({coins:300});window.probe.updateProfile=setProfile;
  const operations=useHostOperations({postOperation:options.postOperation});
  const lifecycle=useHostRiddleLifecycle({...options,profile,withActivity:operations.withActivity});
  window.probe.load=()=>lifecycle.loadRiddle({gameMode:'classic',locale:'en'},'held-load');
  useEffect(()=>{window.probe.ready=true;return()=>{window.probe.ready=false;};},[]);
  return <p data-activity={operations.activityActive}>Startup: {lifecycle.startupComplete?'playable':'waiting for authority'}</p>;
}
function NativeEditor({variant}){
  const [draft,setDraft]=useState('ABC');
  const inputRef=React.useRef(null);window.probe.inputRef=inputRef;
  const props={disabled:false,locale:'ko',ref:inputRef,
    onText:text=>{window.probe.texts.push(text);setDraft(value=>value+text);},
    onBackspace:()=>{window.probe.backspaces++;setDraft(value=>value.slice(0,-1));},
    onSubmit:()=>{window.probe.submits++;}};
  useEffect(()=>{window.probe.ready=true;return()=>{window.probe.ready=false;};},[]);
  return <><output>{draft}</output>{variant==='race'?<NativeAnswerInput {...props}/>:<YouTubeNativeAnswerInput {...props} label='Answer'/>}</>;
}
const restoredProfile={coins:300};
const authOptions={auth:{subscribe:callback=>{
  window.probe.publishAuth=callback;callback({user:{uid:'Alice',isAnonymous:false},profile:null});return()=>{};
}}};
const postAuth=()=>{};
function AuthHost(){
  const {snapshot}=useHostAuthSession({services:authOptions,initialProfile:restoredProfile,postToGame:postAuth});
  useEffect(()=>{window.probe.ready=true;return()=>{window.probe.ready=false;};},[]);
  return <output data-owner={snapshot.user?.uid}>{snapshot.profile?.coins??'waiting for profile'}</output>;
}
function AccountSession(){
  const [state,send]=React.useReducer(gameSessionReducer,undefined,()=>{
    let current=gameSessionReducer(createInitialGameSession(),{type:'hostInit',locale:'en',gameMode:'classic',
      user:{uid:'Alice',isAnonymous:false,accountGeneration:1},profile:null,products:[]});
    current=gameSessionReducer(current,{type:'loadRiddle',riddle:question});
    current=gameSessionReducer(current,{type:'guessRequested'});
    return gameSessionReducer(current,{type:'guessResolved',attempts:1,isCorrect:true,gameOver:true,canContinue:false,
      feedback:{guess:['G','I','R','A','F','F','E'],feedback:Array(7).fill('green')}});
  });
  window.probe.ack=useCompletionDelivery({outcome:state.lastOutcome,dispatch:send,postToHost:post,
    ownerKey:JSON.stringify([state.user?.uid,state.user?.accountGeneration])});
  window.probe.changeAccount=()=>send({type:'authState',user:{uid:'Bob',isAnonymous:false,accountGeneration:1},profile:{coins:800}});
  window.probe.newQuestion=()=>send({type:'loadRiddle',riddle:{...question,riddleId:'bob-question',index:3}});
  useEffect(()=>{window.probe.ready=true;return()=>{window.probe.ready=false;};},[]);
  return <output data-owner={state.user?.uid} data-modal={state.modal??'none'} data-riddle={state.riddle?.riddleId??'none'}>{state.profile?.coins??'waiting'}</output>;
}
window.mount=(kind,config={})=>{window.probe={calls:[],messages:[],acknowledged:0,ready:false,...config};
  root.render(<React.StrictMode>{kind==='completion'?<Completion/>:kind==='startup'?<Startup/>:kind==='auth'?<AuthHost/>:kind==='account-session'?<AccountSession/>:<NativeEditor variant={kind}/>}</React.StrictMode>);};
window.retire=()=>root.render(null);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body><main id="root"></main><script type="module" src="/main.tsx"></script></body></html>');
let server, browser;
try {
  await build({root: scratch, configFile: false, logLevel: "error", define: {"process.env.NODE_ENV": '"development"'},
    build: {outDir: "dist"}, plugins: [{
    name: "isolated-recovery-operations", enforce: "pre",
    resolveId(id) {if (id.endsWith("preloadGameModals")) return "\0modal-preload-stub";},
    async load(id) {
      if (id === "\0modal-preload-stub") return "export const preloadGameModals=async()=>undefined;";
      if (process.env.SOLO_RECOVERY_BASELINE_DIR && [completionPath, lifecyclePath, raceInputPath, playableInputPath, authPath, sessionPath].includes(id) &&
        (!baselineFiles.size || baselineFiles.has(path.basename(id))))
        return readFile(path.join(process.env.SOLO_RECOVERY_BASELINE_DIR, path.basename(id)), "utf8");
    },
  }]});
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
    const mount = async (kind, config = {}) => {
      await page.evaluate(() => window.retire());
      await page.waitForFunction(() => !window.probe.ready);
      await page.evaluate(({kind, config}) => window.mount(kind, config), {kind, config});
      await page.waitForFunction(() => window.probe.ready);
    };
    await mount("completion");
    await page.waitForFunction(() => window.probe.calls.length >= 3, null, {timeout: 4000});
    assert.equal(new Set(await page.evaluate(() => window.probe.calls.map(call => call.message.requestId))).size, 1);
    const reconnectAt = await page.evaluate(() => {
      window.probe.accept = true;
      const at = performance.now();window.dispatchEvent(new Event("online"));return at;
    });
    await page.waitForFunction(() => window.probe.acknowledged === 1);
    const completionReconnectMs = await page.evaluate(at => performance.now() - at, reconnectAt);
    assert.ok(completionReconnectMs < 750, "Completion must recover before its next backed-off retry");
    const acceptedCount = await page.evaluate(() => window.probe.calls.length);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.probe.calls.length), acceptedCount, "Acknowledgement stops all retry timers");
    await mount("account-session");
    await page.waitForFunction(() => window.probe.calls.length >= 1);
    assert.notEqual(await page.locator('output').getAttribute('data-modal'), 'none');
    const retiredReceipt = await page.evaluate(() => window.probe.calls[0].message.requestId);
    await page.evaluate(() => window.probe.changeAccount());
    await page.waitForFunction(() => document.querySelector('output').dataset.owner === 'Bob');
    assert.equal(await page.locator('output').getAttribute('data-modal'), 'none');
    assert.equal(await page.locator('output').getAttribute('data-riddle'), 'none');
    assert.equal(await page.evaluate(id => window.probe.ack(true,id), retiredReceipt), false);
    const retiredCount = await page.evaluate(() => window.probe.calls.length);
    await page.evaluate(() => {window.probe.newQuestion();window.dispatchEvent(new Event('online'));});
    await page.waitForFunction(() => document.querySelector('output').dataset.riddle === 'bob-question');
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.probe.calls.length), retiredCount, 'Replaced accounts cannot resend old terminal outcomes');
    await mount("startup", {hold: true});
    await page.waitForFunction(() => typeof window.probe.release === 'function');
    assert.equal(await page.locator('p').getAttribute('data-activity'), 'true', 'Held startup content owns the blocking activity boundary');
    await page.evaluate(() => {window.probe.releaseExpired=window.probe.release;window.probe.hold=false;});
    await page.waitForFunction(() => window.probe.messages.length === 1, null, {
      timeout: await page.evaluate(() => window.contentDeadlineMs + 4000),
    });
    assert.equal(await page.evaluate(() => window.probe.calls.length), 2, 'Hanging content releases its wait and starts one bounded recovery');
    await page.waitForFunction(() => document.querySelector('p').dataset.activity === 'false');
    await page.evaluate(() => window.probe.releaseExpired());
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.probe.messages.length), 1, 'Expired content cannot replace a recovered question');
    await mount("startup", {fail: true});
    await page.waitForFunction(() => window.probe.calls.length >= 2);
    const recoveredAt = await page.evaluate(() => {
      window.probe.fail = false;
      const at = performance.now();window.dispatchEvent(new Event("online"));return at;
    });
    await page.waitForFunction(() => window.probe.messages.length === 1);
    const startupReconnectMs = await page.evaluate(at => performance.now() - at, recoveredAt);
    assert.ok(startupReconnectMs < 750, "Startup must resume before the next outage retry");
    await mount("startup", {hold: true});
    await page.evaluate(() => {window.probe.load();window.probe.updateProfile({coins:350});});
    await page.waitForFunction(() => typeof window.probe.release === "function");
    await page.evaluate(() => window.probe.release());
    await page.waitForFunction(() => window.probe.messages.length === 1);
    assert.equal(await page.evaluate(() => window.probe.messages[0].payload.profile.coins), 350);
    await mount("startup", {hold: true});
    await page.evaluate(() => {window.probe.load();});
    await page.waitForFunction(() => typeof window.probe.release === "function");
    await page.evaluate(() => window.retire());
    await page.waitForFunction(() => !window.probe.ready);
    await page.evaluate(() => window.probe.release());
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => window.probe.messages), [], "Retired hosts cannot publish late content");
    for (const variant of ["race", "playable"]) {
      await mount(variant, {backspaces: 0, submits: 0, texts: []});
      const input = page.locator("input");
      await input.focus();
      assert.equal(await page.evaluate(() => window.probe.inputRef.current === document.querySelector("input")), true);
      const accepted = await input.evaluate(element => element.dispatchEvent(new InputEvent("beforeinput", {
        bubbles: true, cancelable: true, inputType: "deleteContentBackward",
      })));
      assert.equal(accepted, false, "Software backspace must be consumed into answer slots");
      assert.equal(await page.locator("output").innerText(), "AB");
      await page.keyboard.press("Backspace");
      assert.equal(await page.locator("output").innerText(), "A");
      assert.equal(await page.evaluate(() => window.probe.backspaces), 2, "Physical backspace must delete exactly one slot");
      await input.evaluate(element => {
        element.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true, data: "한"}));
        element.dispatchEvent(new InputEvent("beforeinput", {bubbles: true, cancelable: true, inputType: "deleteContentBackward"}));
        element.value = "한";
        element.dispatchEvent(new CompositionEvent("compositionend", {bubbles: true, data: "한"}));
        element.value = "한";
        element.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertCompositionText", data: "한"}));
      });
      assert.equal(await page.evaluate(() => window.probe.backspaces), 2, "IME composition owns its internal deletions");
      assert.deepEqual(await page.evaluate(() => window.probe.texts), ["한"], "IME commit must remain deduplicated");
      assert.equal(await page.locator("output").innerText(), "A한");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => window.probe.submits), 1);
      await input.evaluate(element => {
        element.disabled = true;
        element.dispatchEvent(new InputEvent("beforeinput", {bubbles: true, cancelable: true, inputType: "deleteContentBackward"}));
      });
      assert.equal(await page.evaluate(() => window.probe.backspaces), 2, "Disabled editors cannot accept software deletions");
    }
    await mount("auth");
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '300');
    await page.evaluate(() => window.probe.publishAuth({user:{uid:'Bob',isAnonymous:false},profile:null}));
    await page.waitForFunction(() => document.querySelector('output')?.dataset.owner === 'Bob');
    assert.equal(await page.locator("output").innerText(), "waiting for profile", "A replacement account must not inherit restored coins");
    await page.evaluate(() => window.probe.publishAuth({user:{uid:'Bob',isAnonymous:false},profile:{coins:800}}));
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '800');
    assert.deepEqual(errors, []);
    samples.push({width, completionReconnectMs, startupReconnectMs,
      effectReplayRecovered: true, synchronousAcknowledgementStoppedRetries: true,
      currentProfilePreserved: true, retiredLoadRejected: true, nativeDeletionAndImePreserved: true,
      restoredProfileAccountIsolated: true, accountVictoryAndReceiptsRetired: true, hangingContentRecovered: true});
    await context.close();
    console.log(`PASS ${width}px: effect replay, completion/startup reconnect, fresh profile, account retirement, and unmount ownership`);
  }
  await writeFile(path.join(output, "single-player-recovery.json"), JSON.stringify({
    authority: "Injected local services and actual React hooks; timings exclude production network", samples,
  }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
