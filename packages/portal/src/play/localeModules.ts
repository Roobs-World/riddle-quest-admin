import type {Locale, Namespace, NamespaceCatalog} from "./i18n";

/** Defines the non english namespace modules value. */
const NON_ENGLISH_NAMESPACE_MODULES = import.meta.glob<NamespaceCatalog>(
  "../../../../src/locales/{ar,de,es,fr,hi,id,it,ja,ko,nl,pl,pt,ru,tr,vi,zh}/{aboutLegal,accessibility,achievements,alerts,coinPurchase,common,credits,errors,game,leaderboard,levelUpFanfare,loss,navigation,onboarding,profile,race,redditPlatform,settings,shop,stats,streakFanfare,tooltips,victory}.json",
  {import: "default"},
);

/** Loads non english namespace. */
export const loadNonEnglishNamespace = async (
  locale: Exclude<Locale, "en">,
  namespace: Namespace,
): Promise<NamespaceCatalog> => {
  const modulePath = `../../../../src/locales/${locale}/${namespace}.json`;
  const loadNamespace = NON_ENGLISH_NAMESPACE_MODULES[modulePath];
  if (!loadNamespace) {
    throw new Error(`Missing locale namespace: ${locale}/${namespace}`);
  }
  return loadNamespace();
};
