import {FACEBOOK_PRODUCTS} from "@riddle-quest/core/pricing/facebookCatalog";
import type {ProductSummary, PurchaseResult} from "@riddle-quest/hosted/hostTypes";
import {FacebookCommerceCapability} from "./FacebookCommerceCapability";
import type {FacebookInstantPayments, FacebookInstantSdk} from "./fbinstant";
import type {FacebookPurchaseGrant} from "./FacebookPurchaseRecovery";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";

type Configuration = {commerceEnabled: boolean; removeInterstitialAds: boolean};
type Options = {
  sdk: FacebookInstantSdk;
  payments: FacebookInstantPayments;
  isActive: () => boolean;
  runBackground: <Result>(operation: () => Promise<Result>) => Promise<Result>;
  grant: (input: {signedRequest: string}) => Promise<FacebookPurchaseGrant>;
  readConfiguration: () => Promise<Configuration>;
  onProducts: (products: ProductSummary[]) => void;
  onEntitlement: (adFree: boolean | undefined) => void;
  reportFailure: (error: unknown) => void;
  refreshProfile: () => Promise<unknown>;
};

/** Owns Meta readiness, recovery and catalog presentation for one authenticated session. */
export class FacebookCommerceSession {
  readonly capability: FacebookCommerceCapability;
  private ready = false;
  private retired = false;
  private adFree = false;
  private products: ProductSummary[] = [];
  private refreshPending?: Promise<void>;
  private purchasePending = false;
  private readonly options: Options;

  constructor(options: Options) {
    this.options = options;
    this.capability = new FacebookCommerceCapability(options.payments, async input => {
      this.requireActive();
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

  start(): void {
    this.options.payments.onReady?.(() => {
      if (!this.isActive()) return;
      this.ready = true;
      void this.refresh();
    });
  }

  retire(): void {
    this.retired = true;
  }

  refresh(): Promise<void> {
    if (!this.ready || !this.isActive()) return Promise.resolve();
    if (this.refreshPending) return this.refreshPending;
    const pending = this.options.runBackground(async () => {
      try {
        await this.configuration();
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

  private isActive(): boolean {
    return !this.retired && this.options.isActive();
  }

  private requireActive(): void {
    if (!this.isActive()) throw new Error("account-deletion-requested");
  }

  private async configuration(): Promise<void> {
    this.requireActive();
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

  private publishEntitlement(adFree: boolean): void {
    this.adFree = adFree;
    this.options.onEntitlement(adFree);
    this.publishProducts();
  }

  private publishProducts(): void {
    if (this.isActive()) this.options.onProducts(this.products.filter(product => product.productType !== "durable" || !this.adFree));
  }
}

/** Payment UI is absent until Meta advertises every operation used by checkout and recovery. */
export function facebookPaymentsAvailable(sdk: FacebookInstantSdk): sdk is FacebookInstantSdk & {payments: FacebookInstantPayments} {
  const apis = new Set(sdk.getSupportedAPIs());
  return Boolean(sdk.payments && typeof sdk.payments.onReady === "function" &&
    ["payments.getCatalogAsync", "payments.purchaseAsync", "payments.getPurchasesAsync", "payments.consumePurchaseAsync"]
      .every(api => apis.has(api)) &&
    typeof sdk.payments.getCatalogAsync === "function" && typeof sdk.payments.purchaseAsync === "function" &&
    typeof sdk.payments.getPurchasesAsync === "function" && typeof sdk.payments.consumePurchaseAsync === "function");
}
