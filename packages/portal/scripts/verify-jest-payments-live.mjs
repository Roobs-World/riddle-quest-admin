import {existsSync, lstatSync, mkdirSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "@playwright/test";
import {
  assertCompletedJestPaymentSettlement, assertNoRelevantJestPaymentErrors, assertSandboxJestCheckout,
  captureJestPaymentGameErrors,
  collectRedactedJestPaymentDiagnostics, confirmedJestFirstPurchaseBonus, confirmedJestSandboxCoins,
  loadExactJestPaymentGame,
  readJestPaymentCatalog, readJestPaymentGameErrors, readJestPaymentWalletBalance, readJestSandboxCheckout,
  settleSandboxJestPurchase, verifyReloadedJestPaymentWallet,
} from "./jest-payment-live-acceptance.mjs";

const gameId = process.env.JEST_GAME_ID || "019faa68-f3ec-755d-9ab5-c887fb426801";
const gameUrl = process.env.JEST_DEPLOYED_GAME_URL || "https://jest.com/g/riddle-q";
const expectedBuildVersion = process.env.JEST_EXPECTED_BUILD_VERSION;
const evidenceDirectory = process.env.JEST_PAYMENT_EVIDENCE_DIR ||
  fileURLToPath(new URL("../.jest-upload-receipts/payment-qa/", import.meta.url));
const productSku = process.env.JEST_SANDBOX_PAYMENT_SKU ||
  "com.roobsworld.riddlequest.coinpack1";
const subscriptionSku = process.env.JEST_SANDBOX_SUBSCRIPTION_SKU ||
  "com.roobsworld.riddlequest.premium.monthly";
const statePath = process.env.JEST_SANDBOX_STORAGE_STATE ||
  "/tmp/riddle-quest-jest-sandbox-state.json";
const functionsBaseUrl = process.env.JEST_FUNCTIONS_BASE_URL ||
  "https://us-central1-riddle-quest-ec2b2.cloudfunctions.net";
const expectedCoins = confirmedJestSandboxCoins(productSku);

if (!expectedBuildVersion) throw new Error("JEST_EXPECTED_BUILD_VERSION is required for exact-build verification.");
if (!existsSync(statePath)) throw new Error(`Missing Jest sandbox browser state: ${statePath}`);
const stateMetadata = lstatSync(statePath);
if (!stateMetadata.isFile() || stateMetadata.isSymbolicLink() || (stateMetadata.mode & 0o777) !== 0o600) {
  throw new Error(`Jest sandbox browser state must be a regular owner-only 0600 file: ${statePath}`);
}
if (typeof process.getuid === "function" && stateMetadata.uid !== process.getuid()) {
  throw new Error(`Jest sandbox browser state must be owned by the current user: ${statePath}`);
}
if (process.env.JEST_SANDBOX_PAYMENT_CONFIRM !== productSku) {
  throw new Error(`Set JEST_SANDBOX_PAYMENT_CONFIRM=${productSku} to authorize the zero-dollar sandbox purchase.`);
}

const browser = await chromium.launch({headless: process.env.JEST_DEPLOYED_HEADED !== "1"});
const context = await browser.newContext({storageState: statePath, viewport: {width: 390, height: 844}});
await context.addInitScript(captureJestPaymentGameErrors, {gameId});
if (process.env.FIREBASE_APPCHECK_DEBUG_TOKEN) {
  await context.addInitScript((token) => {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }, process.env.FIREBASE_APPCHECK_DEBUG_TOKEN);
}
const page = await context.newPage();
const {diagnostics, failure} = collectRedactedJestPaymentDiagnostics(page, {gameId, functionsBaseUrl});
let stage = "startup";
let verification;
let game;
let gameErrorsRecorded = 0;
const collectGameErrors = async () => {
  const errors = await game.evaluate(readJestPaymentGameErrors);
  diagnostics.gameErrors.push(...errors.slice(gameErrorsRecorded));
  gameErrorsRecorded = errors.length;
};
const recordEvidence = (summary) => {
  mkdirSync(evidenceDirectory, {recursive: true, mode: 0o700});
  const output = path.join(evidenceDirectory, "EVIDENCE-" + Date.now() + ".json");
  writeFileSync(output, JSON.stringify({...summary, diagnostics}, null, 2) + "\n", {flag: "wx", mode: 0o600});
};

try {
  game = await loadExactJestPaymentGame(page, {gameUrl, gameId, expectedBuildVersion});
  await game.waitForFunction(() => {
    try {return typeof globalThis.JestSDK?.getPlayer().playerId === "string";} catch {return false;}
  }, undefined, {timeout: 30_000});

  const catalog = await game.evaluate(readJestPaymentCatalog,
    {expectedProductSku: productSku, expectedSubscriptionSku: subscriptionSku});

  if (!catalog.product || !Number.isFinite(catalog.product.price) || catalog.product.currency !== "USD") {
    throw new Error(`Jest product ${productSku} is missing a valid USD price.`);
  }
  if (!catalog.subscription || !Number.isFinite(catalog.subscription.price) ||
      catalog.subscription.currency !== "USD" || catalog.subscription.billingPeriod !== "monthly") {
    throw new Error(`Jest subscription ${subscriptionSku} is missing valid monthly USD billing.`);
  }
  if (!catalog.incomplete.signed) throw new Error("Jest returned an unsigned purchase recovery queue.");
  if (catalog.incomplete.hasMore !== false || catalog.incomplete.count !== 0) {
    throw new Error("The application did not drain the Jest purchase recovery queue before becoming playable.");
  }
  await collectGameErrors();
  assertNoRelevantJestPaymentErrors(diagnostics);
  const initialCoins = await game.evaluate(readJestPaymentWalletBalance);

  stage = "sandbox checkout";
  await game.evaluate((sku) => {
    globalThis.__RIDDLE_QUEST_PAYMENT_TEST__ = globalThis.JestSDK.payments.beginPurchase({productSku: sku});
  }, productSku);
  await page.getByText(/Sandbox mode\. You won't be charged for this purchase\./i)
    .waitFor({state: "visible", timeout: 15_000});
  await page.getByRole("button", {name: /get with jest (?:balance|wallet|credits)/i}).click({timeout: 5_000});
  const purchase = await game.evaluate(readJestSandboxCheckout);
  assertSandboxJestCheckout(purchase, productSku);

  stage = "authoritative grant and replay";
  verification = await game.evaluate(settleSandboxJestPurchase, {
    baseUrl: functionsBaseUrl.replace(/\/$/, ""),
    signed: purchase.purchaseSigned,
    token: purchase.purchase.purchaseToken,
    expectedCoins,
    initialCoins,
    expectedAchievementBonus: confirmedJestFirstPurchaseBonus,
  });
  assertCompletedJestPaymentSettlement(verification);
  await collectGameErrors();
  assertNoRelevantJestPaymentErrors(diagnostics);

  stage = "reloaded app wallet";
  const restoredBalance = await verifyReloadedJestPaymentWallet(page, {
    gameUrl, gameId, expectedBuildVersion, confirmedBalance: verification.newCoins,
  });
  game = restoredBalance.game;
  gameErrorsRecorded = 0;
  await collectGameErrors();
  assertNoRelevantJestPaymentErrors(diagnostics);
  mkdirSync(evidenceDirectory, {recursive: true, mode: 0o700});
  const screenshot = path.join(evidenceDirectory, "payment-balance-" + Date.now() + ".png");
  writeFileSync(screenshot, "", {flag: "wx", mode: 0o600});
  await restoredBalance.game.locator(".game-header").screenshot({path: screenshot});
  const summary = {
    passed: true,
    build: expectedBuildVersion,
    coinsExpected: expectedCoins,
    initialCoins,
    newCoins: verification.newCoins,
    reloadedCoinBadgeVerified: true,
    formattedBalance: restoredBalance.formattedBalance,
    checkout: "sandbox-zero-dollar",
    productSku,
    productPrice: catalog.product.price,
    productCurrency: catalog.product.currency,
    subscriptionSku,
    subscriptionPrice: catalog.subscription.price,
    ...verification,
  };
  recordEvidence(summary);
  console.log(JSON.stringify({...summary, diagnostics}, null, 2));
} catch (error) {
  if (game && !game.isDetached()) {
    await collectGameErrors().catch(() => {});
  }
  recordEvidence({passed: false, stage, ...failure(error),
    durableGrantConfirmed: verification?.durableGrantConfirmed ?? null,
    purchaseCompleted: verification?.purchaseCompleted ?? null,
    settlementStage: verification?.stage ?? null});
  console.error("Sandbox payment QA failed during " + stage + "; only redacted evidence was saved.");
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
