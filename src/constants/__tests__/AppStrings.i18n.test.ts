import {
  APP_LANGUAGE_STORAGE_KEY,
  LANGUAGE_OPTIONS,
  SUPPORTED_LANGUAGES,
  detectDeviceLanguage,
  getLanguageLabel,
  getLocale,
  getRootCatalog,
  isSupportedLanguage,
  loadLocale,
  setLocale,
  t,
} from "../../i18n";
import {localeCatalogs} from "../../i18n/generated/catalogs";
import type {TranslationSchema} from "../../i18n/generated/types";

const getLeafPaths = (value: object, prefix = ""): string[] => {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (child && typeof child === "object" && !Array.isArray(child)) {
      return getLeafPaths(child, path);
    }

    return path;
  });
};

const getPathValue = (value: object, path: string): unknown => {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, value);
};

describe("i18n runtime support", () => {
  afterEach(() => {
    setLocale("en");
  });

  it("defaults to English and exposes the root catalog", () => {
    expect(getLocale()).toBe("en");
    expect(getRootCatalog().Settings.TITLE).toBe("Settings");
  });

  it("switches locale-specific strings", () => {
    setLocale("es");
    expect(getRootCatalog().Settings.TITLE).toBe("Configuración");
    expect(t("Settings.TITLE")).toBe("Configuración");

    setLocale("fr");
    expect(getRootCatalog().Settings.TITLE).toBe("Paramètres");
  });

  it("supports async locale loading", async () => {
    const koBundle = await loadLocale("ko");
    expect(koBundle.Settings.TITLE).toBe("설정");

    await loadLocale("de");
    setLocale("de");
    expect(getLocale()).toBe("de");
    expect(getRootCatalog().Settings.TITLE).toBe("Einstellungen");
  });

  it("normalizes device locales and validates language codes", () => {
    expect(detectDeviceLanguage("pt-BR")).toBe("pt");
    expect(detectDeviceLanguage("zh-Hans-CN")).toBe("zh");
    expect(detectDeviceLanguage("in-ID")).toBe("id");
    expect(detectDeviceLanguage("sv-SE")).toBe("en");

    expect(isSupportedLanguage("ja")).toBe(true);
    expect(isSupportedLanguage("sv")).toBe(false);
  });

  it("exposes locale metadata for all supported languages", () => {
    expect(APP_LANGUAGE_STORAGE_KEY).toBe("appLanguage");
    expect(SUPPORTED_LANGUAGES).toHaveLength(17);
    expect(LANGUAGE_OPTIONS).toHaveLength(17);
    expect(getLanguageLabel("en")).toBe("English");
    expect(getLanguageLabel("vi")).toBe("Tiếng Việt");
  });

  it("keeps all locale catalogs structurally aligned with English", () => {
    const englishPaths = getLeafPaths(getRootCatalog());

    for (const language of SUPPORTED_LANGUAGES) {
      setLocale(language);
      const bundle = getRootCatalog();

      for (const path of englishPaths) {
        const value = getPathValue(bundle, path);
        expect(typeof value).toBe("string");
        expect(String(value).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("matches generated locale namespaces to the stitched root catalog output", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      setLocale(language);
      const rootBundle = getRootCatalog();
      const localeNamespaces = localeCatalogs[language] as Record<string, Record<string, unknown>>;
      const stitched = Object.values(localeNamespaces).reduce<Record<string, unknown>>((acc, namespaceValue) => {
        return {...acc, ...namespaceValue};
      }, {});

      expect(rootBundle).toEqual(stitched as TranslationSchema);
    }
  });
});
