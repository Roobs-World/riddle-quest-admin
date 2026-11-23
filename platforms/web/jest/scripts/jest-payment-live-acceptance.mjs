import {createHash} from "node:crypto";
import {assertExactDeployedJestBuildUrl} from "../src/__tests__/deployedJestBuildIdentity.ts";

/** Pinned server-configured bonus for the one first-purchase achievement this endpoint can unlock. */
export const confirmedJestFirstPurchaseBonus = 25;

/** Pins the supported zero-charge checkout to the server's configured coin award. */
export function confirmedJestSandboxCoins(sku) {
  if (sku !== "com.roobsworld.riddlequest.coinpack1") {
    throw new Error("The payment probe supports only the configured 250-coin coinpack1 SKU.");
  }
  return 250;
}

/** Rejects checkout receipts that cannot establish a signed zero-dollar sandbox purchase. */
export function assertSandboxJestCheckout(purchase, sku) {
  confirmedJestSandboxCoins(sku);
  if (purchase?.result !== "success" || purchase.purchase?.productSku !== sku ||
      purchase.purchase?.sandbox !== true || purchase.purchase?.price !== 0 ||
      typeof purchase.purchase?.purchaseToken !== "string" || !purchase.purchase.purchaseToken.trim() ||
      typeof purchase.purchaseSigned !== "string" || !purchase.purchaseSigned.trim()) {
    throw new Error("Jest checkout did not return a signed zero-dollar sandbox purchase for the confirmed SKU.");
  }
}

/** Reads the live signed catalogs/recovery queue within 15 seconds; serialized directly into the game frame. */
export async function readJestPaymentCatalog({expectedProductSku, expectedSubscriptionSku}) {
  let timeout;
  try {
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("The catalog deadline elapsed.")), 15_000);
    });
    const [products, subscriptions, incomplete] = await Promise.race([
      Promise.all([
        globalThis.JestSDK.payments.getProducts(),
        globalThis.JestSDK.payments.getSubscriptions(),
        globalThis.JestSDK.payments.getIncompletePurchases(),
      ]), deadline,
    ]);
    return {
      product: products.find(({sku}) => sku === expectedProductSku),
      subscription: subscriptions.subscriptions.find(({sku}) => sku === expectedSubscriptionSku),
      incomplete: {
        hasMore: incomplete.hasMore,
        count: Array.isArray(incomplete.purchases) ? incomplete.purchases.length : null,
        signed: typeof incomplete.purchasesSigned === "string" && !!incomplete.purchasesSigned.trim(),
      },
    };
  } catch {
    throw new Error("The Jest payment catalog could not be confirmed within its 15-second bound.");
  } finally {clearTimeout(timeout);}
}

/** Waits at most 60 seconds after the visible zero-dollar confirmation; never retries or acknowledges checkout. */
export async function readJestSandboxCheckout() {
  let timeout;
  try {
    return await Promise.race([
      globalThis.__RIDDLE_QUEST_PAYMENT_TEST__,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("The checkout deadline elapsed.")), 60_000);
      }),
    ]);
  } catch {
    throw new Error("The zero-dollar sandbox checkout did not resolve within its 60-second bound.");
  } finally {clearTimeout(timeout);}
}

/**
 * Grants, verifies replay, then acknowledges one sandbox receipt. A failed/unknown grant stays recoverable.
 * Playwright serializes this callback into the game frame, so all browser-side dependencies stay inside it.
 */
export async function settleSandboxJestPurchase({baseUrl, signed, token, expectedCoins, initialCoins, expectedAchievementBonus}) {
  let durableGrantConfirmed = false;
  let purchaseCompleted = false;
  let idempotentReplay = false;
  let stage = "inputs";
  try {
    if (expectedCoins !== 250 || expectedAchievementBonus !== 25 || typeof signed !== "string" || !signed.trim() ||
        typeof token !== "string" || !token.trim() || !Number.isSafeInteger(initialCoins) || initialCoins < 0 ||
        !Number.isSafeInteger(initialCoins + expectedCoins)) {
      throw new Error("The sandbox settlement inputs are incomplete or do not match the confirmed coin award.");
    }
    let playerId;
    try {playerId = globalThis.JestSDK.getPlayer().playerId;} catch {
      throw new Error("Jest did not provide the current sandbox player identity.");
    }
    if (typeof playerId !== "string" || !playerId.trim()) {
      throw new Error("Jest did not provide the current sandbox player identity.");
    }
    const grant = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(baseUrl + "/grantJestPurchase", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({purchaseSigned: signed, playerId, purchaseToken: token}),
          signal: controller.signal,
        });
        return {ok: response.ok, body: await response.json()};
      } catch {
        throw new Error(controller.signal.aborted
          ? "The authoritative grant exceeded 15 seconds; leaving the purchase incomplete."
          : "The authoritative grant could not be confirmed; leaving the purchase incomplete.");
      } finally {
        clearTimeout(timeout);
      }
    };
    stage = "grant";
    durableGrantConfirmed = null;
    const first = await grant();
    const achievements = first.body?.newlyUnlockedAchievementIds;
    const validAchievements = Array.isArray(achievements) &&
      (achievements.length === 0 || achievements.length === 1 && achievements[0] === "first_purchase");
    const achievementBonus = validAchievements ? achievements.length * expectedAchievementBonus : null;
    if (!first.ok || first.body?.granted !== true || first.body?.alreadyProcessed !== false ||
        first.body?.purchaseToken !== token || first.body?.coinsAwarded !== expectedCoins ||
        !validAchievements || !Number.isSafeInteger(first.body?.newCoins) ||
        first.body.newCoins !== initialCoins + expectedCoins + achievementBonus) {
      throw new Error("The backend did not confirm a durable matching-token grant; leaving the purchase incomplete.");
    }
    durableGrantConfirmed = true;
    stage = "replay";
    const replay = await grant();
    if (!replay.ok || replay.body?.granted !== true || replay.body?.alreadyProcessed !== true ||
        replay.body?.purchaseToken !== token || replay.body?.coinsAwarded !== expectedCoins ||
        replay.body?.newCoins !== first.body.newCoins || !Array.isArray(replay.body?.newlyUnlockedAchievementIds) ||
        replay.body.newlyUnlockedAchievementIds.length !== 0) {
      throw new Error("The backend did not confirm an idempotent replay; leaving the purchase incomplete.");
    }
    idempotentReplay = true;
    const boundedSdkCall = async call => {
      let timeout;
      try {
        return await Promise.race([
          Promise.resolve().then(call),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error("The SDK deadline elapsed.")), 15_000);
          }),
        ]);
      } finally {clearTimeout(timeout);}
    };
    stage = "acknowledgment";
    purchaseCompleted = null;
    let completed;
    try {completed = await boundedSdkCall(() => globalThis.JestSDK.payments.completePurchase({purchaseToken: token}));} catch {
      throw new Error("Jest did not confirm acknowledgment within its 15-second bound; completion state is unknown.");
    }
    if (completed?.result !== "success") throw new Error("Jest did not confirm acknowledgment of the granted purchase.");
    purchaseCompleted = true;
    stage = "recovery";
    let remaining;
    try {remaining = await boundedSdkCall(() => globalThis.JestSDK.payments.getIncompletePurchases());} catch {
      throw new Error("Jest purchase recovery could not be inspected within its 15-second bound after acknowledgment.");
    }
    if (!Array.isArray(remaining?.purchases) || remaining.hasMore !== false ||
        typeof remaining.purchasesSigned !== "string" || !remaining.purchasesSigned.trim() ||
        remaining.purchases.some(purchase => typeof purchase?.purchaseToken !== "string" ||
          !purchase.purchaseToken.trim() || purchase.purchaseToken === token)) {
      throw new Error("Jest did not prove removal of the granted purchase from its complete signed recovery queue.");
    }
    return {passed: true, durableGrantConfirmed, purchaseCompleted, coinsAwarded: expectedCoins,
      achievementBonus, newCoins: first.body.newCoins, idempotentReplay, completed: true};
  } catch (error) {
    return {passed: false, durableGrantConfirmed, purchaseCompleted, idempotentReplay, stage, message: error.message};
  }
}

/** Validates the redacted browser result while keeping settlement checkpoints available on failure. */
export function assertCompletedJestPaymentSettlement(verification) {
  if (verification?.passed !== true || verification.durableGrantConfirmed !== true ||
      verification.purchaseCompleted !== true || verification.idempotentReplay !== true || verification.completed !== true) {
    throw new Error(verification?.passed === false && typeof verification.message === "string"
      ? verification.message : "Jest payment settlement did not return confirmed grant and acknowledgment evidence.");
  }
}

/** Reads the actual initial wallet as an integer and verifies its locale-format round trip in the browser. */
export function readJestPaymentWalletBalance() {
  const text = document.querySelector(".game-header .coin-pill strong")?.textContent?.trim();
  const digits = Array.from({length: 10}, (_, digit) => digit.toLocaleString());
  const normalized = Array.from(text ?? "").filter(character => digits.includes(character))
    .map(character => digits.indexOf(character)).join("");
  const balance = Number(normalized);
  if (!normalized || !Number.isSafeInteger(balance) || balance.toLocaleString() !== text) {
    throw new Error("The initial game wallet did not contain a valid locale-formatted coin balance.");
  }
  return balance;
}

/** Compares the actual wallet's locale-formatted DOM balance; it runs in the game frame. */
export function hasConfirmedJestWalletBalance(expected) {
  const badge = document.querySelector(".game-header .coin-pill strong");
  return Number.isSafeInteger(expected) && badge?.textContent?.trim() === expected.toLocaleString();
}

/** Loads a real hosted frame, verifies exact build identity, and waits for playable server-hydrated startup. */
export async function loadExactJestPaymentGame(page, {gameUrl, gameId, expectedBuildVersion}) {
  await page.goto(gameUrl, {waitUntil: "domcontentloaded", timeout: 30_000});
  await page.waitForFunction((expectedGameId) => [...document.querySelectorAll("iframe")].some((iframe) => {
    try {return new URL(iframe.src).hostname === expectedGameId + ".builds.jest.com";} catch {return false;}
  }), gameId, {timeout: 30_000});
  let game;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    game = page.frames().find((frame) => {
      try {return new URL(frame.url()).hostname === gameId + ".builds.jest.com";} catch {return false;}
    });
    if (game && !game.isDetached()) {
      await page.waitForTimeout(750);
      if (!game.isDetached() && page.frames().includes(game)) break;
    }
    game = undefined;
    await page.waitForTimeout(100);
  }
  if (!game) throw new Error("The exact deployed Jest game iframe was not found.");
  assertExactDeployedJestBuildUrl({buildVersion: expectedBuildVersion, gameId, url: game.url()});
  const playable = game.locator(".onboarding-card-welcome, .riddle-card h1").first();
  const startupError = game.locator(".route-missing");
  await playable.or(startupError).first().waitFor({timeout: 30_000});
  if (await startupError.isVisible()) throw new Error("The exact deployed Jest game did not finish startup.");
  const letsPlay = game.getByRole("button", {name: /let's play/i});
  if (await letsPlay.isVisible()) {
    await letsPlay.click();
    const gotIt = game.getByRole("button", {name: /got it/i});
    if (await gotIt.isVisible()) await gotIt.click();
  }
  await game.locator(".riddle-card h1").waitFor({timeout: 30_000});
  return game;
}

/** Verifies that a fresh app load displays the durable backend balance, including achievement bonuses. */
export async function verifyReloadedJestPaymentWallet(page, input) {
  const game = await loadExactJestPaymentGame(page, input);
  await game.waitForFunction(hasConfirmedJestWalletBalance, input.confirmedBalance, {timeout: 15_000});
  return {game, formattedBalance: await game.locator(".game-header .coin-pill strong").innerText()};
}

/** Captures uncaught errors only inside this game's frame; no host error messages or receipt data are retained. */
export function captureJestPaymentGameErrors({gameId}) {
  if (location.origin !== "https://" + gameId.toLowerCase() + ".builds.jest.com") return;
  const errors = globalThis.__RIDDLE_QUEST_PAYMENT_ERRORS__ = [];
  const category = text => /app.?check|recaptcha/i.test(text) ? "app-check" :
    /requestStorageAccess/i.test(text) ? "storage-access" : /jest|sdk/i.test(text) ? "sdk" : "browser";
  addEventListener("error", event => errors.push({kind: "uncaught-error", category: category(event.message)}));
  addEventListener("unhandledrejection", event => {
    const reason = event.reason;
    const message = typeof reason?.message === "string" ? reason.message : typeof reason === "string" ? reason : "unknown";
    errors.push({kind: "unhandled-rejection", category: category(message)});
  });
}

/** Reads only sanitized diagnostic fields from the instrumented game frame. */
export function readJestPaymentGameErrors() {
  const errors = globalThis.__RIDDLE_QUEST_PAYMENT_ERRORS__;
  if (!Array.isArray(errors)) throw new Error("The exact game frame was not instrumented for payment QA errors.");
  return errors.map(({kind, category}) => ({kind, category}));
}

/** Rejects game errors and game/backend network failures while retaining unrelated host diagnostics as evidence. */
export function assertNoRelevantJestPaymentErrors(diagnostics) {
  if (diagnostics.gameErrors.length || diagnostics.consoleErrors.some(error => error.relevant) ||
      diagnostics.failedRequests.some(request => request.relevant) || diagnostics.httpErrors.some(response => response.relevant)) {
    throw new Error("The game or authoritative backend reported relevant browser errors during payment acceptance.");
  }
}

/** Records useful error categories and fingerprints without raw messages, receipts, query strings, or tokens. */
export function collectRedactedJestPaymentDiagnostics(page, {gameId, functionsBaseUrl}) {
  const diagnostics = {gameErrors: [], consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: []};
  const fingerprint = text => createHash("sha256").update(String(text)).digest("hex").slice(0, 12);
  const category = text => /app.?check|recaptcha/i.test(text) ? "app-check" :
    /requestStorageAccess/i.test(text) ? "storage-access" : /jest|sdk/i.test(text) ? "sdk" : "browser";
  const origin = value => {try {return new URL(value).origin;} catch {return "unknown";}};
  const gameOrigin = "https://" + gameId.toLowerCase() + ".builds.jest.com";
  const backendOrigin = new URL(functionsBaseUrl).origin;
  const relevantNetwork = url => [gameOrigin, backendOrigin].includes(origin(url));
  page.on("console", message => {
    if (message.type() === "error") diagnostics.consoleErrors.push({category: category(message.text()),
      fingerprint: fingerprint(message.text()), relevant: origin(message.location().url) === gameOrigin});
  });
  page.on("pageerror", error => diagnostics.pageErrors.push({category: category(error.message), fingerprint: fingerprint(error.message)}));
  page.on("requestfailed", request => diagnostics.failedRequests.push({origin: origin(request.url()), method: request.method(),
    fingerprint: fingerprint(request.failure()?.errorText || "unknown"), relevant: relevantNetwork(request.url())}));
  page.on("response", response => {
    if (response.status() >= 400) diagnostics.httpErrors.push({origin: origin(response.url()), status: response.status(),
      relevant: relevantNetwork(response.url())});
  });
  return {diagnostics, failure: error => ({category: category(error?.message ?? "unknown"), fingerprint: fingerprint(error?.message ?? "unknown")})};
}
