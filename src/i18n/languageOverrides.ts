/**
 * @fileoverview Re-exports all locale override tables.
 *
 * Each language's overrides are defined in their own file for better
 * organization and maintainability.
 */

import {deOverrides as deBaseOverrides} from "./de";
import {esOverrides as esBaseOverrides} from "./es";
import {frOverrides as frBaseOverrides} from "./fr";
import {hiOverrides as hiBaseOverrides} from "./hi";
import {jaOverrides as jaBaseOverrides} from "./ja";
import {koOverrides as koBaseOverrides} from "./ko";
import {
  arOverrides,
  idOverrides,
  itOverrides,
  nlOverrides,
  plOverrides,
  viOverrides,
} from "./popularOverrides";
import {ptOverrides as ptBaseOverrides} from "./pt";
import {ruOverrides as ruBaseOverrides} from "./ru";
import {
  deSupplementalOverrides,
  esSupplementalOverrides,
  frSupplementalOverrides,
  hiSupplementalOverrides,
  jaSupplementalOverrides,
  koSupplementalOverrides,
  ptSupplementalOverrides,
  ruSupplementalOverrides,
  trSupplementalOverrides,
  zhSupplementalOverrides,
} from "./supplementalOverrides";
import {trOverrides as trBaseOverrides} from "./tr";
import type {LocaleOverrides} from "./types";
import {zhOverrides as zhBaseOverrides} from "./zh";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const deepMerge = <T extends LocaleOverrides>(base: T, supplement: LocaleOverrides): T => {
  const output: Record<string, unknown> = {...base};

  Object.entries(supplement).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const baseValue = output[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      output[key] = deepMerge(baseValue as LocaleOverrides, value as LocaleOverrides);
      return;
    }

    output[key] = value;
  });

  return output as T;
};

export const esOverrides = deepMerge(esBaseOverrides, esSupplementalOverrides);
export const ptOverrides = deepMerge(ptBaseOverrides, ptSupplementalOverrides);
export const frOverrides = deepMerge(frBaseOverrides, frSupplementalOverrides);
export const deOverrides = deepMerge(deBaseOverrides, deSupplementalOverrides);
export const jaOverrides = deepMerge(jaBaseOverrides, jaSupplementalOverrides);
export const koOverrides = deepMerge(koBaseOverrides, koSupplementalOverrides);
export const zhOverrides = deepMerge(zhBaseOverrides, zhSupplementalOverrides);
export const hiOverrides = deepMerge(hiBaseOverrides, hiSupplementalOverrides);
export const ruOverrides = deepMerge(ruBaseOverrides, ruSupplementalOverrides);
export const trOverrides = deepMerge(trBaseOverrides, trSupplementalOverrides);
export {arOverrides, idOverrides, itOverrides, nlOverrides, plOverrides, viOverrides};

export type { LocaleOverrides, DeepPartial } from "./types";
