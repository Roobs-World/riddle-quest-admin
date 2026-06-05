import {getRootCatalog, setLocale, translationKeys} from "../../i18n";

describe("i18n runtime coverage", () => {
  afterEach(() => {
    setLocale("en");
  });

  it("exposes the generated root catalog shape", () => {
    const catalog = getRootCatalog();
    const keys = Object.keys(catalog);

    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain("Settings");
    expect(Object.getOwnPropertyDescriptor(catalog, "Settings")).toBeDefined();
  });

  it("tracks locale changes through the runtime catalog", () => {
    setLocale("es");
    expect(getRootCatalog().Settings.TITLE).toBe("Configuración");

    setLocale("en");
    expect(getRootCatalog().Settings.TITLE).toBe("Settings");
  });

  it("publishes generated translation keys", () => {
    expect(translationKeys.length).toBeGreaterThan(50);
    expect(translationKeys).toContain("Settings.TITLE");
    expect(translationKeys).toContain("AuthStrings.Landing.PLAY_AS_GUEST");
    expect(translationKeys).toContain("AuthStrings.Validation.USERNAME_PROFANITY");
    expect(translationKeys).toContain("Tooltips.SUBMIT_ANSWER_TITLE");
  });
});
