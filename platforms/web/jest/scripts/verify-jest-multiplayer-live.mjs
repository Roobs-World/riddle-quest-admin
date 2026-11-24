import {chmodSync, mkdirSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "@playwright/test";
import {LiveRaceViewSchema} from "../../../../src/races/contracts/index";
import {assertPrivateJestStorageState} from "../src/__tests__/deployedJestStorageState.ts";
import {loadExactJestPaymentGame, verifyReloadedJestPaymentWallet} from "./jest-payment-live-acceptance.mjs";

const gameId = process.env.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
const gameUrl = process.env.JEST_DEPLOYED_GAME_URL || "https://jest.com/g/riddle-q";
const expectedBuildVersion = process.env.JEST_EXPECTED_BUILD_VERSION;
const states = [
  process.env.JEST_PLAYER_ONE_STORAGE_STATE || "/tmp/riddle-quest-jest-sandbox-state.json",
  process.env.JEST_PLAYER_TWO_STORAGE_STATE || "/tmp/riddle-quest-jest-sandbox-state-player-2.json",
];
const evidenceDirectory = process.env.JEST_MULTIPLAYER_EVIDENCE_DIR ||
  fileURLToPath(new URL("../build/.jest-upload-receipts/multiplayer-qa/", import.meta.url));
if (!expectedBuildVersion) throw new Error("JEST_EXPECTED_BUILD_VERSION is required for exact-build verification.");
for (const state of states) await assertPrivateJestStorageState(state);
mkdirSync(evidenceDirectory, {recursive: true, mode: 0o700});
chmodSync(evidenceDirectory, 0o700);

const browser = await chromium.launch({headless: process.env.JEST_DEPLOYED_HEADED !== "1"});
const players = [];
const failures = [];
const pageErrors = [];
let unreadRetiredResponses = 0;
let stage = "startup";

/** Keeps failure evidence useful without retaining session URLs, identities, or signed payloads. */
function record(summary) {
  writeFileSync(path.join(evidenceDirectory, "EVIDENCE-" + Date.now() + ".json"),
    JSON.stringify({build: expectedBuildVersion, ...summary, failures,
      pageErrorCount: pageErrors.length, unreadRetiredResponses}, null, 2) + "\n",
    {mode: 0o600, flag: "wx"});
}

/** Waits for an actual server projection while the player-facing UI runs normally. */
async function waitForView(player, matches) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const view = player.views.at(-1);
    if (view && matches(view)) return view;
    await player.page.waitForTimeout(100);
  }
  throw new Error("The live player projection did not reach the expected state.");
}

/** Acknowledges guidance before asking the player to use an obscured control. */
async function dismissGuidance(player) {
  for (let step = 0; step < 12; step += 1) {
    for (const button of await player.game.getByRole("button", {name: /got it/i}).all()) {
      if (await button.isVisible()) {await button.click(); break;}
    }
    await player.page.waitForTimeout(180);
  }
}

/** Opens the exact uploaded app with one independently authenticated sandbox account. */
async function openPlayer(storageState) {
  const context = await browser.newContext({storageState, viewport: {width: 390, height: 844}});
  context.setDefaultTimeout(15_000);
  if (process.env.FIREBASE_APPCHECK_DEBUG_TOKEN) {
    await context.addInitScript(token => {globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token;},
      process.env.FIREBASE_APPCHECK_DEBUG_TOKEN);
  }
  const page = await context.newPage();
  const player = {context, page, views: []};
  players.push(player);
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", async response => {
    const endpoint = new URL(response.url()).pathname.split("/").at(-1);
    if (!["joinLiveRace", "updateLiveRace"].includes(endpoint)) return;
    if (!response.ok()) {failures.push({endpoint, status: response.status()}); return;}
    // The streaming SDK uses Accept rather than a JSON-body flag. Its heartbeat
    // responses are not LiveRaceViews, and retirement deliberately aborts them.
    if (response.request().headers().accept?.includes("text/event-stream")) return;
    try {
      const payload = await response.json();
      const parsed = LiveRaceViewSchema.safeParse(payload.result);
      if (parsed.success) player.views.push(parsed.data);
      else failures.push({endpoint, invalidProjection: true});
    } catch {
      // DevTools may discard a read response after its owning view retires.
      // Visible state and validated mutation responses remain the assertions.
      unreadRetiredResponses += 1;
    }
  });
  player.game = await loadExactJestPaymentGame(page, {gameId, gameUrl, expectedBuildVersion});
  if (await page.getByText("You're playing somewhere else", {exact: true}).isVisible()) {
    throw new Error("Another browser session owns this sandbox player.");
  }
  await dismissGuidance(player);
  if ((await player.game.locator(".game-mode-label").innerText()).trim() === "Daily") {
    await player.game.getByRole("button", {name: /^skip$/i}).click();
    await player.game.getByRole("dialog", {name: "Leave the Daily riddle?"}).waitFor();
    await player.game.getByRole("button", {name: "Play Classic", exact: true}).click();
  }
  await dismissGuidance(player);
  await player.game.getByRole("button", {name: /^multiplayer$/i}).click();
  await player.game.getByRole("button", {name: /^History /}).click();
  return player;
}

/** Captures only a test-account screen and keeps it owner-readable. */
async function capture(player, name) {
  const file = path.join(evidenceDirectory, name + "-" + Date.now() + ".png");
  writeFileSync(file, "", {flag: "wx", mode: 0o600});
  await player.page.screenshot({path: file});
}

try {
  const first = await openPlayer(states[0]);
  const second = await openPlayer(states[1]);
  const ids = await Promise.all(players.map(player =>
    player.game.evaluate(() => globalThis.JestSDK.getPlayer().playerId)));
  if (ids[0] === ids[1]) throw new Error("Two distinct sandbox players are required.");

  stage = "two-player matchmaking";
  await Promise.all(players.map(player => player.game.locator(".live-race-start").click()));
  await Promise.all(players.map(player =>
    player.game.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 45_000})));
  const starts = await Promise.all(players.map(player =>
    waitForView(player, view => view.phase === "racing" && view.run?.currentRiddle != null)));
  if (starts.some(view => view.opponent?.bot !== false) ||
      starts[0].startsAtMs !== starts[1].startsAtMs ||
      starts[0].run.currentRiddle.riddleId !== starts[1].run.currentRiddle.riddleId) {
    throw new Error("The two sandbox players did not enter the same human match.");
  }
  if (starts.some(view => view.run.currentRiddle.evaluation !== undefined)) {
    throw new Error("A live response exposed private answer evaluation data.");
  }
  await Promise.all(players.map((player, index) => capture(player, "player-" + (index + 1) + "-matched")));

  stage = "private hint commands";
  await first.game.locator(".race-actions").getByRole("button", {name: /^Hint/}).click();
  await waitForView(first, view => view.run?.currentRiddle?.revealedLetters.length === 1);
  if (second.views.at(-1).run.currentRiddle.revealedLetters.length !== 0) {
    throw new Error("One player's hint changed the other player's private riddle.");
  }
  await second.game.locator(".race-actions").getByRole("button", {name: /^Hint/}).click();
  await waitForView(second, view => view.run?.currentRiddle?.revealedLetters.length === 1);

  stage = "forfeit and authoritative result";
  await second.game.getByRole("button", {name: /close race to 10/i}).click();
  const confirmQuit = second.game.getByRole("button", {name: /^quit race$/i});
  if (await confirmQuit.isVisible()) await confirmQuit.click();
  await second.game.locator(".race-category-grid").waitFor();
  await first.game.locator(".race-result").waitFor({state: "visible", timeout: 30_000});
  const result = await waitForView(first, view => view.phase === "result");
  if (result.result !== "win" || result.rewardCoins !== 50 || !Number.isSafeInteger(result.newCoins)) {
    throw new Error("The remaining player did not receive the confirmed forfeit result.");
  }
  await capture(first, "winner-result");

  stage = "reward persistence";
  await verifyReloadedJestPaymentWallet(first.page, {
    gameId, gameUrl, expectedBuildVersion, confirmedBalance: result.newCoins,
  });
  if (failures.length || pageErrors.length) throw new Error("The live game reported a backend or browser error.");
  const summary = {passed: true, twoDistinctPlayers: true, humanMatch: true,
    privateHintsVerified: true, forfeitResultVerified: true,
    winnerRewardCoins: result.rewardCoins, reloadedWalletVerified: true};
  record(summary);
  console.log(JSON.stringify({build: expectedBuildVersion, ...summary}, null, 2));
} catch (error) {
  record({passed: false, stage,
    fingerprint: createHash("sha256").update(String(error?.message ?? error)).digest("hex").slice(0, 12)});
  console.error("Live multiplayer QA failed during " + stage + "; owner-only evidence was saved.");
  process.exitCode = 1;
} finally {
  await Promise.all(players.map(player => player.context.close()));
  await browser.close();
}
