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
  arOverrides as arBaseOverrides,
  idOverrides as idBaseOverrides,
  itOverrides as itBaseOverrides,
  nlOverrides as nlBaseOverrides,
  plOverrides as plBaseOverrides,
  viOverrides as viBaseOverrides,
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
  releaseReadinessSupplementalOverrides,
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

const applySupplements = <T extends LocaleOverrides>(
  base: T,
  ...supplements: LocaleOverrides[]
): T => {
  return supplements.reduce<T>(
    (merged, supplement) => deepMerge(merged, supplement),
    base
  );
};

export const esOverrides = applySupplements(
  esBaseOverrides,
  esSupplementalOverrides,
  releaseReadinessSupplementalOverrides.es
);
export const ptOverrides = applySupplements(
  ptBaseOverrides,
  ptSupplementalOverrides,
  releaseReadinessSupplementalOverrides.pt
);
export const frOverrides = applySupplements(
  frBaseOverrides,
  frSupplementalOverrides,
  releaseReadinessSupplementalOverrides.fr
);
export const deOverrides = applySupplements(
  deBaseOverrides,
  deSupplementalOverrides,
  releaseReadinessSupplementalOverrides.de
);
export const jaOverrides = applySupplements(
  jaBaseOverrides,
  jaSupplementalOverrides,
  releaseReadinessSupplementalOverrides.ja
);
export const koOverrides = applySupplements(
  koBaseOverrides,
  koSupplementalOverrides,
  releaseReadinessSupplementalOverrides.ko
);
export const zhOverrides = applySupplements(
  zhBaseOverrides,
  zhSupplementalOverrides,
  releaseReadinessSupplementalOverrides.zh
);
export const hiOverrides = applySupplements(
  hiBaseOverrides,
  hiSupplementalOverrides,
  releaseReadinessSupplementalOverrides.hi
);
export const ruOverrides = applySupplements(
  ruBaseOverrides,
  ruSupplementalOverrides,
  releaseReadinessSupplementalOverrides.ru
);
export const trOverrides = applySupplements(
  trBaseOverrides,
  trSupplementalOverrides,
  releaseReadinessSupplementalOverrides.tr
);
export const arOverrides = applySupplements(
  arBaseOverrides,
  releaseReadinessSupplementalOverrides.ar
);
export const idOverrides = applySupplements(
  idBaseOverrides,
  releaseReadinessSupplementalOverrides.id
);
export const itOverrides = applySupplements(
  itBaseOverrides,
  releaseReadinessSupplementalOverrides.it
);
export const nlOverrides = applySupplements(
  nlBaseOverrides,
  releaseReadinessSupplementalOverrides.nl
);
export const plOverrides = applySupplements(
  plBaseOverrides,
  releaseReadinessSupplementalOverrides.pl
);
export const viOverrides = applySupplements(
  viBaseOverrides,
  releaseReadinessSupplementalOverrides.vi
);

export type { LocaleOverrides, DeepPartial } from "./types";
