import {
  arOverrides,
  deOverrides,
  esOverrides,
  frOverrides,
  hiOverrides,
  idOverrides,
  itOverrides,
  jaOverrides,
  koOverrides,
  nlOverrides,
  plOverrides,
  ptOverrides,
  ruOverrides,
  trOverrides,
  viOverrides,
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
      hiOverrides,
      ruOverrides,
      trOverrides,
      arOverrides,
      idOverrides,
      itOverrides,
      nlOverrides,
      plOverrides,
      viOverrides,
    ];

    bundles.forEach((bundle) => {
      expect(typeof bundle).toBe("object");
      expect(Object.keys(bundle).length).toBeGreaterThan(0);
    });
  });

  it("contains representative translated labels", () => {
    expect(esOverrides.Settings?.TITLE).toBe("Configuracion");
    expect(deOverrides.Settings?.TITLE).toBe("Einstellungen");
    expect(hiOverrides.Settings?.TITLE).toBe("सेटिंग्स");
    expect(trOverrides.Settings?.TITLE).toBe("Ayarlar");
    expect(arOverrides.Settings?.TITLE).toBe("الإعدادات");
    expect(idOverrides.Settings?.TITLE).toBe("Pengaturan");
    expect(itOverrides.Settings?.TITLE).toBe("Impostazioni");
  });
});
