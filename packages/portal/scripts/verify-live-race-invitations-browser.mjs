import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, writeFile, rm} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "vite";
import {chromium} from "@playwright/test";
import {createLiveRaceEmulator} from "./live-race-emulator.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, "../../artifacts/live-pvp-invitations/browser");
await mkdir(output, {recursive: true});
await mkdir(path.join(root, "node_modules/.cache"), {recursive: true});
const scratch = await mkdtemp(path.join(root, "node_modules/.cache/live-invitations-"));
const source = `
import React from 'react';import {createRoot} from 'react-dom/client';
import ${JSON.stringify(path.join(root, "src/styles.css"))};
import {RaceTo10Game} from ${JSON.stringify(path.join(root, "src/play/race/RaceTo10Game.tsx"))};
import {createFakeRaceServices} from ${JSON.stringify(path.join(root, "src/play/race/testing/fakeRaceServices.ts"))};
import {ReferralSharingProvider} from ${JSON.stringify(path.join(root, "src/play/sharing/ReferralSharingCapability.tsx"))};
import {useJestSharing} from ${JSON.stringify(path.join(root, "src/jest/sharing/useJestSharing.ts"))};
import {createFacebookReferralSharing} from ${JSON.stringify(path.join(root, "src/facebook/FacebookReferralSharing.ts"))};
import {parseEntryIntent,resolveRaceChallengeId} from ${JSON.stringify(path.join(root, "src/jest/entryIntent.ts"))};
import {facebookLaunchFromEntryData} from ${JSON.stringify(path.join(root, "src/facebook/referrals.ts"))};
const params=new URLSearchParams(location.search), user=params.get('user') || 'Alice', target=params.get('target');
window.inviteCalls=[];window.commands=[];window.outcome='success';
const services=createFakeRaceServices();
const call=async(action,input)=>{window.commands.push({action,input});const response=await fetch('/live/'+action,{method:'POST',body:JSON.stringify({user,...input})});if(!response.ok)throw new Error('Transport unavailable');return response.json();};
const matchmaking={find:async()=>({status:'cancelled'}),live:{join:input=>call('join',input),update:input=>call('update',input),challenge:input=>call('challenge',input),sendChallenge:input=>call('sendChallenge',input),inbox:()=>call('inbox',{})}};
const platform={setScreenshotProvider:()=>{},shareReferral:async input=>{window.inviteCalls.push({target:'jest',input});return {status:window.outcome,value:undefined};}};
const sdk={getSupportedAPIs:()=>['shareAsync'],shareAsync:async input=>{window.inviteCalls.push({target:'facebook',input});if(window.outcome!=='success')throw {code:window.outcome==='cancelled'?'USER_INPUT':'NETWORK_ERROR'};}};
const facebook=createFacebookReferralSharing({sdk,enabled:true,ageCategory:'13_plus',isActive:()=>true,issueToken:async()=>({token:'a'.repeat(43),expiresAtMs:Date.now()+60000}),renderImage:()=> 'data:image/png;base64,YQ=='});
const session={player:{playerId:user,registered:false},profile:{username:user},entryIntent:{}};
const entry=params.has('challenge')?JSON.parse(params.get('challenge')):{};
const challengeId=target==='facebook'?facebookLaunchFromEntryData(entry).initialRaceChallengeId:resolveRaceChallengeId(parseEntryIntent(entry));
async function postToHost(message){if(message.type==='game:listRaceCategories')window.dispatchEvent(new CustomEvent('riddle-quest:host-to-game',{detail:{type:'host:operationResult',requestId:message.requestId,payload:{operation:'raceCategories',ok:true,data:await services.listRaceCategories({locale:'en'})}}}));}
const activity=async operation=>operation();const track=()=>{};const backend={};
function App(){const jest=useJestSharing({locale:'en',session,platform,backend,withPlatformActivity:activity,withBackgroundPlatformActivity:activity,trackFunnel:track});const capability=target==='facebook'?facebook:jest;const push=params.has('push')?{...capability,setLiveRacePush:async enabled=>{window.pushCalls??=[];window.pushCalls.push(enabled);return window.pushAllowed??false;}}:capability;return <ReferralSharingProvider capability={push}><RaceTo10Game locale='en' coins={100} ownerId={user} challengeId={challengeId} matchmaking={matchmaking} postToHost={postToHost} onClose={()=>{}} /></ReferralSharingProvider>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
`;
await writeFile(path.join(scratch, "main.tsx"), source);
await writeFile(path.join(scratch, "tsconfig.json"), JSON.stringify({compilerOptions: {jsx: "react-jsx"}}));
await writeFile(path.join(scratch, "index.html"), '<html><body style="margin:0;background:#142234"><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
let browser, server, authority;
try {
  await build({root: scratch, configFile: false, publicDir: path.join(root, "public"), logLevel: "error", build: {outDir: "dist"}});
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname.startsWith("/live/")) {
        let body = ""; for await (const chunk of request) body += chunk;
        const result = await authority.call(url.pathname.split("/").at(-1), JSON.parse(body));
        response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(result)); return;
      }
      const file = path.join(scratch, "dist", url.pathname === "/" ? "index.html" : url.pathname);
      response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
      response.end(await readFile(file));
    } catch {response.writeHead(503).end("Fixture transport unavailable");}
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {})});
  for (const target of ["jest", "facebook"]) {
    authority = await createLiveRaceEmulator({provider: target});
    for (const viewport of [{width: 1280, height: 900}, {width: 390, height: 844}]) {
      await authority.reset();
      const context = await browser.newContext({viewport});
      await context.route("https://live-race.invalid/**", route => route.fulfill({contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="45" fill="#75baff"/></svg>'}));
      const a = await context.newPage(), b = await context.newPage(), errors = [];
      for (const page of [a, b]) page.on("pageerror", error => errors.push(error.message));
      await a.goto(`${base}/?target=${target}&user=Alice`);
      await a.getByRole("button", {name: "Challenge a friend", exact: true}).click();
      await a.locator(".live-race-self strong").waitFor();
      assert.match(await a.locator(".live-race-status").innerText(), /Waiting for your friend/);
      assert.equal(await a.locator(".live-race-rival strong").count(), 0);
      // Guest sharing is allowed; cancelled and failed dialogs leave the same reserved lobby ready for retry.
      await a.evaluate(() => window.outcome = "cancelled");
      await a.getByRole("button", {name: "Challenge a friend", exact: true}).click();
      await a.waitForFunction(() => window.inviteCalls.length === 1 && !document.querySelector(".live-race-invite-share button").disabled);
      assert.equal(await a.locator(".live-race-invite-share [role=alert]").count(), 0);
      await a.evaluate(() => window.outcome = "retryable-failure");
      await a.getByRole("button", {name: "Challenge a friend", exact: true}).click();
      await a.locator(".live-race-invite-share [role=alert]").waitFor();
      await a.evaluate(() => window.outcome = "success");
      await a.getByRole("button", {name: "Challenge a friend", exact: true}).click();
      await a.waitForFunction(() => window.inviteCalls.length === 3 && !document.querySelector(".live-race-invite-share button").disabled);
      const calls = await a.evaluate(() => window.inviteCalls);
      const entry = target === "jest" ? calls[2].input.entryPayload : calls[2].input.data;
      assert.match(entry.challengeId, /^live_[a-f0-9]{64}$/);
      assert.ok(calls.every(call => (target === "jest" ? call.input.entryPayload : call.input.data).challengeId === entry.challengeId));
      if (target === "jest") {assert.equal(entry.challengeDestination, "multiplayer");assert.equal(calls[2].input.reference, "live_pvp_v1");}
      else {assert.equal(calls[2].input.intent, "CHALLENGE");assert.equal(calls[2].input.switchContext, false);}
      await a.screenshot({path: path.join(output, `${target}-reserved-${viewport.width}.png`), fullPage: true});
      await b.goto(`${base}/?target=${target}&user=Bob&challenge=${encodeURIComponent(JSON.stringify(entry))}`);
      await b.getByRole("button", {name: "Accept challenge", exact: true}).waitFor();
      assert.match(await b.locator(".live-race-invitation").innerText(), /Alice challenged you/);
      assert.equal(await b.locator(".live-race-invitation").getAttribute("role"), "alert");
      assert.equal(await b.evaluate(() => window.commands.some(command => command.action === "join")), false, "Receiving a notification must not auto-accept");
      await b.screenshot({path: path.join(output, `${target}-received-${viewport.width}.png`), fullPage: true});
      await b.getByRole("button", {name: "Accept challenge", exact: true}).click();
      await b.locator(".live-race-countdown").waitFor();
      await a.locator(".live-race-rival strong").waitFor();
      assert.equal(await a.locator(".live-race-rival strong").innerText(), "Bob");
      assert.equal(await b.locator(".live-race-rival strong").innerText(), "Alice");
      const accept = await b.evaluate(() => window.commands.find(command => command.action === "join").input);
      assert.equal(accept.challengeId, entry.challengeId);
      assert.equal(accept.categoryId, "mixed");
      await b.screenshot({path: path.join(output, `${target}-accepted-${viewport.width}.png`), fullPage: true});
      await a.locator(".race-gameplay .guess-board").waitFor({timeout: 15000});
      await b.locator(".race-gameplay .guess-board").waitFor({timeout: 15000});
      assert.equal(await a.locator(".live-race-invite-share").count(), 0);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${target} ${viewport.width}px: native challenge payload, dismissal/failure retry, notification, explicit acceptance into original lobby and shared gameplay passed.`);
      await authority.reset();
      const direct = await browser.newContext({viewport});
      const sender = await direct.newPage(), recipient = await direct.newPage();
      await sender.goto(`${base}/?target=${target}&user=Alice`);
      await sender.getByRole("button", {name: "Challenge a friend", exact: true}).click();
      await sender.getByLabel("Player username", {exact: true}).fill("Bob");
      await sender.getByRole("button", {name: "Send challenge", exact: true}).click();
      await sender.getByText("Invitation saved. Push delivery depends on the player’s notification settings.", {exact: true}).waitFor();
      await recipient.goto(`${base}/?target=${target}&user=Bob&push=1`);
      await recipient.getByRole("button", {name: "Accept challenge", exact: true}).waitFor();
      assert.equal(await recipient.evaluate(() => window.commands.some(command => command.action === "join")), false);
      await recipient.getByRole("button", {name: "Enable challenge notifications", exact: true}).click();
      await recipient.getByText("Browser notifications are unavailable here. Your invitations will still appear in multiplayer.", {exact: true}).waitFor();
      await recipient.evaluate(() => window.pushAllowed = true);
      await recipient.getByRole("button", {name: "Enable challenge notifications", exact: true}).click();
      await recipient.getByRole("button", {name: "Enable challenge notifications", exact: true}).isDisabled().then(disabled => assert.ok(disabled));
      await recipient.getByRole("button", {name: "Disable challenge notifications", exact: true}).click();
      assert.deepEqual(await recipient.evaluate(() => window.pushCalls), [true, true, false]);
      for (const button of await recipient.locator(".live-race-push-consent button").all()) assert.ok((await button.boundingBox()).height >= 48);
      await recipient.locator(".race-screen").evaluate(element => {element.scrollTop = 0;});
      await recipient.screenshot({path: path.join(output, `${target}-direct-inbox-${viewport.width}.png`), fullPage: true});
      await recipient.getByRole("button", {name: "Accept challenge", exact: true}).click();
      await recipient.locator(".live-race-countdown").waitFor();
      await sender.locator(".live-race-rival strong").waitFor();
      assert.equal(await sender.locator(".live-race-rival strong").innerText(), "Bob");
      console.log(`${target} ${viewport.width}px: direct invitation, durable inbox, push permission fallback/revocation and original lobby acceptance passed.`);
      await direct.close();
    }
  }
} finally {
  await browser?.close(); await authority?.clear();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
