import type {Locale, NamespaceCatalog, SharedNamespace} from "../play/i18n";

/** Loads non english namespace. */
export const loadNonEnglishNamespace = async (
  locale: Exclude<Locale, "en">,
  namespace: SharedNamespace,
): Promise<NamespaceCatalog> => {
  /** Provides module behavior. */
  const module = await import(`../../locales/${locale}/${namespace}.json`);
  return (module.default ?? module) as NamespaceCatalog;
};
