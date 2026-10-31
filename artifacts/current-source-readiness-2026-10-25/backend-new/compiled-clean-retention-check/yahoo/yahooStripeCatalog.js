"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YAHOO_STRIPE_PRODUCTS = void 0;
exports.resolveYahooStripeProduct = resolveYahooStripeProduct;
const catalog_1 = require("@qwordly/core/pricing/catalog");
/** Yahoo uses the shared coin catalog with fixed USD amounts. */
exports.YAHOO_STRIPE_PRODUCTS = catalog_1.DEFAULT_PRODUCT_PRICING.map((product) => {
    /** Provides price behavior. */
    const price = product.regionalPrices.find(({ currency }) => currency === "USD");
    /** Provides unit amount behavior. */
    const unitAmount = Math.round((price?.amount ?? 0) * 100);
    if (!price || !Number.isSafeInteger(unitAmount) || unitAmount <= 0)
        throw new Error("invalid-yahoo-stripe-catalog");
    return {
        productId: product.productId,
        name: product.name,
        description: product.description,
        coins: product.coins,
        currency: "usd",
        unitAmount,
    };
});
/** Resolves only products fixed in the server-owned Yahoo catalog. */
function resolveYahooStripeProduct(productId) {
    /** Provides product behavior. */
    const product = exports.YAHOO_STRIPE_PRODUCTS.find((candidate) => candidate.productId === productId);
    if (!product)
        throw new Error("invalid-yahoo-stripe-product");
    return product;
}
//# sourceMappingURL=yahooStripeCatalog.js.map