/**
 * @fileoverview Shared types for locale overrides.
 */
import type { AppStringsSchema } from "../constants/AppStrings";

/**
 * Recursive partial used for sparse locale override trees.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type LocaleOverrides = DeepPartial<AppStringsSchema>;
