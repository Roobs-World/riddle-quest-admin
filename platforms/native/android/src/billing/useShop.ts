import {trackEvent} from "../../../../../src/observability/analytics/eventsRuntime";
import {useCallback, useEffect, useRef, useState} from "react";
import type {AndroidCommerce} from "./androidCommerce";
import {ANDROID_COIN_PACKS, ANDROID_PREMIUM_SUBSCRIPTIONS, type CoinPack} from "./catalog";
import type {PlayBillingPort, PlayProduct} from "./playBilling";
/** A coin pack Play can sell, with its localized price. */
export type PricedCoinPack = CoinPack & Readonly<{
  /** Play product for checkout. */
  product: PlayProduct;
}>;
/** What the shop can sell right now. */
export type ShopCatalog =
  | {
      /** Prices are loading. */
      kind: "loading";
    }
  | {
      /** This device cannot reach Play Billing. */
      kind: "unavailable";
    }
  | {
      /** Play could not price the products. */
      kind: "failed";
    }
  | {
      /** Products Play priced. */
      kind: "ready";
      /** Coin packs in shop order. */
      packs: readonly PricedCoinPack[];
      /** Premium plans. */
      premium: readonly PlayProduct[];
    };
/** Message shown after a shop action. */
export type ShopNotice =
  | {
      /** Coins were added. */
      kind: "coinsAdded";
      /** Coins added. */
      coins: number;
    }
  | {
      /** Premium was verified. */
      kind: "premiumActive";
    }
  | {
      /** Play is waiting for the payment. */
      kind: "pending";
    }
  | {
      /** Purchases were restored. */
      kind: "restored";
    }
  | {
      /** The action failed. */
      kind: "failed";
    };
/** State and actions of the shop screen. */
export type ShopController = Readonly<{
  /** Sellable products. */
  catalog: ShopCatalog;
  /** Product id or "restore" while an action runs. */
  busy: string | null;
  /** Latest action message. */
  notice: ShopNotice | null;
  /** Premium subscriptions currently verified for the account. */
  activeSkus: readonly string[];
  /** Buys one product. */
  buy: (product: PlayProduct) => void;
  /** Re-settles owned purchases and subscriptions. */
  restore: () => void;
  /** Reloads prices after a failure. */
  reload: () => void;
}>;
/** Options for {@link useShop}. */
export type ShopOptions = Readonly<{
  /** Play port, or `null` when the device has none. */
  billing: PlayBillingPort | null;
  /** Shop flow over Play and the backend, or `null` without Play. */
  commerce: AndroidCommerce | null;
  /** Firebase uid that owns purchases. */
  accountUid: string;
  /** Called after the confirmed balance or Premium state changed. */
  onAccountChanged: () => void;
}>;
/** Drives the shop: prices products, runs checkouts, restores purchases and reports Premium status. */
export function useShop({billing, commerce, accountUid, onAccountChanged}: ShopOptions): ShopController {
  /** Sellable products. */
  const [catalog, setCatalog] = useState<ShopCatalog>(billing ? {kind: "loading"} : {kind: "unavailable"});
  /** Running action. */
  const [busy, setBusy] = useState<string | null>(null);
  /** Latest message. */
  const [notice, setNotice] = useState<ShopNotice | null>(null);
  /** Verified Premium subscriptions. */
  const [activeSkus, setActiveSkus] = useState<readonly string[]>([]);
  /** Whether the screen is still mounted. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  /** Prices the catalog. */
  const reload = useCallback(() => {
    if (!billing) return;
    setCatalog({kind: "loading"});
    billing.getProducts(ANDROID_COIN_PACKS.map((pack) => pack.productId), ANDROID_PREMIUM_SUBSCRIPTIONS).then(
      (products) => {
        if (!mounted.current) return;
        /** Priced products by id. */
        const byId = new Map(products.map((product) => [product.productId, product]));
        /** Packs Play priced, in catalog order. */
        const packs = ANDROID_COIN_PACKS.flatMap((pack) => {
          /** Priced product. */
          const product = byId.get(pack.productId);
          return product?.type === "inapp" ? [{...pack, product}] : [];
        });
        /** Premium plans Play priced. */
        const premium = ANDROID_PREMIUM_SUBSCRIPTIONS.flatMap((id) => {
          /** Priced plan. */
          const product = byId.get(id);
          return product?.type === "subs" && product.offerToken ? [product] : [];
        });
        setCatalog({kind: "ready", packs, premium});
      },
      (error: unknown) => {
        if (!mounted.current) return;
        // The native module rejects with this code when the device has no usable Play Store.
        setCatalog({kind: (error as {
        /** Stores code. */
        code?: unknown} | null)?.code === "billing-unavailable" ? "unavailable" : "failed"});
      },
    );
  }, [billing]);
  useEffect(() => {
    reload();
    commerce?.syncSubscriptions().then(
      (synced) => {
        if (mounted.current) setActiveSkus(synced.activeSkus);
      },
      () => undefined,
    );
  }, [commerce, reload]);
  /** Runs one shop action with shared busy and error handling. */
  const run = useCallback(
    (key: string, action: () => Promise<ShopNotice | null>) => {
      if (busy) return;
      setBusy(key);
      setNotice(null);
      action().then(
        (next) => {
          if (!mounted.current) return;
          setNotice(next);
          setBusy(null);
        },
        () => {
          if (!mounted.current) return;
          setNotice({kind: "failed"});
          setBusy(null);
        },
      );
    },
    [busy],
  );
  /** Buys one product. */
  const buy = useCallback(
    (product: PlayProduct) => {
      if (!commerce) return;
      run(product.productId, async () => {
        trackEvent("checkout_requested", {product_id: product.productId, product_type: product.type});
        /** Settled checkout. */
        let outcome;
        try {outcome = await commerce.checkout(product, accountUid);}
        catch (error) {trackEvent("checkout_result", {product_id: product.productId, status: "failed"}); throw error;}
        trackEvent("checkout_result", {product_id: product.productId, status: outcome.kind});
        if (outcome.kind === "cancelled") return null;
        if (outcome.kind === "pending") return {kind: "pending"};
        onAccountChanged();
        if (outcome.kind === "premium") {
          if (mounted.current) setActiveSkus(outcome.activeSkus);
          return outcome.activeSkus.length > 0 ? {kind: "premiumActive"} : {kind: "pending"};
        }
        return {kind: "coinsAdded", coins: outcome.coinsAwarded};
      });
    },
    [accountUid, commerce, onAccountChanged, run],
  );
  /** Restores owned purchases. */
  const restore = useCallback(() => {
    if (!commerce) return;
    run("restore", async () => {
      trackEvent("purchase_restore_requested");
      /** Restored state. */
      let restored;
      try {restored = await commerce.restore();}
      catch (error) {trackEvent("purchase_restore_result", {status: "failed"}); throw error;}
      trackEvent("purchase_restore_result", {status: restored.failedPurchases > 0 ? "partial" : "success", coins_awarded: restored.coinsAwarded});
      if (mounted.current) setActiveSkus(restored.activeSkus);
      onAccountChanged();
      if (restored.failedPurchases > 0) return {kind: "failed"};
      return restored.coinsAwarded > 0 ? {kind: "coinsAdded", coins: restored.coinsAwarded} : {kind: "restored"};
    });
  }, [commerce, onAccountChanged, run]);
  return {catalog, busy, notice, activeSkus, buy, restore, reload};
}
