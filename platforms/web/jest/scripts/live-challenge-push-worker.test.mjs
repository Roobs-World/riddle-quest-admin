import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {test} from "node:test";

const source = readFileSync(new URL("../src/notifications/liveChallengePushWorker.js", import.meta.url), "utf8");
const challengeId = `live_${"a".repeat(64)}`;
function harness(windows = []) {
  const handlers = {}, notifications = [], opened = [];
  const self = {location: {origin: "https://game.builds.jest.com", href: "https://game.builds.jest.com/assets/worker.js?gameUrl=https%3A%2F%2Fjest.com%2Fg%2Friddle-q"},
    registration: {showNotification: async (...args) => {notifications.push(args);}},
    clients: {matchAll: async () => windows, openWindow: async url => {opened.push(url);}},
    addEventListener: (kind, handler) => {handlers[kind] = handler;}};
  vm.runInNewContext(source, {self, URL, Date, Number});
  async function emit(kind, event) {
    let pending;
    handlers[kind]({...event, waitUntil: value => {pending = value;}});
    await pending;
  }
  return {emit, notifications, opened};
}
test("data-only push displays one tagged notification and rejects malformed or expired challenges", async () => {
  const h = harness(), data = {kind: "liveChallenge", challengeId, title: "Alice challenged you", body: "Accept challenge", expiresAtMs: String(Date.now() + 60000)};
  await h.emit("push", {data: {json: () => ({data})}});
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0][1].tag, challengeId);
  for (const invalid of [{...data, challengeId: "../ticket"}, {...data, expiresAtMs: "1"}, {...data, title: "x".repeat(201)}])
    await h.emit("push", {data: {json: () => ({data: invalid})}});
  await h.emit("push", {data: {json: () => {throw new Error("invalid-json");}}});
  assert.equal(h.notifications.length, 1);
});
test("a click focuses the current game and posts only the opaque handle without automatically accepting", async () => {
  const messages = [];
  let focused = false;
  const h = harness([{url: "https://game.builds.jest.com/index.html", postMessage: message => messages.push(message), focus: async () => {focused = true;}}]);
  await h.emit("notificationclick", {notification: {close() {}, data: {challengeId, expiresAtMs: Date.now() + 60000}}});
  assert.equal(focused, true);
  assert.equal(messages[0].kind, "liveChallenge");
  assert.equal(messages[0].challengeId, challengeId);
  assert.deepEqual(Object.keys(messages[0]).sort(), ["challengeId", "kind"]);
  assert.deepEqual(h.opened, []);
});
test("a closed-game click opens the approved Jest route, and expired invitations open nothing", async () => {
  const h = harness();
  await h.emit("notificationclick", {notification: {close() {}, data: {challengeId, expiresAtMs: Date.now() + 60000}}});
  assert.deepEqual(h.opened, ["https://jest.com/g/riddle-q"]);
  await h.emit("notificationclick", {notification: {close() {}, data: {challengeId, expiresAtMs: 1}}});
  assert.equal(h.opened.length, 1);
});
