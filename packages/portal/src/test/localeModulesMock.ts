import type {Locale, Namespace, NamespaceCatalog} from "../play/i18n";

export const loadNonEnglishNamespace = async (
  locale: Exclude<Locale, "en">,
  namespace: Namespace,
): Promise<NamespaceCatalog> => {
  const module = await import(`../../../../src/locales/${locale}/${namespace}.json`);
  return (module.default ?? module) as NamespaceCatalog;
};
