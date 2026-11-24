import type {JestBackendPort} from "./backend";
import type {JestPlatformPort} from "./types";
import type {JestPurchaseCoordinator} from "./purchases";
import {captureBrowserException} from "../../../../src/observability/browserErrorReporter";
import {createPurchaseAnalyticsId} from "../../../../src/observability/analytics/purchaseAnalyticsId";

/** Defers paid grant/acknowledgement code until a player requests checkout. */
export async function checkoutConsumable({platform, backend, productSku, playerId}: {
  platform: JestPlatformPort;
  backend: JestBackendPort;
  productSku: string;
  playerId: string;
}): ReturnType<JestPurchaseCoordinator["purchase"]> {
  /** Starts ed. */
  const started = await platform.beginPurchase(productSku);
  if (started.status !== "success") return started;
  try {
    /** Provides grant behavior. */
    const grant = await backend.grantPurchase(
      started.value.purchaseSigned,
      playerId,
      started.value.purchase.purchaseToken,
    );
    try {
      /** Provider confirmation cannot undo a grant already accepted by the game authority. */
      const completed = await platform.completePurchase(started.value.purchase.purchaseToken);
      if (completed.status !== "success") throw new Error("message" in completed ? completed.message : completed.status);
    } catch (error) {
      captureBrowserException(error, {component: "jest_purchases", operation: "complete_purchase"});
    }
    return {
      status: "success",
      value: {
        coinsAwarded: grant.coinsAwarded,
        newCoins: grant.newCoins,
        newlyUnlockedAchievementIds: grant.newlyUnlockedAchievementIds,
        analyticsTransactionId: await createPurchaseAnalyticsId("jest", started.value.purchase.purchaseToken),
        ...(started.value.purchase.sandbox === true ? {sandbox: true} : {}),
      },
    };
  } catch (error) {
    captureBrowserException(error, {component: "jest_purchases", operation: "purchase"});
    return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
  }
}
