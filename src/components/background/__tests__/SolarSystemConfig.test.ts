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

  it("defines valid textured ring geometry for configured ringed planets", () => {
    const ringedPlanets = SOLAR_SYSTEM_CONFIG.filter((planet) => planet.ring);

    expect(ringedPlanets.map((planet) => planet.name)).toEqual(["Earth", "Mars"]);

    for (const planet of ringedPlanets) {
      expect(planet.ring!.innerRadius).toBeGreaterThan(planet.size);
      expect(planet.ring!.outerRadius).toBeGreaterThan(planet.ring!.innerRadius);
      expect(planet.ring!.textureModule).toBeTruthy();
      expect(planet.ring!.tiltRadians).toBeGreaterThan(0);
    }
  });
});
