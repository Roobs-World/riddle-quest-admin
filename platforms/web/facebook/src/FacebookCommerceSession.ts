import {FACEBOOK_PRODUCTS} from "./commerce/facebookCatalog";
import type {ProductSummary, PurchaseResult} from "../../../../src/platform/contracts/hostServices";
import {FacebookCommerceCapability} from "./FacebookCommerceCapability";
import type {FacebookInstantPayments, FacebookInstantSdk} from "./fbinstant";
import type {FacebookPurchaseGrant} from "./FacebookPurchaseRecovery";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";

/** Server-confirmed checkout readiness and ad-removal entitlement. */
type Configuration = {
  /** Whether the server permits Facebook checkout for this account. */
  commerceEnabled: boolean;
  /** Whether verified ownership suppresses interstitial ads. */
  removeInterstitialAds: boolean
};
/** Provider operations and view callbacks owned by one authenticated session. */
type Options = {
  /** Facebook host used to coordinate payment dialogs. */
  sdk: FacebookInstantSdk;
  /** Host payment operations for catalog, checkout, and recovery. */
  payments: FacebookInstantPayments;
  /** Checks the current account and deletion lifetime before publication. */
  isActive: () => boolean;
  /** Runs recovery within the current account-deletion gate. */
  runBackground: <Result>(operation: () => Promise<Result>) => Promise<Result>;
  /** Exchanges a signed purchase for a server-confirmed grant. */
  grant: (input: {
    /** Unmodified signed receipt returned by Facebook. */
    signedRequest: string
  }) => Promise<FacebookPurchaseGrant>;
  /** Reads current server readiness and ad-removal ownership. */
  readConfiguration: () => Promise<Configuration>;
  /** Publishes products offered to the active account. */
  onProducts: (products: ProductSummary[]) => void;
  /** Publishes verified ad-removal state or an unavailable reading. */
  onEntitlement: (adFree: boolean | undefined) => void;
  /** Reports failures while this session still owns the operation. */
  reportFailure: (error: unknown) => void;
  /** Reloads the authoritative account projection after recovery or checkout. */
  refreshProfile: () => Promise<unknown>;
};

/** Owns Meta readiness, recovery and catalog presentation for one authenticated session. */
export class FacebookCommerceSession {
  /** Serializes SDK purchase and recovery operations for this session. */
  readonly capability: FacebookCommerceCapability;
  /** Whether the host has signaled that payments are ready. */
  private ready = false;
  /** Whether account retirement has ended this session. */
  private retired = false;
  /** Latest server-confirmed interstitial removal entitlement. */
  private adFree = false;
  /** Catalog rows retained for purchase validation and presentation. */
  private products: ProductSummary[] = [];
  /** Coalesces overlapping configuration, recovery, and catalog refreshes. */
  private refreshPending?: Promise<void>;
  /** Prevents overlapping checkout dialogs in this session. */
  private purchasePending = false;
  /** Operations and callbacks bound to the authenticated owner. */
  private readonly options: Options;

  /** Binds payment grants and presentation to the authenticated account lifetime. */
  constructor(options: Options) {
    this.options = options;
    this.capability = new FacebookCommerceCapability(options.payments, async input => {
      this.requireActive();
      /** Authoritative receipt result read before updating account presentation. */
      const grant = await options.grant(input);
      this.requireActive();
      if (typeof grant.removeInterstitialAds === "boolean") this.publishEntitlement(grant.removeInterstitialAds);
      try {
        await options.refreshProfile();
      } catch (error) {
        if (this.isActive()) options.reportFailure(error);
      }
      this.requireActive();
      return grant;
    });
  }

  /** Registers the payment-ready callback and begins owned recovery. */
  start(): void {
    this.options.payments.onReady?.(() => {
      if (!this.isActive()) return;
      this.ready = true;
      void this.refresh();
    });
  }

  /** Ends publication and future payment work for this account session. */
  retire(): void {
    this.retired = true;
  }

  /** Coalesces owned readiness, receipt recovery, profile, and catalog reads. */
  refresh(): Promise<void> {
    if (!this.ready || !this.isActive()) return Promise.resolve();
    if (this.refreshPending) return this.refreshPending;
    /** One in-flight refresh run shared by concurrent callers. */
    const pending = this.options.runBackground(async () => {
      try {
        await this.configuration();
        /** Result of settling outstanding SDK receipts before catalog publication. */
        const recovered = await this.capability.recover();
        if (recovered.status !== "success") this.options.reportFailure(new Error(
          recovered.status === "cancelled" ? "facebook-purchase-recovery-cancelled" : recovered.message,
        ));
        this.requireActive();
        try {
          await this.options.refreshProfile();
        } catch (error) {
          if (this.isActive()) this.options.reportFailure(error);
        }
        await this.configuration();
        /** Validated provider catalog read after account recovery. */
        const catalog = await this.capability.listProducts();
        this.requireActive();
        if (catalog.status !== "success") throw new Error(
          catalog.status === "cancelled" ? "facebook-catalog-cancelled" : catalog.message,
        );
        this.products = catalog.value.map(product => ({
          productId: product.id,
          productType: FACEBOOK_PRODUCTS[product.id].kind,
          name: product.title,
          description: product.description,
          coins: FACEBOOK_PRODUCTS[product.id].coins,
          displayPrice: product.price,
        }));
        this.publishProducts();
      } catch (error) {
        if (this.isActive()) {
          this.options.onEntitlement(undefined);
          this.options.onProducts([]);
          this.options.reportFailure(error);
        }
      }
    }).catch(error => {if (this.isActive()) this.options.reportFailure(error);});
    this.refreshPending = pending;
    void pending.finally(() => {if (this.refreshPending === pending) this.refreshPending = undefined;}).catch(() => undefined);
    return pending;
  }

  /** Requests one supported checkout under current readiness and lifetime checks. */
  readonly requestPurchase = async (productId: string): Promise<PurchaseResult> => {
    this.requireActive();
    if (!this.ready) throw new Error("facebook-payments-not-ready");
    if (this.purchasePending) return {
      success: false, cancelled: true, productId,
      purchaseType: this.products.find(product => product.productId === productId)?.productType ?? "consumable",
    };
    this.purchasePending = true;
    try {
      await this.configuration();
      if (!this.products.some(product => product.productId === productId) ||
        (this.adFree && FACEBOOK_PRODUCTS[productId]?.kind === "durable")) throw new Error("facebook-product-unavailable");
      /** SDK dialog result after the authoritative grant and optional consumption. */
      const purchase = await runFacebookSdkDialog(this.options.sdk, () => this.capability.purchase(productId));
      if (purchase.status === "cancelled") return {success: false, cancelled: true, productId, purchaseType: FACEBOOK_PRODUCTS[productId].kind};
      if (purchase.status !== "success") throw new Error(purchase.message);
      this.requireActive();
      this.publishProducts();
      return {
        success: true,
        productId,
        purchaseType: FACEBOOK_PRODUCTS[productId].kind,
        newCoins: purchase.value.newCoins,
        coinsAwarded: purchase.value.coinsAwarded,
      };
    } finally {
      this.purchasePending = false;
    }
  };

  /** Checks whether both the session and its account owner remain active. */
  private isActive(): boolean {
    return !this.retired && this.options.isActive();
  }

  /** Rejects work after this account session has retired. */
  private requireActive(): void {
    if (!this.isActive()) throw new Error("account-deletion-requested");
  }

  /** Refreshes server readiness and entitlement before commerce operations. */
  private async configuration(): Promise<void> {
    this.requireActive();
    /** Latest server checkout gate and ad-removal entitlement. */
    let configuration: Configuration;
    try {
      configuration = await this.options.readConfiguration();
    } catch (error) {
      if (this.isActive()) this.options.onEntitlement(undefined);
      throw error;
    }
    this.requireActive();
    this.publishEntitlement(configuration.removeInterstitialAds);
    if (!configuration.commerceEnabled) throw new Error("facebook-commerce-disabled");
  }

  /** Updates the verified ad-removal state and visible product list. */
  private publishEntitlement(adFree: boolean): void {
    this.adFree = adFree;
    this.options.onEntitlement(adFree);
    this.publishProducts();
  }

  /** Publishes the active catalog with already-owned durables omitted. */
  private publishProducts(): void {
    if (this.isActive()) this.options.onProducts(this.products.filter(product => product.productType !== "durable" || !this.adFree));
  }
}

/** Payment UI is absent until Meta advertises every operation used by checkout and recovery. */
export function facebookPaymentsAvailable(sdk: FacebookInstantSdk): sdk is FacebookInstantSdk & {
  /** Payment module guaranteed by the host capability checks. */
  payments: FacebookInstantPayments
} {
  /** Host-advertised APIs required for checkout and recovery. */
  const apis = new Set(sdk.getSupportedAPIs());
  return Boolean(sdk.payments && typeof sdk.payments.onReady === "function" &&
    ["payments.getCatalogAsync", "payments.purchaseAsync", "payments.getPurchasesAsync", "payments.consumePurchaseAsync"]
      .every(api => apis.has(api)) &&
    typeof sdk.payments.getCatalogAsync === "function" && typeof sdk.payments.purchaseAsync === "function" &&
    typeof sdk.payments.getPurchasesAsync === "function" && typeof sdk.payments.consumePurchaseAsync === "function");
}
