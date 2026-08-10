import {existsSync} from "node:fs";
import {chromium} from "@playwright/test";

const gameId = process.env.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
const gameUrl = process.env.JEST_DEPLOYED_GAME_URL || "https://jest.com/g/riddle-q";
const productSku = process.env.JEST_SANDBOX_PAYMENT_SKU ||
  "com.roobsworld.riddlequest.coinpack1";
const subscriptionSku = process.env.JEST_SANDBOX_SUBSCRIPTION_SKU ||
  "com.roobsworld.riddlequest.premium.monthly";
const statePath = process.env.JEST_SANDBOX_STORAGE_STATE ||
  "/tmp/riddle-quest-jest-sandbox-state.json";
const functionsBaseUrl = process.env.JEST_FUNCTIONS_BASE_URL ||
  "https://us-central1-riddle-quest-ec2b2.cloudfunctions.net";

if (!existsSync(statePath)) {
  throw new Error(`Missing Jest sandbox browser state: ${statePath}`);
}
if (process.env.JEST_SANDBOX_PAYMENT_CONFIRM !== productSku) {
  throw new Error(`Set JEST_SANDBOX_PAYMENT_CONFIRM=${productSku} to authorize the zero-dollar sandbox purchase.`);
}

const browser = await chromium.launch({headless: process.env.JEST_DEPLOYED_HEADED !== "1"});
const context = await browser.newContext({storageState: statePath, viewport: {width: 390, height: 844}});
if (process.env.FIREBASE_APPCHECK_DEBUG_TOKEN) {
  await context.addInitScript((token) => {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }, process.env.FIREBASE_APPCHECK_DEBUG_TOKEN);
}
const page = await context.newPage();

try {
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
  await page.waitForTimeout(1_000);

  const game = page.frames().find((frame) => {
    try {
      return new URL(frame.url()).hostname === `${gameId}.builds.jest.com`;
    } catch {
      return false;
    }
  });
  if (!game) throw new Error("The deployed Jest game frame was not found.");
  await game.waitForFunction(() => {
    try {
      return typeof globalThis.JestSDK?.getPlayer().playerId === "string";
    } catch {
      return false;
    }
  }, undefined, {timeout: 30_000});

  const catalog = await game.evaluate(async ({expectedProductSku, expectedSubscriptionSku}) => {
    const [products, subscriptions, incomplete] = await Promise.all([
      globalThis.JestSDK.payments.getProducts(),
      globalThis.JestSDK.payments.getSubscriptions(),
      globalThis.JestSDK.payments.getIncompletePurchases(),
    ]);
    return {
      product: products.find(({sku}) => sku === expectedProductSku),
      subscription: subscriptions.subscriptions.find(({sku}) => sku === expectedSubscriptionSku),
      incomplete: {
        hasMore: incomplete.hasMore,
        signed: typeof incomplete.purchasesSigned === "string",
      },
    };
  }, {expectedProductSku: productSku, expectedSubscriptionSku: subscriptionSku});

  if (!catalog.product || !Number.isFinite(catalog.product.price) || catalog.product.currency !== "USD") {
    throw new Error(`Jest product ${productSku} is missing a valid USD price.`);
  }
  if (
    !catalog.subscription ||
    !Number.isFinite(catalog.subscription.price) ||
    catalog.subscription.currency !== "USD" ||
    catalog.subscription.billingPeriod !== "monthly"
  ) {
    throw new Error(`Jest subscription ${subscriptionSku} is missing valid monthly USD billing.`);
  }
  if (!catalog.incomplete.signed) throw new Error("Jest returned an unsigned purchase recovery queue.");

  await game.evaluate((sku) => {
    globalThis.__RIDDLE_QUEST_PAYMENT_TEST__ = globalThis.JestSDK.payments.beginPurchase({productSku: sku});
  }, productSku);

  const sandboxNotice = page.getByText(/Sandbox mode\. You won't be charged for this purchase\./i);
  await sandboxNotice.waitFor({state: "visible", timeout: 15_000});
  await page.getByRole("button", {name: /get with jest balance/i}).click();

  const purchase = await game.evaluate(async () => await globalThis.__RIDDLE_QUEST_PAYMENT_TEST__);
  if (
    purchase?.result !== "success" ||
    purchase.purchase?.productSku !== productSku ||
    typeof purchase.purchase.purchaseToken !== "string" ||
    typeof purchase.purchaseSigned !== "string"
  ) {
    throw new Error(`Jest sandbox checkout did not return a valid signed purchase (${purchase?.result ?? "unknown"}).`);
  }

  const verification = await game.evaluate(async ({baseUrl, signed, token}) => {
    const playerId = globalThis.JestSDK.getPlayer().playerId;
    const grant = async () => {
      const response = await fetch(`${baseUrl}/grantJestPurchase`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({purchaseSigned: signed, playerId, purchaseToken: token}),
      });
      return {ok: response.ok, body: await response.json()};
    };
    const first = await grant();
    const replay = await grant();
    const completed = await globalThis.JestSDK.payments.completePurchase({purchaseToken: token});
    const remaining = await globalThis.JestSDK.payments.getIncompletePurchases();
    return {
      first,
      replay,
      completed,
      stillIncomplete: remaining.purchases.some(({purchaseToken}) => purchaseToken === token),
    };
  }, {
    baseUrl: functionsBaseUrl.replace(/\/$/, ""),
    signed: purchase.purchaseSigned,
    token: purchase.purchase.purchaseToken,
  });

  if (!verification.first.ok || verification.first.body.alreadyProcessed !== false) {
    throw new Error("The authoritative backend did not grant the new Jest purchase exactly once.");
  }
  if (
    !verification.replay.ok ||
    verification.replay.body.alreadyProcessed !== true ||
    verification.replay.body.newCoins !== verification.first.body.newCoins
  ) {
    throw new Error("The authoritative backend did not reject the replay idempotently.");
  }
  if (verification.completed?.result !== "success" || verification.stillIncomplete) {
    throw new Error("Jest did not complete and remove the granted purchase from recovery.");
  }

  console.log(JSON.stringify({
    checkout: "sandbox-zero-dollar",
    productSku,
    productPrice: catalog.product.price,
    productCurrency: catalog.product.currency,
    subscriptionSku,
    subscriptionPrice: catalog.subscription.price,
    coinsAwarded: verification.first.body.coinsAwarded,
    idempotentReplay: true,
    completed: true,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
