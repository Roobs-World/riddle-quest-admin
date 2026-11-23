import {PLANET_ATMOSPHERES} from "../solarAtmospheres";

describe("solar-system planet atmospheres", () => {
  it("gives every planet a visible, bounded atmosphere shell", () => {
    /** Provides atmospheres behavior. */
    const atmospheres = Object.values(PLANET_ATMOSPHERES);
    expect(atmospheres).toHaveLength(7);

    for (const atmosphere of atmospheres) {
      expect(atmosphere.scale).toBeGreaterThan(1);
      expect(atmosphere.scale).toBeLessThanOrEqual(1.15);
      expect(atmosphere.opacity).toBeGreaterThan(0);
      expect(atmosphere.opacity).toBeLessThanOrEqual(0.7);
      expect(atmosphere.falloff).toBeGreaterThan(1);
      expect(atmosphere.surfaceHaze).toBeGreaterThanOrEqual(0);
      expect(atmosphere.surfaceHaze).toBeLessThanOrEqual(0.25);
    }

    expect(new Set(atmospheres.map(({color}) => color)).size).toBe(atmospheres.length);
    expect(new Set(atmospheres.map(({falloff}) => falloff)).size).toBe(atmospheres.length);
  });
});
