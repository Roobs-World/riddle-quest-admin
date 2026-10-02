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
const output = path.resolve(process.env.SOLO_RECOVERY_REPORT_DIR ?? path.join(root, "../../artifacts/game-reliability-2026-10-02"));
await mkdir(output, {recursive: true});
const completionPath = path.join(root, "src/play/game/hooks/useCompletionDelivery.ts");
const lifecyclePath = path.join(root, "src/play/useHostRiddleLifecycle.ts");
const raceInputPath = path.join(root, "src/play/race/components/NativeAnswerInput.tsx");
const playableInputPath = path.join(root, "src/playable/YouTubeNativeAnswerInput.tsx");
const samples = [];
const baselineFiles = new Set((process.env.SOLO_RECOVERY_BASELINE_FILES ?? "").split(",").filter(Boolean));
const source = `
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useCompletionDelivery} from ${JSON.stringify(completionPath)};
import {useHostRiddleLifecycle} from ${JSON.stringify(lifecyclePath)};
import {NativeAnswerInput} from ${JSON.stringify(raceInputPath)};
import {YouTubeNativeAnswerInput} from ${JSON.stringify(playableInputPath)};
window.probe={calls:[],messages:[],acknowledged:0,ready:false};
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
  const lifecycle=useHostRiddleLifecycle({...options,profile});
  window.probe.load=()=>lifecycle.loadRiddle({gameMode:'classic',locale:'en'},'held-load');
  useEffect(()=>{window.probe.ready=true;return()=>{window.probe.ready=false;};},[]);
  return <p>Startup: {lifecycle.startupComplete?'playable':'waiting for authority'}</p>;
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
window.mount=(kind,config={})=>{window.probe={calls:[],messages:[],acknowledged:0,ready:false,...config};
  root.render(<React.StrictMode>{kind==='completion'?<Completion/>:kind==='startup'?<Startup/>:<NativeEditor variant={kind}/>}</React.StrictMode>);};
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
      if (process.env.SOLO_RECOVERY_BASELINE_DIR && [completionPath, lifecyclePath, raceInputPath, playableInputPath].includes(id) &&
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
    assert.deepEqual(errors, []);
    samples.push({width, completionReconnectMs, startupReconnectMs,
      effectReplayRecovered: true, synchronousAcknowledgementStoppedRetries: true,
      currentProfilePreserved: true, retiredLoadRejected: true, nativeDeletionAndImePreserved: true});
    await context.close();
    console.log(`PASS ${width}px: effect replay, completion/startup reconnect, fresh profile, and unmount ownership`);
  }
  await writeFile(path.join(output, "single-player-recovery.json"), JSON.stringify({
    authority: "Injected local services and actual React hooks; timings exclude production network", samples,
  }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
