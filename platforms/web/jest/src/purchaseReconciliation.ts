import type {JestBackendPort} from "./backend";
import type {JestPlatformPort, PlatformResult} from "./types";
import type {JestPurchaseCoordinator} from "./purchases";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";

type IncompletePurchasePage = NonNullable<Parameters<JestPurchaseCoordinator["reconcile"]>[1]>;

/** Loads receipt grant and acknowledgement work only when a provider queue needs draining. */
export async function reconcileJestPurchases({platform, backend, playerId, initialPage}: {
  platform: Pick<JestPlatformPort, "getIncompletePurchases" | "completePurchase">;
  backend: Pick<JestBackendPort, "grantPurchase">;
  playerId: string;
  initialPage: IncompletePurchasePage;
}): ReturnType<JestPurchaseCoordinator["reconcile"]> {
  let count = 0;
  for (let page = 0; page < 100; page += 1) {
    const result: PlatformResult<IncompletePurchasePage> = page === 0
      ? {status: "success", value: initialPage}
      : await platform.getIncompletePurchases();
    if (result.status !== "success") return result;
    for (const purchase of result.value.purchases) {
      try {
        await backend.grantPurchase(result.value.purchasesSigned, playerId, purchase.purchaseToken);
      } catch (error) {
        captureBrowserException(error, {component: "jest_purchases", operation: "reconcile_purchase"});
        return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
      }
      const completed = await platform.completePurchase(purchase.purchaseToken);
      if (completed.status !== "success") return completed;
      count += 1;
    }
    if (!result.value.hasMore) return {status: "success", value: count};
  }
  const error = new Error("Incomplete purchase pagination exceeded safety limit");
  captureBrowserException(error, {component: "jest_purchases", operation: "reconcile_pagination"});
  return {status: "terminal-failure", message: error.message};
}
