import {existsSync, lstatSync, mkdirSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {chromium} from "@playwright/test";

const gameId = process.env.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
const gameUrl = process.env.JEST_DEPLOYED_GAME_URL || "https://jest.com/g/riddle-q";
const playerOneState = process.env.JEST_PLAYER_ONE_STORAGE_STATE || "/tmp/riddle-quest-jest-sandbox-state.json";
const playerTwoState = process.env.JEST_PLAYER_TWO_STORAGE_STATE || "/tmp/riddle-quest-jest-sandbox-state-player-2.json";
const evidenceDirectory = process.env.JEST_MULTIPLAYER_EVIDENCE_DIR;
const expectedBuildVersion = process.env.JEST_EXPECTED_BUILD_VERSION;
const hostViewport = {width: 520, height: 932};

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
if (!expectedBuildVersion) throw new Error("JEST_EXPECTED_BUILD_VERSION is required for exact-build verification.");
if (evidenceDirectory) mkdirSync(evidenceDirectory, {recursive: true});

const browser = await chromium.launch({headless: process.env.JEST_DEPLOYED_HEADED !== "1"});

const openPlayer = async (statePath, url = gameUrl) => {
  const context = await browser.newContext({storageState: statePath, viewport: hostViewport});
  await context.addInitScript((token) => {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }, process.env.FIREBASE_APPCHECK_DEBUG_TOKEN);
  await context.addInitScript(() => {
    globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ = [];
    window.addEventListener("riddle-quest:host-to-game", (event) => {
      const detail = event.detail;
      if (detail?.type === "host:operationResult") globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__.push(structuredClone(detail));
    });
  });
  const page = await context.newPage();
  const referralResponses = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push({url: request.url(), error: request.failure()?.errorText ?? "unknown"}));
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
      if (!game.isDetached() && page.frames().includes(game)) {
        const build = new URL(game.url()).pathname.split("/").at(-2);
        if (build !== expectedBuildVersion) {
          throw new Error(`Expected deployed build ${expectedBuildVersion}, received ${build ?? "unknown"}.`);
        }
        const frameBounds = await (await game.frameElement()).boundingBox();
        if (
          !frameBounds ||
          frameBounds.x < 0 ||
          frameBounds.y < 0 ||
          frameBounds.x + frameBounds.width > hostViewport.width ||
          frameBounds.y + frameBounds.height > hostViewport.height
        ) {
          throw new Error(`The Jest game frame is clipped by the evidence viewport: ${JSON.stringify({hostViewport, frameBounds})}`);
        }
        const gameViewport = await game.evaluate(() => ({width: innerWidth, height: innerHeight}));
        return {context, page, game, gameViewport, referralResponses, consoleErrors, pageErrors, failedRequests};
      }
    }
    await page.waitForTimeout(100);
  }
  throw new Error("The deployed Jest game frame was not found.");
};

const capture = async ({page}, filename) => {
  if (!evidenceDirectory) return;
  await page.screenshot({path: path.join(evidenceDirectory, filename), fullPage: true});
};

const dismissRewardModals = async ({page, game}, evidenceFilename) => {
  const rewardModal = game.locator(".game-modal-backdrop");
  if (await rewardModal.isVisible().catch(() => false) && evidenceFilename) {
    await capture({page}, evidenceFilename);
  }
  for (let step = 0; step < 12 && await rewardModal.isVisible().catch(() => false); step += 1) {
    const advance = rewardModal.locator(".reward-continue");
    if (!await advance.isVisible().catch(() => false)) break;
    await advance.waitFor({state: "visible", timeout: 10_000});
    await game.waitForFunction(() => {
      const candidate = document.querySelector(".game-modal-backdrop .reward-continue");
      return candidate instanceof HTMLButtonElement && !candidate.disabled;
    }, undefined, {timeout: 10_000});
    await advance.click();
    await page.waitForTimeout(250);
  }
};

const enterGame = async ({page, game}, {startupRewardFilename} = {}) => {
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
  await dismissRewardModals({page, game}, startupRewardFilename);
};

const installRaceObserver = async ({game}) => game.evaluate(() => {
  globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ = [];
  window.addEventListener("riddle-quest:host-to-game", (event) => {
    const detail = event.detail;
    if (detail?.type === "host:operationResult") globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__.push(structuredClone(detail));
  });
});

const readIdentity = async ({game}) => {
  await game.waitForFunction(() => {
    try {
      return Boolean(globalThis.JestSDK?.getPlayer()?.playerId);
    } catch {
      return false;
    }
  }, undefined, {timeout: 30_000});
  return game.evaluate(async () => ({
    player: globalThis.JestSDK.getPlayer(),
    profile: await globalThis.JestSDK.social.getProfile({avatarSize: 64}),
  }));
};

const latestRun = async ({game}, predicate) => game.evaluate((serializedPredicate) => {
  const matches = [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].reverse().map((message) => message?.payload?.data?.run).filter(Boolean);
  if (serializedPredicate === "completed") return structuredClone(matches.find((run) => run.status === "completed"));
  if (serializedPredicate === "opponent") return structuredClone(matches.find((run) => run.opponent));
  return undefined;
}, predicate);

const countCorrectEvents = (events) => events.filter((event) => event?.type === "correct").length;

const finishRace = async ({page, game}, prefix, {betweenAnswersMs = 250} = {}) => {
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
    await page.waitForTimeout(betweenAnswersMs);
    try {
      await game.waitForFunction((previousPosition) => {
        if (document.querySelector(".race-result")) return true;
        const latest = [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].reverse().find((message) => message?.payload?.data?.run)?.payload?.data?.run;
        return latest?.status !== "active" || (typeof latest?.currentRiddle?.position === "number" && latest.currentRiddle.position !== previousPosition);
      }, current.position, {timeout: 30_000});
    } catch (error) {
      const diagnostic = await game.evaluate(() => ({
        resultVisible: Boolean(document.querySelector(".race-result")),
        messages: [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].slice(-4).map((message) => ({
          operation: message?.payload?.operation,
          ok: message?.payload?.ok,
          error: message?.payload?.error,
          status: message?.payload?.data?.run?.status,
          position: message?.payload?.data?.run?.currentRiddle?.position,
        })),
      }));
      await capture({page}, `${prefix}-race-error-answer-${step + 1}.png`);
      throw new Error(`Live race answer ${step + 1} did not advance: ${JSON.stringify(diagnostic)}`, {cause: error});
    }
  }
  await game.locator(".race-result").waitFor({state: "visible", timeout: 45_000});
  await dismissRewardModals({page, game}, `${prefix}-achievement-unlocked.png`);
  await capture({page}, `${prefix}-race-finished.png`);
};

const creator = await openPlayer(playerOneState);
let recipient;
try {
  await enterGame(creator, {startupRewardFilename: "live-00-player-1-returning-reward.png"});
  const creatorIdentity = await readIdentity(creator);
  if (!creatorIdentity.player?.registered) throw new Error("Player 1 is not a registered Jest player.");
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
  await creator.page.waitForTimeout(500);
  await capture(creator, "live-01-player-1-lobby.png");
  if (await creator.game.getByRole("button", {name: /challenge a player/i}).count()) {
    throw new Error("The multiplayer lobby exposed a challenge before Player 1 completed a score.");
  }
  await creator.game.getByRole("button", {name: /^History /}).click();
  await creator.game.locator(".race-gameplay .guess-board").waitFor({state: "visible", timeout: 45_000});

  await finishRace(creator, "live-02-player-1", {betweenAnswersMs: 2_500});
  const creatorRun = await latestRun(creator, "completed");
  if (!creatorRun || creatorRun.correctCount !== 10 || countCorrectEvents(creatorRun.events ?? []) !== 10) {
    throw new Error("Player 1's authoritative completed run did not contain a 10/10 score history.");
  }
  if (creator.referralResponses.length !== 0) throw new Error("Jest sharing occurred before Player 1 completed the run.");
  await capture(creator, "live-03-player-1-completed.png");
  await creator.game.getByRole("button", {name: /send challenge/i}).click({noWaitAfter: true});
  await capture(creator, "live-04-player-1-share-requested.png");
  try {
    await creator.game.waitForFunction(() => Boolean(globalThis.__RIDDLE_QUEST_LIVE_INVITE__?.input?.entryPayload?.challengeId), undefined, {timeout: 45_000});
  } catch (error) {
    const diagnostic = await creator.game.evaluate(() => ({
      body: document.body.innerText.slice(0, 4_000),
      invite: structuredClone(globalThis.__RIDDLE_QUEST_LIVE_INVITE__ ?? null),
      messages: [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].slice(-8).map((message) => ({
        operation: message?.payload?.operation,
        ok: message?.payload?.ok,
        error: message?.payload?.error,
        status: message?.payload?.data?.run?.status,
        challengeId: message?.payload?.data?.preview?.challengeId,
      })),
    }));
    await capture(creator, "live-04-player-1-share-error.png");
    throw new Error(`Player 1's completed run did not reach Jest referral sharing: ${JSON.stringify({
      diagnostic,
      referralResponses: creator.referralResponses,
      consoleErrors: creator.consoleErrors,
      pageErrors: creator.pageErrors,
      failedRequests: creator.failedRequests,
    })}`, {cause: error});
  }
  const invite = await creator.game.evaluate(() => structuredClone(globalThis.__RIDDLE_QUEST_LIVE_INVITE__.input));
  const challengeId = invite.entryPayload.challengeId;
  if (typeof challengeId !== "string" || challengeId.length < 1 || challengeId.length > 160) {
    throw new Error("The live challenge did not produce a valid opaque challenge ID.");
  }
  await capture(creator, "live-04-player-1-share-dialog.png");
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
  await dismissRewardModals(creator);
  await capture(creator, "live-04b-player-1-challenge-ready.png");
  const publishedPreview = await creator.game.evaluate((publishedChallengeId) => structuredClone(
    [...(globalThis.__RIDDLE_QUEST_LIVE_RACE_MESSAGES__ ?? [])].reverse().map((message) => message?.payload?.data?.preview)
      .find((preview) => preview?.challengeId === publishedChallengeId),
  ), challengeId);
  if (!publishedPreview) throw new Error("Player 1's published challenge preview was not observed.");
  if (publishedPreview.adjustedTimeToBeatMs !== creatorRun.adjustedElapsedMs) {
    throw new Error("Player 1's published score does not match the completed run time.");
  }
  recipient = await openPlayer(playerTwoState, referralUrl);
  const recipientIdentity = await readIdentity(recipient);
  if (!recipientIdentity.player?.registered) throw new Error("Player 2 is not a registered Jest player.");
  if (recipientIdentity.player.playerId === creatorIdentity.player.playerId) {
    throw new Error("Player 1 and Player 2 resolved to the same Jest player.");
  }
  await installRaceObserver(recipient);
  try {
    await recipient.game.getByRole("button", {name: /accept challenge/i}).waitFor({state: "visible", timeout: 45_000});
  } catch (error) {
    throw new Error(`Player 2 did not receive the live challenge: ${JSON.stringify({pageUrl: recipient.page.url(), gameUrl: recipient.game.url(), body: (await recipient.game.locator("body").innerText()).slice(0, 2_000)})}`, {cause: error});
  }
  let stableInviteFrame = recipient.game;
  let stableSince = Date.now();
  const stableInviteDeadline = Date.now() + 30_000;
  while (Date.now() - stableSince < 3_000 && Date.now() < stableInviteDeadline) {
    const candidate = [...recipient.page.frames()].reverse().find((frame) => {
      try {
        return new URL(frame.url()).hostname === `${gameId}.builds.jest.com` && !frame.isDetached();
      } catch {
        return false;
      }
    });
    const actionable = candidate && await candidate.getByRole("button", {name: /accept challenge/i}).isVisible().catch(() => false);
    if (!actionable || candidate !== stableInviteFrame) {
      stableInviteFrame = candidate ?? stableInviteFrame;
      stableSince = Date.now();
    }
    await recipient.page.waitForTimeout(100);
  }
  if (Date.now() - stableSince < 3_000) throw new Error("Player 2's invite frame did not stabilize before acceptance.");
  recipient.game = stableInviteFrame;
  await capture(recipient, "live-05-player-2-invite-ready.png");
  await recipient.game.getByRole("button", {name: /accept challenge/i}).click();
  const acceptedDeadline = Date.now() + 45_000;
  let acceptedGame;
  while (!acceptedGame && Date.now() < acceptedDeadline) {
    for (const frame of [...recipient.page.frames()].reverse()) {
      try {
        if (new URL(frame.url()).hostname !== `${gameId}.builds.jest.com` || frame.isDetached()) continue;
        if (await frame.locator(".race-gameplay .guess-board").isVisible().catch(() => false)) {
          acceptedGame = frame;
          break;
        }
      } catch {
        // The candidate frame may be replaced while the Jest shell resolves the referral route.
      }
    }
    if (!acceptedGame) await recipient.page.waitForTimeout(100);
  }
  if (!acceptedGame) {
    await capture(recipient, "live-06-player-2-accept-error.png");
    throw new Error(`Player 2's accepted challenge did not reach gameplay: ${JSON.stringify({
      pageUrl: recipient.page.url(),
      frames: recipient.page.frames().map((frame) => frame.url()),
      body: (await recipient.page.locator("body").innerText()).slice(0, 2_000),
      consoleErrors: recipient.consoleErrors,
      pageErrors: recipient.pageErrors,
      failedRequests: recipient.failedRequests,
    })}`);
  }
  if (acceptedGame !== recipient.game) {
    recipient.game = acceptedGame;
  }
  const recipientRun = await latestRun(recipient, "opponent");
  if (!recipientRun?.opponent) throw new Error("Player 2's accepted run did not contain an opponent score.");
  const opponent = recipientRun.opponent;
  if (recipientRun.challengeId !== challengeId) throw new Error("Player 2 started a different challenge than Player 1 published.");
  if (opponent.displayName !== publishedPreview.creator.displayName) throw new Error("Player 2's opponent name does not match Player 1's published identity.");
  if (opponent.adjustedFinishMs !== creatorRun.adjustedElapsedMs || opponent.adjustedFinishMs !== publishedPreview.adjustedTimeToBeatMs) {
    throw new Error("Player 2's opponent finish time does not match Player 1's authoritative score.");
  }
  if (JSON.stringify(opponent.events) !== JSON.stringify(creatorRun.events) || countCorrectEvents(opponent.events ?? []) !== 10) {
    throw new Error("Player 2's opponent event history does not match Player 1's authoritative 10/10 run.");
  }
  const opponentRailName = (await recipient.game.locator(".race-progress > div").nth(1).locator("span").innerText()).trim();
  if (opponentRailName !== publishedPreview.creator.displayName) throw new Error("Player 2's visible score rail names the wrong opponent.");
  await finishRace(recipient, "live-06-player-2", {betweenAnswersMs: 50});

  const outcome = (await recipient.game.locator(".race-result h2").innerText()).trim();
  if (!/you win|opponent wins|tie/i.test(outcome)) throw new Error(`Unexpected live race outcome: ${outcome}`);
  const summary = {
    build: new URL(creator.game.url()).pathname.split("/").at(-2),
    versionId: new URL(gameUrl).searchParams.get("versionId"),
    hostViewport,
    gameViewport: creator.gameViewport,
    players: [creatorIdentity, recipientIdentity].map((identity) => ({
      registered: identity.player.registered,
      playerHash: createHash("sha256").update(identity.player.playerId).digest("hex").slice(0, 12),
      displayName: identity.profile?.displayName ?? identity.profile?.username ?? null,
    })),
    challengeIdFormat: "valid",
    creatorScore: creatorRun.correctCount,
    creatorAdjustedFinishMs: creatorRun.adjustedElapsedMs,
    opponentDisplayName: opponent.displayName,
    opponentScoreEvents: countCorrectEvents(opponent.events),
    opponentAdjustedFinishMs: opponent.adjustedFinishMs,
    scoreMappingVerified: true,
    outcome,
    diagnostics: {
      player1: {consoleErrors: creator.consoleErrors, pageErrors: creator.pageErrors, failedRequests: creator.failedRequests},
      player2: {consoleErrors: recipient.consoleErrors, pageErrors: recipient.pageErrors, failedRequests: recipient.failedRequests},
    },
    completed: true,
  };
  if (evidenceDirectory) writeFileSync(path.join(evidenceDirectory, "RESULT.json"), `${JSON.stringify(summary, null, 2)}\n`, {mode: 0o600});
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await recipient?.context.close().catch(() => undefined);
  await creator.context.close().catch(() => undefined);
  await browser.close();
}
