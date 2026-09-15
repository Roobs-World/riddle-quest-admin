import {createContext} from "react";

/** Target-owned subscription operations; absent on targets without subscriptions. */
export const ShopSubscriptionContext = createContext<{
  /** Reconciles the provider catalog before displaying offers. */
  refresh: () => Promise<void>;
  /** Opens the provider cancellation confirmation. */
  cancel: (sku: string) => Promise<"success" | "cancelled" | "error">;
} | null>(null);
