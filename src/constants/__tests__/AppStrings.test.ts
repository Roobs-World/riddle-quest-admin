import {getRootCatalog} from "../../i18n";

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.values(value).flatMap((entry) => collectStrings(entry));
};

describe("generated i18n catalog", () => {
  it("exposes the expected top-level sections", () => {
    const catalog = getRootCatalog();

    expect(catalog).toHaveProperty("AuthStrings");
    expect(catalog).toHaveProperty("Navigation");
    expect(catalog).toHaveProperty("Settings");
    expect(catalog).toHaveProperty("Profile");
    expect(catalog).toHaveProperty("Tooltips");
    expect(catalog).toHaveProperty("Accessibility");
  });

  it("preserves representative English copy", () => {
    const catalog = getRootCatalog();

    expect(catalog.AuthStrings.Login.TITLE).toBe("Log in");
    expect(catalog.AuthStrings.SignUp.TITLE).toBe("Create your account");
    expect(catalog.Navigation.GAME).toBe("Game");
    expect(catalog.Settings.TITLE).toBe("Settings");
    expect(catalog.Profile.TITLE).toBe("Profile");
    expect(catalog.CoinShop.TITLE).toBe("COIN SHOP");
  });

  it("keeps all exported strings non-empty", () => {
    const strings = collectStrings(getRootCatalog());

    expect(strings.length).toBeGreaterThan(200);

    strings.forEach((value) => {
      expect(value.trim().length).toBeGreaterThan(0);
    });
  });
});
