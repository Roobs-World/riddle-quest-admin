describe("AppStrings internal coverage paths", () => {
  it("handles undefined and missing override values during deep merge", () => {
    jest.isolateModules(() => {
      jest.doMock("../../i18n/languageOverrides", () => ({
        esOverrides: {
          Settings: {
            TITLE: undefined,
          },
        },
        ptOverrides: undefined,
        frOverrides: {},
        deOverrides: {},
        jaOverrides: {},
        koOverrides: {},
        zhOverrides: {},
        hiOverrides: {},
        ruOverrides: {},
        trOverrides: {},
      }));

      const mod = require("../AppStrings");
      expect(mod.AppStrings.Settings.TITLE).toBe("Settings");
    });
  });

  it("exercises proxy enumeration traps", () => {
    const mod = require("../AppStrings");
    const keys = Object.keys(mod.AppStrings);
    expect(keys.length).toBeGreaterThan(0);
    expect(Object.getOwnPropertyDescriptor(mod.AppStrings, "Settings")).toBeDefined();
  });
});
