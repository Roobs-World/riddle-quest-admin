import {
  APP_LANGUAGE_STORAGE_KEY,
  AppStrings,
  LANGUAGE_OPTIONS,
  getAppLanguage,
  getLanguageLabel,
  isSupportedLanguage,
  loadAppStringsForLanguage,
  setAppLanguage,
  setAppLanguageAsync,
  useDeviceLanguage,
} from "../AppStrings";

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

  it("exposes 10 popular game languages in settings", () => {
    expect(LANGUAGE_OPTIONS).toHaveLength(10);
    expect(LANGUAGE_OPTIONS.map((option) => option.code)).toEqual([
      "en",
      "es",
      "pt",
      "fr",
      "de",
      "ja",
      "ko",
      "zh",
      "ru",
      "tr",
    ]);
  });

  it("provides language validation and labels", () => {
    expect(isSupportedLanguage("ja")).toBe(true);
    expect(isSupportedLanguage("it")).toBe(false);
    expect(getLanguageLabel("ko")).toBe("한국어");
  });

  it("supports switching to the added languages", () => {
    setAppLanguage("pt");
    expect(AppStrings.Settings.TITLE).toBe("Configuracoes");

    setAppLanguage("de");
    expect(AppStrings.Settings.TITLE).toBe("Einstellungen");

    setAppLanguage("tr");
    expect(AppStrings.Settings.TITLE).toBe("Ayarlar");
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
    expect(useDeviceLanguage("ru-RU")).toBe("ru");
    expect(useDeviceLanguage("tr-TR")).toBe("tr");
    expect(useDeviceLanguage("it-IT")).toBe("en");
  });

  it("falls back to English label for unknown language code", () => {
    expect(getLanguageLabel("en")).toBe("English");
    expect(getLanguageLabel("zz" as any)).toBe("English");
  });

  it("exposes language storage key", () => {
    expect(APP_LANGUAGE_STORAGE_KEY).toBe("appLanguage");
  });

});
