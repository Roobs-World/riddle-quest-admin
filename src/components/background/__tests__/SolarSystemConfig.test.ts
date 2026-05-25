import {SOLAR_SYSTEM_CONFIG} from "../SolarSystemConfig";

describe("SolarSystemConfig", () => {
  it("defines expected planet entries", () => {
    expect(SOLAR_SYSTEM_CONFIG.length).toBe(7);

    const names = SOLAR_SYSTEM_CONFIG.map((p) => p.name);
    expect(names).toEqual(["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus"]);
  });

  it("contains valid numeric orbital and size values", () => {
    for (const planet of SOLAR_SYSTEM_CONFIG) {
      expect(planet.size).toBeGreaterThan(0);
      expect(planet.distance).toBeGreaterThan(0);
      expect(planet.orbitSpeed).toBeGreaterThan(0);
      expect(typeof planet.startAngle).toBe("number");
      expect(typeof planet.atmosphereColor).toBe("string");

      for (const moon of planet.moons) {
        expect(moon.size).toBeGreaterThan(0);
        expect(moon.distance).toBeGreaterThan(0);
        expect(moon.orbitSpeed).toBeGreaterThan(0);
        expect(typeof moon.startAngle).toBe("number");
      }
    }
  });

  it("keeps ring of major planets farther than inner planets", () => {
    const earth = SOLAR_SYSTEM_CONFIG.find((p) => p.name === "Earth");
    const saturn = SOLAR_SYSTEM_CONFIG.find((p) => p.name === "Saturn");
    const uranus = SOLAR_SYSTEM_CONFIG.find((p) => p.name === "Uranus");

    expect(earth).toBeDefined();
    expect(saturn).toBeDefined();
    expect(uranus).toBeDefined();

    expect(saturn!.distance).toBeGreaterThan(earth!.distance);
    expect(uranus!.distance).toBeGreaterThan(saturn!.distance);
  });
});
