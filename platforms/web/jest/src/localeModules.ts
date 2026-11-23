import type {Locale, NamespaceCatalog, SharedNamespace} from "../../../../src/localization/browser/i18n";

/** Keeps unsupported catalogs outside Jest's graph; its public locale policy always selects English. */
export async function loadNonEnglishNamespace(
  _locale: Exclude<Locale, "en">,
  _namespace: SharedNamespace,
): Promise<NamespaceCatalog> {
  throw new Error("Jest supports English locale catalogs only.");
}
