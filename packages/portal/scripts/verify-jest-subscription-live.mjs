import {existsSync, lstatSync} from "node:fs";
import {chromium} from "@playwright/test";

const gameId = process.env.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
const gameUrl = process.env.JEST_DEPLOYED_GAME_URL || "https://jest.com/g/riddle-q";
const subscriptionSku = process.env.JEST_SANDBOX_SUBSCRIPTION_SKU ||
  "com.roobsworld.riddlequest.premium.monthly";
const statePath = process.env.JEST_SANDBOX_STORAGE_STATE ||
  "/tmp/riddle-quest-jest-sandbox-state.json";
const functionsBaseUrl = (process.env.JEST_FUNCTIONS_BASE_URL ||
  "https://us-central1-riddle-quest-ec2b2.cloudfunctions.net").replace(/\/$/, "");

if (!existsSync(statePath)) {
  throw new Error(`Missing Jest sandbox browser state: ${statePath}`);
}
const stateMetadata = lstatSync(statePath);
if (!stateMetadata.isFile() || stateMetadata.isSymbolicLink() || (stateMetadata.mode & 0o777) !== 0o600) {
  throw new Error(`Jest sandbox browser state must be a regular owner-only 0600 file: ${statePath}`);
}
if (typeof process.getuid === "function" && stateMetadata.uid !== process.getuid()) {
  throw new Error(`Jest sandbox browser state must be owned by the current user: ${statePath}`);
}
if (process.env.JEST_SANDBOX_SUBSCRIPTION_CONFIRM !== subscriptionSku) {
  throw new Error(`Set JEST_SANDBOX_SUBSCRIPTION_CONFIRM=${subscriptionSku} to authorize the sandbox subscription lifecycle.`);
}

const browser = await chromium.launch({headless: process.env.JEST_DEPLOYED_HEADED !== "1"});
const context = await browser.newContext({storageState: statePath, viewport: {width: 390, height: 844}});
if (process.env.FIREBASE_APPCHECK_DEBUG_TOKEN) {
  await context.addInitScript((token) => {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }, process.env.FIREBASE_APPCHECK_DEBUG_TOKEN);
}
const page = await context.newPage();

/** Loads the active Jest build and waits until startup reconciliation has completed. */
async function loadPlayableGame() {
  await page.goto(gameUrl, {waitUntil: "domcontentloaded"});
  await page.waitForFunction(
    (expectedGameId) => [...document.querySelectorAll("iframe")].some((iframe) => {
      try {
        return new URL(iframe.src).hostname === `${expectedGameId}.builds.jest.com`;
      } catch {
        return false;
      }
    }),
    gameId,
    {timeout: 30_000},
  );

  const deadline = Date.now() + 30_000;
  let game;
  while (Date.now() < deadline) {
    game = page.frames().find((frame) => {
      try {
        return new URL(frame.url()).hostname === `${gameId}.builds.jest.com`;
      } catch {
        return false;
      }
    });
    if (game && !game.isDetached()) break;
    await page.waitForTimeout(100);
  }
  if (!game || game.isDetached()) throw new Error("The deployed Jest game frame was not found.");

  const playableContent = game.locator(".onboarding-card-welcome, .riddle-card h1").first();
  const startupError = game.locator(".route-missing");
  await playableContent.or(startupError).first().waitFor({timeout: 30_000});
  if (await startupError.isVisible()) {
    const message = (await startupError.innerText()).replace(/\s+/g, " ").trim();
    throw new Error(`The deployed Jest game did not finish startup: ${message}`);
  }
  const letsPlay = game.getByRole("button", {name: /let's play/i});
  if (await letsPlay.isVisible()) {
    await letsPlay.click();
    const onboardingContinue = game.getByRole("button", {name: /got it/i});
    if (await onboardingContinue.isVisible()) await onboardingContinue.click();
  }
  await game.locator(".riddle-card h1").waitFor({timeout: 30_000});
  return game;
}

/** Reads the live subscription and verifies its signed entitlement server-side. */
async function readAndSyncSubscription(game) {
  return game.evaluate(async ({baseUrl, expectedSku}) => {
    const playerId = globalThis.JestSDK.getPlayer().playerId;
    const catalog = await globalThis.JestSDK.payments.getSubscriptions();
    const subscription = catalog.subscriptions.find(({sku}) => sku === expectedSku);
    const signed = catalog.subscriptionsSigned ?? catalog.signed;
    if (!subscription || typeof signed !== "string") {
      throw new Error("Jest did not return the configured subscription with a signed entitlement.");
    }
    const response = await fetch(`${baseUrl}/syncJestSubscriptions`, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({subscriptionsSigned: signed, playerId}),
    });
    const body = await response.json();
    return {subscription, verification: {ok: response.ok, body}};
  }, {baseUrl: functionsBaseUrl, expectedSku: subscriptionSku});
}

try {
  let game = await loadPlayableGame();
  const before = await readAndSyncSubscription(game);
  if (
    before.subscription.price !== 4.99 ||
    before.subscription.currency !== "USD" ||
    before.subscription.billingPeriod !== "monthly"
  ) {
    throw new Error("The Jest monthly subscription catalog does not match the production offer.");
  }

  let activatedNow = false;
  if (before.subscription.status !== "active") {
    await game.evaluate((sku) => {
      globalThis.__RIDDLE_QUEST_SUBSCRIPTION_RESULT__ = undefined;
      globalThis.__RIDDLE_QUEST_SUBSCRIPTION_TEST__ =
        globalThis.JestSDK.payments.beginSubscription({subscriptionSku: sku});
      void globalThis.__RIDDLE_QUEST_SUBSCRIPTION_TEST__.then((result) => {
        globalThis.__RIDDLE_QUEST_SUBSCRIPTION_RESULT__ = result;
      });
    }, subscriptionSku);

    await page.getByText(/sandbox user/i).waitFor({state: "visible", timeout: 15_000});
    const confirm = page.getByRole("button", {name: /^subscribe$/i}).last();
    await confirm.waitFor({state: "visible", timeout: 15_000});
    await confirm.click();
    await game.waitForFunction(
      () => globalThis.__RIDDLE_QUEST_SUBSCRIPTION_RESULT__ !== undefined,
      undefined,
      {timeout: 30_000},
    ).catch(() => {
      throw new Error("Jest did not resolve the subscription checkout within 30 seconds after Subscribe was clicked.");
    });
    const activation = await game.evaluate(() => globalThis.__RIDDLE_QUEST_SUBSCRIPTION_RESULT__);
    if (
      activation?.result !== "success" ||
      activation.subscription?.sku !== subscriptionSku ||
      activation.subscription?.status !== "active" ||
      typeof activation.subscriptionSigned !== "string"
    ) {
      throw new Error(`Jest did not activate the sandbox subscription (${activation?.result ?? "unknown"}).`);
    }
    activatedNow = true;
  }

  const active = await readAndSyncSubscription(game);
  if (
    active.subscription.status !== "active" ||
    !active.verification.ok ||
    active.verification.body.verified !== true ||
    !active.verification.body.activeSkus?.includes(subscriptionSku)
  ) {
    throw new Error("The authoritative backend did not verify the active Jest subscription.");
  }

  game = await loadPlayableGame();
  const restored = await readAndSyncSubscription(game);
  if (
    restored.subscription.status !== "active" ||
    !restored.verification.ok ||
    !restored.verification.body.activeSkus?.includes(subscriptionSku)
  ) {
    throw new Error("The active subscription was not restored after a full game reload.");
  }

  if (await game.evaluate(() => typeof globalThis.JestSDK.payments.cancelSubscription) !== "function") {
    throw new Error("The live Jest SDK does not expose subscription cancellation.");
  }
  await game.evaluate((sku) => {
    globalThis.__RIDDLE_QUEST_SUBSCRIPTION_CANCEL_RESULT__ = undefined;
    globalThis.__RIDDLE_QUEST_SUBSCRIPTION_CANCEL_TEST__ =
      globalThis.JestSDK.payments.cancelSubscription({subscriptionSku: sku});
    void globalThis.__RIDDLE_QUEST_SUBSCRIPTION_CANCEL_TEST__.then((result) => {
      globalThis.__RIDDLE_QUEST_SUBSCRIPTION_CANCEL_RESULT__ = result;
    });
  }, subscriptionSku);
  const cancel = page.getByRole("button", {name: /cancel subscription|confirm cancellation|cancel plan/i}).last();
  await cancel.waitFor({state: "visible", timeout: 15_000});
  await cancel.click();
  await game.waitForFunction(
    () => globalThis.__RIDDLE_QUEST_SUBSCRIPTION_CANCEL_RESULT__ !== undefined,
    undefined,
    {timeout: 30_000},
  );
  const cancellation = await game.evaluate(() => globalThis.__RIDDLE_QUEST_SUBSCRIPTION_CANCEL_RESULT__);
  if (cancellation?.result !== "success") {
    throw new Error(`Jest did not confirm subscription cancellation (${cancellation?.result ?? "unknown"}).`);
  }

  const afterCancellation = await readAndSyncSubscription(game);
  if (!afterCancellation.verification.ok || afterCancellation.verification.body.verified !== true) {
    throw new Error("The backend did not reconcile the post-cancellation subscription state.");
  }

  console.log(JSON.stringify({
    checkout: "sandbox-zero-dollar",
    subscriptionSku,
    price: active.subscription.price,
    currency: active.subscription.currency,
    billingPeriod: active.subscription.billingPeriod,
    activatedNow,
    signedEntitlementVerified: true,
    restoredAfterReload: true,
    cancellationConfirmed: true,
    postCancellationStatus: afterCancellation.subscription.status,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
