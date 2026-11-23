import enRedditPlatform from "../../../../src/locales/en/redditPlatform.json";
import {registerTargetLocaleNamespace, type Locale, type NamespaceCatalog} from "../../../../src/web/play/i18n";

/** Lazily loads the Reddit-owned namespace for each non-English locale. */
const nonEnglishRedditPlatformModules = import.meta.glob<NamespaceCatalog>(
  "../../../../src/locales/{ar,de,es,fr,hi,id,it,ja,ko,nl,pl,pt,ru,tr,vi}/redditPlatform.json",
  {import: "default"},
);

registerTargetLocaleNamespace({
  namespace: "redditPlatform",
  english: enRedditPlatform,
  /** Provides load behavior. */
  async load(locale: Exclude<Locale, "en">): Promise<NamespaceCatalog> {
    /** Provides module path behavior. */
    const modulePath = `../../../../src/locales/${locale}/redditPlatform.json`;
    /** Loads namespace. */
    const loadNamespace = nonEnglishRedditPlatformModules[modulePath];
    if (!loadNamespace) throw new Error(`Missing Reddit locale namespace: ${locale}/redditPlatform`);
    return loadNamespace();
  },
});
