import {MockJestPlatform} from "/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/jest/MockJestPlatform";
import {JestPurchaseCoordinator} from "/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/jest/purchases";
import {JestBackendClient} from "/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/jest/backend";
import type {JestPlatformPort} from "/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/jest/types";
import {configureBrowserErrorReporter, resetBrowserErrorReporterForTests} from "/home/craig-beswetherick/Documents/riddle-quest/packages/portal/src/observability/browserErrorReporter";
it.each(["returned", "thrown", "cancelled"])("presents a durable grant and reconciles its pending confirmation once: %s", async mode => {
  /** Calls distinguish receipt recovery from opening another paid checkout. */
  const calls: string[] = [];
  /** Provider retains the exact purchase until a later confirmation succeeds. */
  const pending = new Set<string>();
  /** Authority ledger grants each provider token only once across coordinator lifetimes. */
  const awarded = new Set<string>();
  /** Wallet represents server state independently of provider confirmation. */
  let balance = 300;
  /** First page cannot confirm the receipt; a later page can recover it. */
  let confirmationFails = true;
  /** Captures the failure that remains observable after returning the confirmed grant. */
  const reported: Array<{
    /** Retained provider reason explains why confirmation remains incomplete. */
    message: string;
    /** Reporting operation distinguishes confirmation from authoritative grant failure. */
    operation: unknown;
  }> = [];
  /** Provider behavior follows its durable incomplete-purchase queue. */
  const platform: JestPlatformPort = new MockJestPlatform();
  platform.beginPurchase = async productSku => {
    calls.push("begin");
    pending.add("recoverable-token");
    return {status: "success", value: {purchase: {purchaseToken: "recoverable-token", productSku}, purchaseSigned: "checkout.signed"}};
  };
  platform.completePurchase = async token => {
    calls.push("complete");
    if (confirmationFails) {
      if (mode === "thrown") throw new Error("SDK completion disconnected");
      return mode === "cancelled" ? {status: "cancelled"} : {status: "retryable-failure", message: "SDK completion rejected"};
    }
    pending.delete(token);
    return {status: "success", value: undefined};
  };
  platform.getIncompletePurchases = async () => {
    calls.push("read-incomplete");
    return {status: "success", value: {purchases: [...pending].map(purchaseToken => ({purchaseToken, productSku: "coins"})),
      purchasesSigned: "recovery.signed", hasMore: false}};
  };
  /** Real coordinator uses an idempotent backend fixture rather than a local economy mutation. */
  const backend = new JestBackendClient("https://example.invalid");
  jest.spyOn(backend, "grantPurchase").mockImplementation(async (_signed, _playerId, purchaseToken) => {
    calls.push("grant");
    if (!awarded.has(purchaseToken)) {awarded.add(purchaseToken); balance += 250;}
    return {granted: true, purchaseToken, coinsAwarded: 250, newCoins: balance, newlyUnlockedAchievementIds: ["first_purchase"]};
  });
  configureBrowserErrorReporter((error, context) => {reported.push({message: error instanceof Error ? error.message : String(error), operation: context?.operation});});
  try {
    await expect(new JestPurchaseCoordinator(platform, backend).purchase("coins", "p1")).resolves.toEqual({status: "success",
      value: {coinsAwarded: 250, newCoins: 550, newlyUnlockedAchievementIds: ["first_purchase"]}});
    expect(balance).toBe(550);
    expect([...pending]).toEqual(["recoverable-token"]);
    expect(calls).toEqual(["begin", "grant", "complete"]);
    expect(reported).toEqual([{message: mode === "thrown" ? "SDK completion disconnected" : mode === "cancelled" ? "cancelled" : "SDK completion rejected",
      operation: "complete_purchase"}]);

    confirmationFails = false;
    await expect(new JestPurchaseCoordinator(platform, backend).reconcile("p1")).resolves.toEqual({status: "success", value: 1});
    expect(balance).toBe(550);
    expect([...awarded]).toEqual(["recoverable-token"]);
    expect([...pending]).toEqual([]);
    expect(calls).toEqual(["begin", "grant", "complete", "read-incomplete", "grant", "complete"]);
  } finally {resetBrowserErrorReporterForTests();}
});

