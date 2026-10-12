"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACEBOOK_FEATURES = void 0;
exports.parseFacebookDisabledFeatures = parseFacebookDisabledFeatures;
exports.isFacebookFeatureEnabled = isFacebookFeatureEnabled;
/** Defines the facebook features value. */
exports.FACEBOOK_FEATURES = [
    "identity",
    "commerce",
    "rewarded_ads",
    "interstitials",
    "referrals",
    "notifications",
    "matchmaking",
    "tournaments",
    "presence",
];
/** Parses the provider-scoped emergency-off list and rejects unknown names. */
function parseFacebookDisabledFeatures(value) {
    if (!value?.trim())
        return new Set();
    /** Provides known behavior. */
    const known = new Set(exports.FACEBOOK_FEATURES);
    /** Provides entries behavior. */
    const entries = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    /** Provides unknown behavior. */
    const unknown = entries.filter((entry) => !known.has(entry));
    if (unknown.length > 0)
        throw new Error(`unknown-facebook-feature:${unknown.join(",")}`);
    return new Set(entries);
}
/** Returns false only when the named Facebook capability is explicitly disabled. */
function isFacebookFeatureEnabled(feature, value = process.env.FACEBOOK_DISABLED_FEATURES) {
    return !parseFacebookDisabledFeatures(value).has(feature);
}
//# sourceMappingURL=facebookFeatureFlags.js.map