import {
  APP_LANGUAGE_STORAGE_KEY,
  AppStrings,
  LANGUAGE_OPTIONS,
  SUPPORTED_LANGUAGES,
  getAppLanguage,
  getLanguageLabel,
  isSupportedLanguage,
  loadAppStringsForLanguage,
  setAppLanguage,
  setAppLanguageAsync,
  useDeviceLanguage,
} from "../AppStrings";
import {
  deOverrides,
  esOverrides,
  frOverrides,
  hiOverrides,
  jaOverrides,
  koOverrides,
  ptOverrides,
  ruOverrides,
  trOverrides,
  zhOverrides,
  arOverrides,
  idOverrides,
  itOverrides,
  nlOverrides,
  plOverrides,
  viOverrides,
} from "../../i18n/languageOverrides";
import type {LocaleOverrides} from "../../i18n/types";

const localeOverridesByLanguage = {
  es: esOverrides,
  pt: ptOverrides,
  fr: frOverrides,
  de: deOverrides,
  ja: jaOverrides,
  ko: koOverrides,
  zh: zhOverrides,
  hi: hiOverrides,
  ru: ruOverrides,
  tr: trOverrides,
  ar: arOverrides,
  id: idOverrides,
  it: itOverrides,
  nl: nlOverrides,
  pl: plOverrides,
  vi: viOverrides,
} satisfies Record<Exclude<(typeof SUPPORTED_LANGUAGES)[number], "en">, LocaleOverrides>;

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

describe("AppStrings i18n support", () => {
  afterEach(() => {
    setAppLanguage("en");
  });

  it("defaults to English", () => {
    expect(getAppLanguage()).toBe("en");
    expect(AppStrings.Settings.TITLE).toBe("Settings");
  });

  it("switches to Spanish strings when language is set to es", () => {
    setAppLanguage("es");

    expect(getAppLanguage()).toBe("es");
    expect(AppStrings.Settings.TITLE).toBe("Configuracion");
    expect(AppStrings.AuthStrings.Login.TITLE).toBe("Iniciar sesion");
  });

  it("falls back to English for untranslated Spanish keys", () => {
    setAppLanguage("es");

    expect(AppStrings.Achievements.UNLOCKED_ALERT_TITLE).toBe(
      "Logro(s) desbloqueado(s)!"
    );
  });

  it("normalizes locale values when using device language", () => {
    expect(useDeviceLanguage("es-ES")).toBe("es");
    expect(AppStrings.Settings.TITLE).toBe("Configuracion");

    expect(useDeviceLanguage("fr-FR")).toBe("fr");
    expect(AppStrings.Settings.TITLE).toBe("Parametres");
  });

  it("exposes 17 popular game languages in settings", () => {
    expect(LANGUAGE_OPTIONS).toHaveLength(17);
    expect(LANGUAGE_OPTIONS.map((option) => option.code)).toEqual([
      "en",
      "es",
      "pt",
      "fr",
      "de",
      "ja",
      "ko",
      "zh",
      "hi",
      "ru",
      "tr",
      "ar",
      "id",
      "it",
      "nl",
      "pl",
      "vi",
    ]);
  });

  it("provides language validation and labels", () => {
    expect(isSupportedLanguage("ja")).toBe(true);
    expect(isSupportedLanguage("hi")).toBe(true);
    expect(isSupportedLanguage("it")).toBe(true);
    expect(isSupportedLanguage("sv")).toBe(false);
    expect(getLanguageLabel("hi")).toBe("हिन्दी");
    expect(getLanguageLabel("ar")).toBe("العربية");
    expect(getLanguageLabel("id")).toBe("Bahasa Indonesia");
    expect(getLanguageLabel("ko")).toBe("한국어");
  });

  it("supports switching to the added languages", () => {
    setAppLanguage("pt");
    expect(AppStrings.Settings.TITLE).toBe("Configuracoes");

    setAppLanguage("de");
    expect(AppStrings.Settings.TITLE).toBe("Einstellungen");

    setAppLanguage("tr");
    expect(AppStrings.Settings.TITLE).toBe("Ayarlar");

    setAppLanguage("hi");
    expect(AppStrings.Settings.TITLE).toBe("सेटिंग्स");

    setAppLanguage("it");
    expect(AppStrings.Settings.TITLE).toBe("Impostazioni");

    setAppLanguage("id");
    expect(AppStrings.Settings.TITLE).toBe("Pengaturan");
  });

  it("uses native scripts for ja, ko, and zh bundles", () => {
    setAppLanguage("ja");
    expect(AppStrings.Settings.TITLE).toBe("設定");

    setAppLanguage("ko");
    expect(AppStrings.Settings.TITLE).toBe("설정");

    setAppLanguage("zh");
    expect(AppStrings.Settings.TITLE).toBe("设置");
  });

  it("supports async language loading path", async () => {
    const esBundle = await loadAppStringsForLanguage("es");
    expect(esBundle.Settings.TITLE).toBe("Configuracion");

    await setAppLanguageAsync("fr");
    expect(getAppLanguage()).toBe("fr");
    expect(AppStrings.Settings.TITLE).toBe("Parametres");
  });

  it("normalizes all supported locale prefixes and falls back to English", () => {
    expect(useDeviceLanguage("pt-BR")).toBe("pt");
    expect(useDeviceLanguage("de-DE")).toBe("de");
    expect(useDeviceLanguage("ja-JP")).toBe("ja");
    expect(useDeviceLanguage("ko-KR")).toBe("ko");
    expect(useDeviceLanguage("zh-CN")).toBe("zh");
    expect(useDeviceLanguage("zh-Hans-CN")).toBe("zh");
    expect(useDeviceLanguage("hi-IN")).toBe("hi");
    expect(useDeviceLanguage("ru-RU")).toBe("ru");
    expect(useDeviceLanguage("tr-TR")).toBe("tr");
    expect(useDeviceLanguage("ar-SA")).toBe("ar");
    expect(useDeviceLanguage("id-ID")).toBe("id");
    expect(useDeviceLanguage("in-ID")).toBe("id");
    expect(useDeviceLanguage("it-IT")).toBe("it");
    expect(useDeviceLanguage("nl-NL")).toBe("nl");
    expect(useDeviceLanguage("pl-PL")).toBe("pl");
    expect(useDeviceLanguage("vi-VN")).toBe("vi");
    expect(useDeviceLanguage("sv-SE")).toBe("en");
  });

  it("falls back to English label for unknown language code", () => {
    expect(getLanguageLabel("en")).toBe("English");
    expect(getLanguageLabel("zz" as any)).toBe("English");
  });

  it("exposes language storage key", () => {
    expect(APP_LANGUAGE_STORAGE_KEY).toBe("appLanguage");
  });

  it("implements tooltip strings for every supported language", () => {
    const tooltipKeys = Object.keys(AppStrings.Tooltips) as Array<
      keyof typeof AppStrings.Tooltips
    >;
    const englishSubmitTitle = AppStrings.Tooltips.SUBMIT_ANSWER_TITLE;
    const englishGotItButton = AppStrings.Tooltips.GOT_IT_BUTTON;

    for (const language of SUPPORTED_LANGUAGES) {
      setAppLanguage(language);

      for (const key of tooltipKeys) {
        expect(typeof AppStrings.Tooltips[key]).toBe("string");
        expect(AppStrings.Tooltips[key].trim().length).toBeGreaterThan(0);
      }

      if (language !== "en") {
        expect(AppStrings.Tooltips.SUBMIT_ANSWER_TITLE).not.toBe(
          englishSubmitTitle
        );
        expect(AppStrings.Tooltips.GOT_IT_BUTTON).not.toBe(englishGotItButton);
      }
    }
  });

  it("has explicit locale values for every supported language string", () => {
    setAppLanguage("en");
    const englishPaths = getLeafPaths(AppStrings);

    Object.entries(localeOverridesByLanguage).forEach(([language, overrides]) => {
      const missingPaths = englishPaths.filter((path) => {
        const translatedValue = getPathValue(overrides, path);
        return typeof translatedValue !== "string" || translatedValue.trim().length === 0;
      });

      expect({language, missingPaths}).toEqual({language, missingPaths: []});
    });
  });

});
