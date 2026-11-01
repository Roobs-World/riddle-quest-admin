/**
 * Self-contained solo play shared by the web Playable targets and the Android app.
 *
 * @remarks
 * Everything here is provider-neutral and DOM-free: bundled content parsing,
 * the local save schema and durable write gate, the economy, achievements,
 * localized copy, answer input editing, and the local gameplay authority.
 * Hosts bind their own save transport, locale, lifecycle, and presentation
 * through {@link YouTubeSdkPort} and the hooks in `@qwordly/solo/react`.
 *
 * @packageDocumentation
 */
export * from "./types";
export * from "./limits";
export * from "./economy";
export * from "./achievements";
export * from "./i18n";
export * from "./input";
export * from "./save";
export * from "./content";
export * from "./localSoloGameRules";
export * from "./LocalSoloAuthority.contract";
export {LocalSoloAuthority} from "./LocalSoloAuthority";
export * from "./YouTubeSaveGate";
