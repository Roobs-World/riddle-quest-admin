import {useCallback, type Dispatch, type SetStateAction} from "react";
import type {ProductSummary, PurchaseResult} from "../../../../src/platform/contracts/hostServices";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestSession} from "./types";

type TrackFunnel = (eventName: string, params?: Record<string, string | number | boolean>) => void;

export type JestPurchaseOptions = {
  /** Stores products. */
  products: ProductSummary[];
  /** Stores purchases. */
  purchases: JestPurchaseCoordinator;
  /** Stores session. */
  session: JestSession | null;
  /** Stores set products. */
  setProducts: Dispatch<SetStateAction<ProductSummary[]>>;
  /** Enables the Jest subscription catalog and checkout. */
  subscriptionsEnabled?: boolean;
  /** Stores track funnel. */
  trackFunnel: TrackFunnel;
};

/** Keeps the host callback stable while deferring checkout code until it is used. */
export function useJestPurchase({products, purchases, session, setProducts, subscriptionsEnabled = false, trackFunnel}: JestPurchaseOptions) {
  return useCallback(async (productId: string): Promise<PurchaseResult> => {
    const {runJestPurchase} = await import("./runJestPurchase");
    return runJestPurchase({productId, products, purchases, session, setProducts, subscriptionsEnabled, trackFunnel});
  }, [products, purchases, session, setProducts, subscriptionsEnabled, trackFunnel]);
}
