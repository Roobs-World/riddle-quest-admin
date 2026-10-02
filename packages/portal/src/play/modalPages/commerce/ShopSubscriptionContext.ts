import {createContext} from "react";
import type {ProductSummary} from "../../types";

/** Target-owned subscription operations; absent on targets without subscriptions. */
export const ShopSubscriptionContext = createContext<{
  /** Latest provider-owned catalog, including active entitlements. */
  products: readonly ProductSummary[];
  /** Reconciles the provider catalog before displaying offers. */
  refresh: () => Promise<void>;
  /** Opens the provider cancellation confirmation. */
  cancel: (sku: string) => Promise<"success" | "cancelled" | "error">;
} | null>(null);
