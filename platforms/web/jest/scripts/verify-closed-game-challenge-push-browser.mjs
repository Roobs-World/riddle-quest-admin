import assert from "node:assert/strict";
import {readFile, mkdir, writeFile, mkdtemp, rm, readdir} from "node:fs/promises";
import {createServer} from "node:http";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {tmpdir} from "node:os";
import {chromium} from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const evidence = path.resolve(root, "artifacts/closed-game-challenge-push");
await mkdir(evidence, {recursive: true});
const assets = path.join(root, "builds/jest/assets");
const workerAsset = (await readdir(assets)).find(name => /^liveChallengePushWorker-[\w-]+\.js$/.test(name));
assert.ok(workerAsset, "Build the Jest target before running this notification test");
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname.startsWith("/assets/")) {
    try {response.setHeader("Content-Type", "text/javascript");response.end(await readFile(path.join(assets, path.basename(pathname))));}
    catch {response.writeHead(404).end();}
    return;
  }
  response.setHeader("Content-Type", "text/html");response.end('<html lang="en"><title>Challenge push registration fixture</title><body>Notification registration fixture</body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const profile = await mkdtemp(path.join(tmpdir(), "riddle-closed-push-"));
let browser;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await chromium.launchPersistentContext(profile, {channel: "chromium", headless: true});
  browser = context;
  await context.grantPermissions(["notifications"], {origin});
  for (const initial of context.pages()) await initial.close();
  const page = await context.newPage();
  const workerPromise = context.waitForEvent("serviceworker");
  await page.goto(origin);
  await page.evaluate(async script => {
    const registration = await navigator.serviceWorker.register(script, {type: "module"});
    if (!registration.active) await new Promise((resolve, reject) => {
      const installing = registration.installing ?? registration.waiting;
      if (!installing) {reject(new Error('No installing worker'));return;}
      installing.addEventListener('statechange', () => {
        if (installing.state === 'activated') resolve();
        if (installing.state === 'redundant') reject(new Error('Worker registration failed'));
      });
    });
  }, `/assets/${workerAsset}?gameUrl=https%3A%2F%2Fjest.com%2Fg%2Friddle-q`);
  const worker = await workerPromise;
  await page.close();
  assert.equal(context.pages().length, 0, "The game page must be closed before receiving the challenge");
  const challengeId = `live_${"a".repeat(64)}`;
  const payload = {kind: "liveChallenge", challengeId, title: "Alice challenged you", body: "Accept challenge", expiresAtMs: String(Date.now() + 60000)};
  // Inject the provider push event only; the real worker invokes Chromium's notification API.
  const send = data => worker.evaluate(async payload => {
    let completion;
    const event = new PushEvent('push', {data: JSON.stringify({data: payload})});
    Object.defineProperty(event, 'waitUntil', {value: promise => {completion = promise;}});
    self.dispatchEvent(event);
    await completion;
    return (await self.registration.getNotifications()).map(notification => ({title: notification.title, body: notification.body, tag: notification.tag}));
  }, data);
  assert.deepEqual(await send(payload), [{title: payload.title, body: payload.body, tag: challengeId}]);
  assert.equal(context.pages().length, 0, "Notification display must not open or accept the game");
  assert.equal((await send(payload)).length, 1, "Duplicate messages replace the tagged notification");
  assert.equal((await send({...payload, expiresAtMs: '1', challengeId: `live_${"b".repeat(64)}`})).length, 1);
  assert.equal((await send({...payload, challengeId: '../forged'})).length, 1);
  await writeFile(path.join(evidence, "result.json"), JSON.stringify({gameClosed: true, browserNotifications: 1, duplicateReplaced: true, expiredRejected: true, malformedRejected: true, providerPushInjected: true, workerAsset}, null, 2));
  console.log('Closed-game challenge push passed: the real service worker displays one browser notification with no game page open, replaces duplicates and rejects expired or malformed messages. FCM delivery was injected.');
  await context.close();
} finally {
  await browser?.close();await new Promise(resolve => server.close(resolve));await rm(profile, {recursive: true, force: true});
}
