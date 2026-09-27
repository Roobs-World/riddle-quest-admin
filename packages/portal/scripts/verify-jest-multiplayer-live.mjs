import {existsSync, lstatSync, mkdirSync} from "node:fs";
import path from "node:path";
import {chromium} from "@playwright/test";

const gameId = process.env.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
const gameUrl = process.env.JEST_DEPLOYED_GAME_URL || "https://jest.com/g/riddle-q";
const playerOneState = process.env.JEST_PLAYER_ONE_STORAGE_STATE || "/tmp/riddle-quest-jest-sandbox-state.json";
const playerTwoState = process.env.JEST_PLAYER_TWO_STORAGE_STATE || "/tmp/riddle-quest-jest-sandbox-state-player-2.json";
const evidenceDirectory = process.env.JEST_MULTIPLAYER_EVIDENCE_DIR;

for (const statePath of [playerOneState, playerTwoState]) {
  if (!existsSync(statePath)) throw new Error(`Missing Jest sandbox browser state: ${statePath}`);
  const metadata = lstatSync(statePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o777) !== 0o600) {
    throw new Error(`Jest sandbox browser state must be a regular owner-only 0600 file: ${statePath}`);
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new Error(`Jest sandbox browser state must be owned by the current user: ${statePath}`);
  }
}
if (!process.env.FIREBASE_APPCHECK_DEBUG_TOKEN) {
  throw new Error("FIREBASE_APPCHECK_DEBUG_TOKEN is required for automated live Jest testing.");
}
if (evidenceDirectory) mkdirSync(evidenceDirectory, {recursive: true});

const browser = await chromium.launch({headless: process.env.JEST_DEPLOYED_HEADED !== "1"});

const openPlayer = async (statePath, url = gameUrl) => {
  const context = await browser.newContext({storageState: statePath, viewport: {width: 390, height: 844}});
  await context.addInitScript((token) => {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }, process.env.FIREBASE_APPCHECK_DEBUG_TOKEN);
  const page = await context.newPage();
  const referralResponses = [];
  page.on("response", async (response) => {
    if (!new URL(response.url()).pathname.includes("upsertReferral")) return;
    referralResponses.push({status: response.status(), body: await response.json().catch(() => null)});
  });
  await page.goto(url, {waitUntil: "domcontentloaded", timeout: 60_000});
  const referralLaunch = new URL(page.url());
  const candidateLaunch = new URL(gameUrl);
  if (url !== gameUrl && referralLaunch.searchParams.has("entryPayload") && candidateLaunch.searchParams.has("versionId")) {
    candidateLaunch.searchParams.set("entryPayload", referralLaunch.searchParams.get("entryPayload"));
    if (referralLaunch.searchParams.has("refid")) candidateLaunch.searchParams.set("refid", referralLaunch.searchParams.get("refid"));
    await page.goto(candidateLaunch.toString(), {waitUntil: "domcontentloaded", timeout: 60_000});
  }
  await page.waitForFunction((expectedGameId) => [...document.querySelectorAll("iframe")].some((iframe) => {
    try {
      return new URL(iframe.src).hostname === `${expectedGameId}.builds.jest.com`;
    } catch {
      return false;
    }
  }), gameId, {timeout: 30_000});
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const game = page.frames().find((frame) => {
      try {
        return new URL(frame.url()).hostname === `${gameId}.builds.jest.com`;
      } catch {
        return false;
      }
    });
    if (game && !game.isDetached()) {
      await page.waitForTimeout(750);
      if (!game.isDetached() && page.frames().includes(game)) return {context, page, game, referralResponses};
    }
    await page.waitForTimeout(100);
  }
  throw new Error("The deployed Jest game frame was not found.");
};

const enterGame = async ({page, game}) => {
  const playable = game.locator(".onboarding-card-welcome, .riddle-card h1").first();
  const startupError = game.locator(".route-missing");
  await playable.or(startupError).first().waitFor({timeout: 45_000});
  if (await startupError.isVisible()) throw new Error((await startupError.innerText()).replace(/\s+/g, " ").trim());
  const letsPlay = game.getByRole("button", {name: /let's play/i});
  await letsPlay.or(game.locator(".game-content:not([aria-hidden='true'])")).first().waitFor({state: "visible", timeout: 30_000});
  if (await letsPlay.isVisible()) {
    await letsPlay.click();
    const onboardingContinue = game.getByRole("button", {name: /got it/i});
    if (await onboardingContinue.isVisible()) await onboardingContinue.click();
  }
  await game.locator(".riddle-card h1").waitFor({state: "visible", timeout: 30_000});
  for (let step = 0; step < 15; step += 1) {
    if ((await game.locator(".game-content").getAttribute("aria-hidden")) !== "true") break;
    const candidates = await game.getByRole("button", {name: /got it/i}).all();
    const gotIt = await (async () => {
      for (const candidate of candidates) if (await candidate.isVisible().catch(() => false)) return candidate;
      return undefined;
    })();
    if (!gotIt) {
      await page.waitForTimeout(250);
      continue;
    }
    await gotIt.click();
    await page.waitForTimeout(100);
  }
  await game.locator(".game-content:not([aria-hidden='true'])").waitFor({state: "visible", timeout: 30_000});
  await game.getByRole("button", {name: /^multiplayer$/i}).waitFor({state: "visible", timeout: 30_000});
};

const capture = async ({page}, filename) => {
  if (!evidenceDirectory) return;
  await page.screenshot({path: path.join(evidenceDirectory, filename), fullPage: true});
};

const installRaceObserver = async ({game}) => game.evaluate(() => {
  globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ = [];
  window.addEventListener("riddle-quest:host-to-game", (event) => {
    const detail = event.detail;
    if (detail?.type === "host:operationResult") globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__.push(structuredClone(detail));
  });
});

const finishRace = async ({page, game}, prefix) => {
  await game.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 45_000});
  await capture({page}, `${prefix}-race-started.png`);
  for (let step = 0; step < 10; step += 1) {
    const result = game.locator(".race-result");
    if (await result.isVisible().catch(() => false)) break;
    await game.waitForFunction(() => [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].reverse().some((message) =>
      typeof message?.payload?.data?.run?.currentRiddle?.evaluation?.answer === "string"), undefined, {timeout: 30_000});
    const current = await game.evaluate(() => {
      const run = [...globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__].reverse().find((message) =>
        typeof message?.payload?.data?.run?.currentRiddle?.evaluation?.answer === "string").payload.data.run;
      return {answer: run.currentRiddle.evaluation.answer, position: run.currentRiddle.position};
    });
    const submit = game.locator(".race-actions .submit-action");
    await submit.waitFor({state: "visible", timeout: 15_000});
    await game.waitForFunction(() => {
      const candidate = document.querySelector(".race-gameplay .keyboard .key");
      return candidate instanceof HTMLButtonElement && !candidate.disabled;
    }, undefined, {timeout: 30_000});
    await game.locator(".race-gameplay .guess-board").click();
    await page.keyboard.type(current.answer);
    try {
      await game.waitForFunction(() => {
        const candidate = document.querySelector(".race-actions .submit-action");
        return candidate instanceof HTMLButtonElement && !candidate.disabled;
      }, undefined, {timeout: 30_000});
    } catch (error) {
      const state = await game.locator(".race-gameplay").evaluate((gameplay) => ({
        cells: Array.from(gameplay.querySelectorAll(".guess-row:last-child .cell"), (cell) => cell.textContent).join(""),
        clue: gameplay.querySelector(".riddle-card")?.textContent,
      }));
      throw new Error(`Live race answer ${step + 1} did not fill the board: ${JSON.stringify({answerLength: current.answer.length, state})}`, {cause: error});
    }
    await submit.click();
    await page.waitForTimeout(250);
    try {
      await game.waitForFunction((previousPosition) => {
        if (document.querySelector(".race-result")) return true;
        const latest = [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].reverse().find((message) => message?.payload?.data?.run)?.payload?.data?.run;
        return latest?.status !== "active" || (typeof latest?.currentRiddle?.position === "number" && latest.currentRiddle.position !== previousPosition);
      }, current.position, {timeout: 30_000});
    } catch (error) {
      const diagnostic = await game.evaluate(() => ({
        resultVisible: Boolean(document.querySelector(".race-result")),
        messages: [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].slice(-4).map((message) => ({operation: message?.payload?.operation, ok: message?.payload?.ok, status: message?.payload?.data?.run?.status, position: message?.payload?.data?.run?.currentRiddle?.position})),
      }));
      throw new Error(`Live race answer ${step + 1} did not advance: ${JSON.stringify(diagnostic)}`, {cause: error});
    }
  }
  await game.locator(".race-result").waitFor({state: "visible", timeout: 45_000});
  await capture({page}, `${prefix}-race-finished.png`);
};

const creator = await openPlayer(playerOneState);
let recipient;
try {
  await enterGame(creator);
  await installRaceObserver(creator);
  await creator.game.evaluate(() => {
    const referrals = globalThis.JestSDK.referrals;
    const original = referrals.shareReferralLink.bind(referrals);
    referrals.shareReferralLink = async (input) => {
      globalThis.__RIDDLE_QUEST_LIVE_INVITE__ = {input};
      const result = await original(input);
      globalThis.__RIDDLE_QUEST_LIVE_INVITE__.result = result;
      return result;
    };
  });
  await creator.game.getByRole("button", {name: /^multiplayer$/i}).click();
  await creator.game.getByRole("button", {name: /^History /}).waitFor({timeout: 15_000});
  await capture(creator, "live-01-player-1-lobby.png");
  await creator.game.getByRole("button", {name: /challenge another player/i}).click({noWaitAfter: true});
  await creator.game.waitForFunction(() => Boolean(globalThis.__RIDDLE_QUEST_LIVE_INVITE__?.input?.entryPayload?.challengeId), undefined, {timeout: 30_000});
  const invite = await creator.game.evaluate(() => structuredClone(globalThis.__RIDDLE_QUEST_LIVE_INVITE__.input));
  const challengeId = invite.entryPayload.challengeId;
  if (!/^jest-invite-[a-f0-9]{64}-[a-f0-9]{32}$/.test(challengeId)) {
    throw new Error("The live challenge did not produce a valid opaque challenge ID.");
  }
  await capture(creator, "live-02-player-1-share-dialog.png");
  const referralDeadline = Date.now() + 15_000;
  while (creator.referralResponses.length === 0 && Date.now() < referralDeadline) await creator.page.waitForTimeout(100);
  const referralUrl = creator.referralResponses[0]?.body?.[0]?.result?.data?.link;
  if (typeof referralUrl !== "string" || !/^https:\/\/jest\.com\/l\/[a-z0-9]+$/i.test(referralUrl)) {
    throw new Error("Jest did not return a valid live referral URL.");
  }

  const dialog = creator.page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) {
    const close = dialog.getByRole("button", {name: /close|cancel|done/i}).last();
    if (await close.isVisible().catch(() => false)) await close.click();
  }
  await creator.game.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 45_000});

  await finishRace(creator, "live-04-player-1");
  await creator.game.waitForFunction((publishedChallengeId) =>
    !Object.values(sessionStorage).includes(publishedChallengeId), challengeId, {timeout: 45_000});
  recipient = await openPlayer(playerTwoState, referralUrl);
  try {
    await recipient.game.getByRole("button", {name: /accept challenge/i}).waitFor({state: "visible", timeout: 45_000});
  } catch (error) {
    throw new Error(`Player 2 did not receive the live challenge: ${JSON.stringify({pageUrl: recipient.page.url(), gameUrl: recipient.game.url(), body: (await recipient.game.locator("body").innerText()).slice(0, 2_000)})}`, {cause: error});
  }
  await capture(recipient, "live-05-player-2-invite-ready.png");
  await installRaceObserver(recipient);
  await recipient.game.getByRole("button", {name: /accept challenge/i}).click();
  await recipient.page.waitForTimeout(1_000);
  const acceptedGame = recipient.page.frames().find((frame) => {
    try {
      return new URL(frame.url()).hostname === `${gameId}.builds.jest.com` && !frame.isDetached();
    } catch {
      return false;
    }
  });
  if (!acceptedGame) throw new Error("Player 2's accepted challenge frame was not found.");
  if (acceptedGame !== recipient.game) {
    recipient.game = acceptedGame;
    await installRaceObserver(recipient);
  }
  await finishRace(recipient, "live-06-player-2");

  const outcome = (await recipient.game.locator(".race-result h2").innerText()).trim();
  if (!/you win|opponent wins|tie/i.test(outcome)) throw new Error(`Unexpected live race outcome: ${outcome}`);
  console.log(JSON.stringify({build: new URL(creator.game.url()).pathname.split("/").at(-2), challengeIdFormat: "valid", outcome, completed: true}, null, 2));
} finally {
  await recipient?.context.close().catch(() => undefined);
  await creator.context.close().catch(() => undefined);
  await browser.close();
}
