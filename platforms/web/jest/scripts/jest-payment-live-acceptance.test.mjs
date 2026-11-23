import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {Script} from "node:vm";
import test from "node:test";
import {JEST_COIN_PRODUCTS} from "../../../../platforms/web/jest/server/jestProductCatalog.ts";
import {ACHIEVEMENT_UNLOCK_COIN_REWARD} from "../../../../firebase-functions/src/shared/constants.ts";
import {
  assertCompletedJestPaymentSettlement, assertNoRelevantJestPaymentErrors, assertSandboxJestCheckout,
  captureJestPaymentGameErrors,
  collectRedactedJestPaymentDiagnostics, confirmedJestFirstPurchaseBonus, confirmedJestSandboxCoins,
  hasConfirmedJestWalletBalance,
  readJestPaymentCatalog, readJestPaymentGameErrors, readJestPaymentWalletBalance, readJestSandboxCheckout,
  settleSandboxJestPurchase, verifyReloadedJestPaymentWallet,
} from "./jest-payment-live-acceptance.mjs";

const sku = "com.roobsworld.riddlequest.coinpack1";
const token = "test-purchase-token";
const successGrant = {granted: true, alreadyProcessed: false, purchaseToken: token, coinsAwarded: 250,
  newCoins: 450, newlyUnlockedAchievementIds: []};
const successReplay = {...successGrant, alreadyProcessed: true};

/** Runs the actual exported callback as Playwright does, with isolated backend/SDK globals and no network. */
async function settlement(options = {}) {
  const calls = [];
  const timers = [];
  let incomplete = true;
  let grantCount = 0;
  let acknowledged = 0;
  let lateCompletion;
  const globals = {
    AbortController,
    setTimeout: (callback, delay) => {
      assert.equal(delay, 15_000, "grant, body, and SDK reads must use the real 15-second bound");
      const timer = {cleared: false};
      timers.push(timer);
      if (options.stall?.grant === grantCount + 1 ||
          options.sdkStall === "complete" && timers.length === 3 ||
          options.sdkStall === "recovery" && timers.length === 4) {
        queueMicrotask(() => {if (!timer.cleared) callback();});
      }
      return timer;
    },
    clearTimeout: timer => {timer.cleared = true;},
    fetch: async (url, request) => {
      grantCount += 1;
      calls.push("grant-" + grantCount);
      assert.equal(url, "https://test.invalid/grantJestPurchase");
      assert.deepEqual(JSON.parse(request.body), {purchaseSigned: "test-signed-receipt", playerId: "test-player", purchaseToken: token});
      const abort = () => new Promise((_, reject) => {
        if (request.signal.aborted) reject(new Error("test abort"));
        else request.signal.addEventListener("abort", () => reject(new Error("test abort")), {once: true});
      });
      if (options.stall?.grant === grantCount && options.stall.where === "fetch") return abort();
      if (options.transport === grantCount) throw new Error("test transport failure with private receipt");
      const response = grantCount === 1 ? options.first ?? {ok: true, body: successGrant} : options.replay ?? {ok: true, body: successReplay};
      return {ok: response.ok, json: async () => {
        if (options.stall?.grant === grantCount && options.stall.where === "body") return abort();
        if (options.badJson === grantCount) throw new Error("test malformed private receipt");
        return structuredClone(response.body);
      }};
    },
    JestSDK: {
      getPlayer: () => ({playerId: Object.hasOwn(options, "playerId") ? options.playerId : "test-player"}),
      payments: {
        completePurchase: async input => {
          assert.equal(input.purchaseToken, token);
          acknowledged += 1;
          calls.push("complete");
          if (options.sdkStall === "complete") return new Promise(resolve => {
            lateCompletion = () => {incomplete = false; resolve({result: "success"});};
          });
          if (options.completeThrows) throw new Error("test private SDK error");
          const result = Object.hasOwn(options, "completion") ? options.completion : {result: "success"};
          if (result?.result === "success" && !options.keepIncomplete) incomplete = false;
          return result;
        },
        getIncompletePurchases: async () => {
          calls.push("recovery-read");
          if (options.sdkStall === "recovery") return new Promise(() => {});
          if (options.recoveryThrows) throw new Error("test private queue error");
          return Object.hasOwn(options, "recovery") ? options.recovery : {
            purchases: incomplete ? [{purchaseToken: token}] : [], hasMore: false, purchasesSigned: "test-signed-queue",
          };
        },
      },
    },
  };
  const callback = new Script("(" + settleSandboxJestPurchase.toString() + ")").runInNewContext(globals);
  let result;
  let error;
  let verification;
  try {
    verification = await callback({baseUrl: "https://test.invalid", signed: "test-signed-receipt", token,
      expectedCoins: 250, initialCoins: 200, expectedAchievementBonus: confirmedJestFirstPurchaseBonus, ...options.input});
    assertCompletedJestPaymentSettlement(verification);
    result = verification;
  }
  catch (caught) {error = caught;}
  assert.ok(timers.every(timer => timer.cleared), "every deadline timer must be cleared on success or rejection");
  return {result, error, verification, calls, timers, incomplete, acknowledged, lateCompletion};
}

test("the confirmed sandbox SKU matches the authoritative 250-coin catalog", () => {
  assert.equal(confirmedJestSandboxCoins(sku), JEST_COIN_PRODUCTS[sku]);
  assert.equal(confirmedJestSandboxCoins(sku), 250);
  assert.equal(confirmedJestFirstPurchaseBonus, ACHIEVEMENT_UNLOCK_COIN_REWARD);
  assert.throws(() => confirmedJestSandboxCoins("another-product"));
});

test("checkout must be zero-dollar sandbox, signed, and bound to the confirmed SKU/token", () => {
  const valid = {result: "success", purchase: {productSku: sku, purchaseToken: token, sandbox: true, price: 0}, purchaseSigned: "test-receipt"};
  assert.doesNotThrow(() => assertSandboxJestCheckout(valid, sku));
  for (const changed of [{result: "cancelled"}, {purchaseSigned: ""}, {purchaseSigned: undefined},
    {purchase: {...valid.purchase, sandbox: false}}, {purchase: {...valid.purchase, price: 0.99}},
    {purchase: {...valid.purchase, productSku: "another-product"}}, {purchase: {...valid.purchase, purchaseToken: " "}}]) {
    assert.throws(() => assertSandboxJestCheckout({...valid, ...changed}, sku));
  }
});

/** Drives an exported browser callback with an advancing fake deadline and no browser, network, or wall-clock delay. */
async function boundedRead(callback, globals, input, {delay, expires = false}) {
  const timers = [];
  const browserCallback = new Script("(" + callback.toString() + ")").runInNewContext({
    ...globals, setTimeout: (callback, milliseconds) => {
      assert.equal(milliseconds, delay);
      const timer = {cleared: false};
      timers.push(timer);
      if (expires) queueMicrotask(() => {if (!timer.cleared) callback();});
      return timer;
    }, clearTimeout: timer => {timer.cleared = true;},
  });
  let result;
  let error;
  try {result = await browserCallback(input);} catch (caught) {error = caught;}
  assert.equal(timers.length, 1);
  assert.ok(timers.every(timer => timer.cleared));
  return {result, error};
}

function catalogSdk({stall, rejects, malformed = false} = {}) {
  const calls = [];
  const subscriptions = {subscriptions: [{sku: "monthly", price: 4.99, billingPeriod: "monthly", currency: "USD"}]};
  const values = {getProducts: [{sku, price: 0.99, currency: "USD"}], getSubscriptions: subscriptions,
    getIncompletePurchases: {purchases: [], hasMore: false, purchasesSigned: "private-signed-queue"}};
  const payments = Object.fromEntries(Object.keys(values).map(name => [name, () => {
    calls.push(name);
    if (stall === name) return new Promise(() => {});
    if (rejects === name) return Promise.reject(new Error("fake-sensitive-signature"));
    return Promise.resolve(malformed && name === "getProducts" ? null : values[name]);
  }]));
  return {calls, globals: {JestSDK: {payments}}};
}
const catalogInput = {expectedProductSku: sku, expectedSubscriptionSku: "monthly"};
test("bounded catalog uses all actual SDK reads and returns only the selected products and redacted signed queue shape", async () => {
  const sdk = catalogSdk();
  const {result, error} = await boundedRead(readJestPaymentCatalog, sdk.globals, catalogInput, {delay: 15_000});
  assert.equal(error, undefined);
  assert.equal(result.product.sku, sku);
  assert.equal(result.subscription.sku, "monthly");
  assert.deepEqual(JSON.parse(JSON.stringify(result.incomplete)), {count: 0, hasMore: false, signed: true});
  assert.doesNotMatch(JSON.stringify(result), /private-signed-queue/);
  assert.deepEqual(sdk.calls, ["getProducts", "getSubscriptions", "getIncompletePurchases"]);
});
for (const method of ["getProducts", "getSubscriptions", "getIncompletePurchases"]) {
  test(method + " cannot hang the catalog or restart any SDK read", async () => {
    const sdk = catalogSdk({stall: method});
    const {error, result} = await boundedRead(readJestPaymentCatalog, sdk.globals, catalogInput, {delay: 15_000, expires: true});
    assert.match(error.message, /15-second bound/);
    assert.equal(result, undefined);
    assert.deepEqual(sdk.calls, ["getProducts", "getSubscriptions", "getIncompletePurchases"]);
  });
  test(method + " rejection cannot expose private SDK errors", async () => {
    const sdk = catalogSdk({rejects: method});
    const {error} = await boundedRead(readJestPaymentCatalog, sdk.globals, catalogInput, {delay: 15_000});
    assert.match(error.message, /payment catalog could not be confirmed/);
    assert.doesNotMatch(error.message, /fake-sensitive-signature/);
  });
}
test("malformed catalogs fail within the bound and clear the timer", async () => {
  const sdk = catalogSdk({malformed: true});
  const {error} = await boundedRead(readJestPaymentCatalog, sdk.globals, catalogInput, {delay: 15_000});
  assert.match(error.message, /payment catalog could not be confirmed/);
});
test("successful checkout returns its existing receipt without restarting or acknowledging it", async () => {
  const receipt = {result: "success", purchase: {purchaseToken: token}};
  const {result, error} = await boundedRead(readJestSandboxCheckout,
    {__RIDDLE_QUEST_PAYMENT_TEST__: Promise.resolve(receipt)}, undefined, {delay: 60_000});
  assert.equal(error, undefined);
  assert.equal(result, receipt);
});
test("stalled checkout times out after its post-confirmation 60-second bound without any SDK calls", async () => {
  const {result, error} = await boundedRead(readJestSandboxCheckout,
    {__RIDDLE_QUEST_PAYMENT_TEST__: new Promise(() => {})}, undefined, {delay: 60_000, expires: true});
  assert.equal(result, undefined);
  assert.match(error.message, /60-second bound/);
});
test("checkout rejection exposes no raw receipt or SDK error and clears the deadline", async () => {
  const {error} = await boundedRead(readJestSandboxCheckout,
    {__RIDDLE_QUEST_PAYMENT_TEST__: Promise.reject(new Error("fake-sensitive-signature"))}, undefined, {delay: 60_000});
  assert.match(error.message, /60-second bound/);
  assert.doesNotMatch(error.message, /fake-sensitive-signature/);
});

const invalidGrants = [
  ["rejected first grant", {first: {ok: false, body: {error: "unavailable"}}}],
  ["unknown first grant", {first: {ok: true, body: null}}],
  ["missing durable grant flag", {first: {ok: true, body: {...successGrant, granted: undefined}}}],
  ["wrong 250-coin award", {first: {ok: true, body: {...successGrant, coinsAwarded: 500}}}],
  ["mismatched first token", {first: {ok: true, body: {...successGrant, purchaseToken: "another-token"}}}],
  ["unexpected first replay", {first: {ok: true, body: successReplay}}],
  ["malformed authoritative balance", {first: {ok: true, body: {...successGrant, newCoins: "450"}}}],
  ["unsafe authoritative balance", {first: {ok: true, body: {...successGrant, newCoins: Number.MAX_SAFE_INTEGER + 1}}}],
  ["balance below awarded coins", {first: {ok: true, body: {...successGrant, newCoins: 200}}}],
  ["unchanged existing wallet balance", {input: {initialCoins: 1000}, first: {ok: true, body: {...successGrant, newCoins: 1000}}}],
  ["decreased existing wallet balance", {input: {initialCoins: 1000}, first: {ok: true, body: {...successGrant, newCoins: 900}}}],
  ["unexpected extra coins", {first: {ok: true, body: {...successGrant, newCoins: 476}}}],
  ["bonus without achievement", {first: {ok: true, body: {...successGrant, newCoins: 475}}}],
  ["missing achievement shape", {first: {ok: true, body: {...successGrant, newlyUnlockedAchievementIds: undefined}}}],
  ["wrong achievement", {first: {ok: true, body: {...successGrant, newlyUnlockedAchievementIds: ["unrelated"]}}}],
  ["duplicate first purchase bonus", {first: {ok: true, body: {...successGrant, newCoins: 500, newlyUnlockedAchievementIds: ["first_purchase", "first_purchase"]}}}],
  ["replay achievement bonus", {replay: {ok: true, body: {...successReplay, newlyUnlockedAchievementIds: ["first_purchase"]}}}],
  ["rejected replay", {replay: {ok: false, body: {error: "unavailable"}}}],
  ["unknown replay", {replay: {ok: true, body: []}}],
  ["missing replay grant flag", {replay: {ok: true, body: {...successReplay, granted: false}}}],
  ["missing idempotent replay", {replay: {ok: true, body: {...successReplay, alreadyProcessed: false}}}],
  ["mismatched replay token", {replay: {ok: true, body: {...successReplay, purchaseToken: "another-token"}}}],
  ["changed replay award", {replay: {ok: true, body: {...successReplay, coinsAwarded: 500}}}],
  ["changed replay balance", {replay: {ok: true, body: {...successReplay, newCoins: 700}}}],
  ["first transport failure", {transport: 1}], ["replay transport failure", {transport: 2}],
  ["first JSON failure", {badJson: 1}], ["replay JSON failure", {badJson: 2}],
];
for (const [name, input] of invalidGrants) {
  test(name + " leaves its purchase incomplete and never acknowledges it", async () => {
    const result = await settlement(input);
    assert.equal(result.acknowledged, 0, "failed grant must not acknowledge a purchase");
    assert.equal(result.incomplete, true, "failed grant must retain the recovery token");
    assert.ok(result.error);
    assert.ok(result.timers.every(timer => timer.cleared));
    assert.doesNotMatch(result.error.message, /test-purchase-token|test-signed-receipt|private receipt/);
  });
}

for (const grant of [1, 2]) for (const where of ["fetch", "body"]) {
  test("grant " + grant + " " + where + " timeout aborts without acknowledgment", async () => {
    const result = await settlement({stall: {grant, where}});
    assert.match(result.error.message, /exceeded 15 seconds/);
    assert.equal(result.acknowledged, 0);
    assert.equal(result.incomplete, true);
    assert.ok(result.timers.every(timer => timer.cleared));
  });
}

test("missing receipt/token/player identity or wrong expected award cannot call the backend", async () => {
  for (const input of [{input: {signed: " "}}, {input: {token: ""}}, {input: {expectedCoins: 500}},
    {input: {initialCoins: -1}}, {input: {initialCoins: "200"}}, {input: {initialCoins: Number.MAX_SAFE_INTEGER}},
    {input: {expectedAchievementBonus: 50}},
    {playerId: " "}, {playerId: null}]) {
    const result = await settlement(input);
    assert.ok(result.error);
    assert.deepEqual(result.calls, []);
    assert.equal(result.incomplete, true);
  }
});

test("durable grant and idempotent replay precede one completion and exhaustive signed recovery inspection", async () => {
  const result = await settlement();
  assert.equal(result.error, undefined);
  assert.deepEqual(result.calls, ["grant-1", "grant-2", "complete", "recovery-read"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.result)), {passed: true, durableGrantConfirmed: true,
    purchaseCompleted: true, coinsAwarded: 250, achievementBonus: 0, newCoins: 450, idempotentReplay: true, completed: true});
  assert.equal(result.incomplete, false);
  assert.equal(result.acknowledged, 1);
  assert.equal(result.timers.length, 4);
  assert.ok(result.timers.every(timer => timer.cleared));
});

for (const completion of [{result: "error"}, {result: "cancelled"}, {}, undefined]) {
  test("unconfirmed SDK completion remains recoverable: " + (completion?.result ?? "missing"), async () => {
    const result = await settlement({completion});
    assert.match(result.error.message, /did not confirm acknowledgment/);
    assert.equal(result.incomplete, true);
    assert.equal(result.acknowledged, 1);
    assert.equal(result.calls.includes("recovery-read"), false);
  });
}
test("throwing SDK completion cannot claim success", async () => {
  const result = await settlement({completeThrows: true});
  assert.match(result.error.message, /did not confirm acknowledgment/);
  assert.equal(result.incomplete, true);
  assert.equal(result.verification.durableGrantConfirmed, true);
  assert.equal(result.verification.purchaseCompleted, null);
  assert.doesNotMatch(result.error.message, /private SDK/);
});

test("an acknowledgment deadline reports unknown state and never starts another acknowledgment or recovery read", async () => {
  const result = await settlement({sdkStall: "complete"});
  assert.match(result.error.message, /15-second bound; completion state is unknown/);
  assert.equal(result.result, undefined);
  assert.deepEqual(result.calls, ["grant-1", "grant-2", "complete"]);
  assert.equal(result.acknowledged, 1);
  assert.equal(result.incomplete, true);
  result.lateCompletion();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(result.calls, ["grant-1", "grant-2", "complete"], "late success must not resume timed-out acceptance");
});

test("a recovery deadline after confirmed acknowledgment cannot claim removal or start another SDK call", async () => {
  const result = await settlement({sdkStall: "recovery"});
  assert.match(result.error.message, /could not be inspected within its 15-second bound/);
  assert.equal(result.result, undefined);
  assert.equal(result.incomplete, false);
  assert.equal(result.verification.durableGrantConfirmed, true);
  assert.equal(result.verification.purchaseCompleted, true);
  assert.deepEqual(result.calls, ["grant-1", "grant-2", "complete", "recovery-read"]);
  assert.equal(result.acknowledged, 1);
});

for (const recovery of [null, {}, {purchases: "invalid", hasMore: false, purchasesSigned: "signed"},
  {purchases: [], hasMore: true, purchasesSigned: "signed"}, {purchases: [], hasMore: false},
  {purchases: [], hasMore: false, purchasesSigned: ""}, {purchases: [null], hasMore: false, purchasesSigned: "signed"}]) {
  test("malformed/unsigned/paginated recovery cannot prove removal " + JSON.stringify(recovery), async () => {
    const result = await settlement({recovery});
    assert.match(result.error.message, /complete signed recovery queue/);
    assert.equal(result.result, undefined);
  });
}
test("a still-incomplete granted token or failed recovery read cannot be reported complete", async () => {
  const retained = await settlement({keepIncomplete: true});
  assert.match(retained.error.message, /complete signed recovery queue/);
  const unavailable = await settlement({recoveryThrows: true});
  assert.match(unavailable.error.message, /could not be inspected/);
  assert.doesNotMatch(unavailable.error.message, /private queue/);
  assert.equal(unavailable.verification.durableGrantConfirmed, true);
  assert.equal(unavailable.verification.purchaseCompleted, true);
});

test("grant/replay/ack failures retain truthful redacted settlement checkpoints", async () => {
  const unknown = await settlement({transport: 1});
  assert.equal(unknown.verification.durableGrantConfirmed, null);
  assert.equal(unknown.verification.purchaseCompleted, false);
  const replay = await settlement({transport: 2});
  assert.equal(replay.verification.durableGrantConfirmed, true);
  assert.equal(replay.verification.purchaseCompleted, false);
  assert.equal(replay.verification.stage, "replay");
  const ack = await settlement({completeThrows: true});
  assert.equal(ack.verification.durableGrantConfirmed, true);
  assert.equal(ack.verification.purchaseCompleted, null);
  assert.doesNotMatch(JSON.stringify([unknown.verification, replay.verification, ack.verification]), /test-signed-receipt|test-purchase-token|private/);
});

test("the balance increase accepts an authoritative first-purchase achievement bonus", async () => {
  const grant = {...successGrant, newCoins: 475, newlyUnlockedAchievementIds: ["first_purchase"]};
  const result = await settlement({first: {ok: true, body: grant}, replay: {ok: true, body: {...grant, alreadyProcessed: true, newlyUnlockedAchievementIds: []}}});
  assert.equal(result.error, undefined);
  assert.equal(result.result.newCoins, 475);
  assert.equal(result.result.achievementBonus, 25);
});

const gameId = "019faa68-f3ec-755d-9ab5-c887fb426801";
const buildVersion = "1.0.0-test";
function walletPage({balance = 1234, older = false, failedStartup = false} = {}) {
  const navigations = [];
  const locator = selector => {
    const result = {first: () => result, or: () => result, waitFor: async () => {},
      isVisible: async () => selector === ".route-missing" && failedStartup,
      innerText: async () => balance.toLocaleString(), click: async () => {}};
    return result;
  };
  const game = {
    url: () => "https://" + gameId + ".builds.jest.com/" + gameId + "/" + (older ? "older-build" : buildVersion) + "/index.html",
    isDetached: () => false, locator, getByRole: () => locator("role"),
    waitForFunction: async (callback, expected, options) => {
      assert.equal(options.timeout, 15_000);
      const predicate = new Script("(" + callback.toString() + ")").runInNewContext({
        document: {querySelector: selector => {
          assert.equal(selector, ".game-header .coin-pill strong");
          return {textContent: balance.toLocaleString()};
        }},
      });
      if (!predicate(expected)) throw new Error("Wallet badge did not match the confirmed backend balance");
    },
  };
  return {navigations, page: {goto: async url => {navigations.push(url);}, waitForFunction: async () => {},
    frames: () => [game], waitForTimeout: async () => {}}};
}
const walletInput = {gameId, expectedBuildVersion: buildVersion, gameUrl: "https://jest.com/g/riddle-q?versionId=test", confirmedBalance: 1234};
test("wallet acceptance reloads the exact app and compares its locale-formatted authoritative balance", async () => {
  const loaded = walletPage();
  const result = await verifyReloadedJestPaymentWallet(loaded.page, walletInput);
  assert.deepEqual(loaded.navigations, [walletInput.gameUrl]);
  assert.equal(result.formattedBalance, (1234).toLocaleString());
});
for (const [name, options] of [["stale wallet", {balance: 984}], ["older build", {older: true}], ["failed startup", {failedStartup: true}]]) {
  test(name + " fails reloaded wallet acceptance", async () => {
    await assert.rejects(verifyReloadedJestPaymentWallet(walletPage(options).page, walletInput));
  });
}
test("the actual wallet predicate rejects stale locale formatting and missing badges", () => {
  const predicate = textContent => new Script("(" + hasConfirmedJestWalletBalance.toString() + ")").runInNewContext({document: {querySelector: () => textContent == null ? null : {textContent}}});
  assert.equal(predicate((1234).toLocaleString())(1234), true);
  assert.equal(predicate((1234).toLocaleString("de-DE"))(1234), (1234).toLocaleString("de-DE") === (1234).toLocaleString());
  assert.equal(predicate(null)(1234), false);
  assert.equal(predicate("1234")("1234"), false);
});

test("the initial wallet parser validates locale formatting and rejects missing/negative/malformed balances", () => {
  const read = textContent => new Script("(" + readJestPaymentWalletBalance.toString() + ")()").runInNewContext({
    document: {querySelector: () => textContent == null ? null : {textContent}},
  });
  assert.equal(read((1234).toLocaleString()), 1234);
  assert.equal(read((0).toLocaleString()), 0);
  for (const locale of ["ar-EG", "de-DE", "hi-IN"]) {
    const textContent = (1234567).toLocaleString(locale);
    const script = "Number.prototype.toLocaleString = function() {return new Intl.NumberFormat(" + JSON.stringify(locale) + ").format(Number(this));}; (" + readJestPaymentWalletBalance.toString() + ")()";
    assert.equal(new Script(script).runInNewContext({document: {querySelector: () => ({textContent})}}), 1234567);
  }
  for (const invalid of [null, "-1", "not a wallet 1234", "1x234", "", "9007199254740992"]) assert.throws(() => read(invalid));
});

test("diagnostics preserve useful categories/statuses without raw errors, receipts, credentials, or query codes", () => {
  const page = new EventEmitter();
  const {diagnostics, failure} = collectRedactedJestPaymentDiagnostics(page, {gameId, functionsBaseUrl: "https://backend.invalid"});
  const secret = "fake-sensitive-signature";
  page.emit("console", {type: () => "error", text: () => "Jest SDK purchaseSigned=" + secret, location: () => ({url: "https://jest.com"})});
  page.emit("pageerror", new Error("App Check " + secret));
  page.emit("requestfailed", {url: () => "https://user:" + secret + "@jest.com/private?l=Ab12Cd34", method: () => "POST", failure: () => ({errorText: secret})});
  page.emit("response", {url: () => "https://jest.com/private?token=" + secret, status: () => 500});
  const serialized = JSON.stringify({diagnostics, failure: failure(new Error(secret))});
  assert.doesNotMatch(serialized, /fake-sensitive-signature|Ab12Cd34|purchaseSigned|\/private/);
  assert.equal(diagnostics.consoleErrors[0].category, "sdk");
  assert.equal(diagnostics.pageErrors[0].category, "app-check");
  assert.deepEqual(diagnostics.httpErrors, [{origin: "https://jest.com", status: 500, relevant: false}]);
  assert.doesNotThrow(() => assertNoRelevantJestPaymentErrors(diagnostics));
});

function instrumentedFrame(origin) {
  const listeners = {};
  const globals = {location: {origin}, addEventListener: (event, callback) => {listeners[event] = callback;}};
  const capture = new Script("(" + captureJestPaymentGameErrors.toString() + ")").runInNewContext(globals);
  capture({gameId});
  return {listeners, read: () => new Script("(" + readJestPaymentGameErrors.toString() + ")()").runInNewContext(globals)};
}

test("exact game-frame instrumentation records redacted uncaught errors/rejections and excludes host/ad frames", () => {
  const game = instrumentedFrame("https://" + gameId + ".builds.jest.com");
  game.listeners.error({message: "Jest SDK fake-sensitive-signature"});
  game.listeners.unhandledrejection({reason: new Error("App Check fake-sensitive-signature")});
  assert.deepEqual(JSON.parse(JSON.stringify(game.read())), [
    {kind: "uncaught-error", category: "sdk"}, {kind: "unhandled-rejection", category: "app-check"},
  ]);
  for (const origin of ["https://jest.com", "https://ads.invalid", "https://" + gameId + ".builds.jest.com.attacker.invalid"]) {
    const other = instrumentedFrame(origin);
    assert.deepEqual(other.listeners, {});
    assert.throws(other.read, /not instrumented/);
  }
});

test("uncaught game errors, game console errors, and game/backend network failures block acceptance", () => {
  const gameOrigin = "https://" + gameId + ".builds.jest.com";
  for (const event of ["game-error", "game-console", "backend-response", "game-response", "backend-request", "game-request"]) {
    const page = new EventEmitter();
    const {diagnostics} = collectRedactedJestPaymentDiagnostics(page, {gameId, functionsBaseUrl: "https://backend.invalid"});
    if (event === "game-error") diagnostics.gameErrors.push({kind: "uncaught-error", category: "browser"});
    if (event === "game-console") page.emit("console", {type: () => "error", text: () => "fake-sensitive-signature", location: () => ({url: gameOrigin + "/script.js"})});
    const origin = event.startsWith("backend") ? "https://backend.invalid" : gameOrigin;
    if (event.endsWith("response")) page.emit("response", {url: () => origin + "/private?receipt=fake-sensitive-signature", status: () => 500});
    if (event.endsWith("request")) page.emit("requestfailed", {url: () => origin + "/private?receipt=fake-sensitive-signature", method: () => "POST", failure: () => ({errorText: "fake-sensitive-signature"})});
    assert.throws(() => assertNoRelevantJestPaymentErrors(diagnostics), /relevant browser errors/, event);
    assert.doesNotMatch(JSON.stringify(diagnostics), /fake-sensitive-signature|\/private/);
  }
});

test("unrelated host/ad errors remain recorded and do not block confirmed payment acceptance", () => {
  const page = new EventEmitter();
  const {diagnostics} = collectRedactedJestPaymentDiagnostics(page, {gameId, functionsBaseUrl: "https://backend.invalid"});
  page.emit("pageerror", new Error("unrelated ad iframe exception"));
  page.emit("console", {type: () => "error", text: () => "unrelated ad SDK error", location: () => ({url: "https://ads.invalid/ad.js"})});
  page.emit("requestfailed", {url: () => "https://ads.invalid/fail", method: () => "GET", failure: () => ({errorText: "host ad failed"})});
  page.emit("response", {url: () => "https://ads.invalid/fail", status: () => 500});
  assert.equal(diagnostics.pageErrors.length, 1);
  assert.equal(diagnostics.consoleErrors.length, 1);
  assert.equal(diagnostics.failedRequests.length, 1);
  assert.equal(diagnostics.httpErrors.length, 1);
  assert.doesNotThrow(() => assertNoRelevantJestPaymentErrors(diagnostics));
});
