import {
  deOverrides,
  esOverrides,
  frOverrides,
  jaOverrides,
  koOverrides,
  ptOverrides,
  ruOverrides,
  trOverrides,
  zhOverrides,
} from "../languageOverrides";

describe("languageOverrides", () => {
  it("exports non-empty locale override maps", () => {
    const bundles = [
      esOverrides,
      ptOverrides,
      frOverrides,
      deOverrides,
      jaOverrides,
      koOverrides,
      zhOverrides,
      ruOverrides,
      trOverrides,
    ];

    bundles.forEach((bundle) => {
      expect(typeof bundle).toBe("object");
      expect(Object.keys(bundle).length).toBeGreaterThan(0);
    });
  });

  it("contains representative translated labels", () => {
    expect(esOverrides.Settings?.TITLE).toBe("Configuracion");
    expect(deOverrides.Settings?.TITLE).toBe("Einstellungen");
    expect(trOverrides.Settings?.TITLE).toBe("Ayarlar");
  });
});
