jest.mock("../../../../assets/3d/tex_planet_a.png", () => "tex_planet_a.png");
jest.mock("../../../../assets/3d/tex_planet_v.png", () => "tex_planet_v.png");
jest.mock("../../../../assets/3d/tex_planet_d.png", () => "tex_planet_d.png");
jest.mock("../../../../assets/3d/tex_planet_r.png", () => "tex_planet_r.png");
jest.mock("../../../../assets/3d/tex_planet_k.png", () => "tex_planet_k.png");
jest.mock("../../../../assets/3d/tex_planet_s.png", () => "tex_planet_s.png");
jest.mock("../../../../assets/3d/tex_planet_u.png", () => "tex_planet_u.png");
jest.mock("../../../../assets/3d/tex_moon_c.png", () => "tex_moon_c.png");
jest.mock("../../../../assets/3d/tex_moon_d.png", () => "tex_moon_d.png");
jest.mock("../../../../assets/3d/tex_moon_f.png", () => "tex_moon_f.png");
jest.mock("../../../../assets/3d/tex_moon_g.png", () => "tex_moon_g.png");
jest.mock("../../../../assets/3d/tex_moon_h.png", () => "tex_moon_h.png");
jest.mock("../../../../assets/3d/tex_ring_a.png", () => "tex_ring_a.png");
jest.mock("../../../../assets/3d/tex_ring_b.png", () => "tex_ring_b.png");

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

  it("assigns a unique texture to every planet", () => {
    const textureKeys = SOLAR_SYSTEM_CONFIG.map((planet) => planet.textureKey);

    expect(new Set(textureKeys).size).toBe(SOLAR_SYSTEM_CONFIG.length);
  });

  it("labels moon bodies with moon-only texture keys", () => {
    const moonTextureKeys = SOLAR_SYSTEM_CONFIG.flatMap((planet) => planet.moons.map((moon) => moon.textureKey));

    expect(moonTextureKeys.length).toBeGreaterThan(0);

    for (const textureKey of moonTextureKeys) {
      expect(textureKey.startsWith("moon_")).toBe(true);
      expect(textureKey.startsWith("planet_")).toBe(false);
      expect(textureKey).not.toBe("sun");
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

    expect(ringedPlanets.map((planet) => planet.name)).toEqual(["Earth", "Saturn"]);

    for (const planet of ringedPlanets) {
      expect(planet.ring!.innerRadius).toBeGreaterThan(planet.size);
      expect(planet.ring!.outerRadius).toBeGreaterThan(planet.ring!.innerRadius);
      expect(planet.ring!.textureModule).toBeTruthy();
      expect(planet.ring!.tiltRadians).toBeGreaterThan(0);
    }
  });
});
