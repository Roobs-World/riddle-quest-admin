/**
 * Provider-neutral game rules, schemas, iframe messages, pricing, races, and referrals.
 *
 * @remarks
 * This package is shared by the browser targets and Firebase Functions. Keep
 * provider SDKs and browser-only behavior outside this boundary so the Jest,
 * Facebook, Reddit, and YouTube artifacts can remain independently composed.
 * Runtime-facing data should enter through the exported Zod schemas instead of
 * unchecked type assertions.
 *
 * @packageDocumentation
 */
export * from "./game";
export * from "./pricing";
export * from "./validation";
export * from "./bridge";
export * from "./race";
export * from "./referrals";
