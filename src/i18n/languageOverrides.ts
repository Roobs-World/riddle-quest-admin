/**
 * @fileoverview Re-exports all locale override tables.
 *
 * Each language's overrides are defined in their own file for better
 * organization and maintainability.
 */

export { esOverrides } from "./es";
export { ptOverrides } from "./pt";
export { frOverrides } from "./fr";
export { deOverrides } from "./de";
export { jaOverrides } from "./ja";
export { koOverrides } from "./ko";
export { zhOverrides } from "./zh";
export { ruOverrides } from "./ru";
export { trOverrides } from "./tr";

export type { LocaleOverrides, DeepPartial } from "./types";
