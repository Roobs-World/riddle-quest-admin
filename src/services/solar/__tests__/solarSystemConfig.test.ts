jest.mock("../../../../assets/3d/tex_planet_v.png", () => "tex_planet_v.png");
jest.mock("../../../../assets/3d/tex_planet_a.png", () => "tex_planet_a.png");
jest.mock("../../../../assets/3d/tex_planet_d.png", () => "tex_planet_d.png");
jest.mock("../../../../assets/3d/tex_planet_k.png", () => "tex_planet_k.png");
jest.mock("../../../../assets/3d/tex_moon_h.png", () => "tex_moon_h.png");
jest.mock("../../../../assets/3d/tex_moon_f.png", () => "tex_moon_f.png");
jest.mock("../../../../assets/3d/tex_moon_g.png", () => "tex_moon_g.png");
jest.mock("../../../../assets/3d/tex_moon_c.png", () => "tex_moon_c.png");
jest.mock("../../../../assets/3d/tex_moon_d.png", () => "tex_moon_d.png");
jest.mock("../../../../assets/3d/tex_ring_a.png", () => "tex_ring_a.png");
jest.mock("../../../../assets/3d/tex_ring_b.png", () => "tex_ring_b.png");
jest.mock("../../../../assets/3d/tex_gradient_circle.png", () => "tex_gradient_circle.png");
jest.mock("../../../../assets/3d/tex_gradient_circle_sun.png", () => "tex_gradient_circle_sun.png");
jest.mock("../../../../assets/3d/tex_gradient_circle_i.png", () => "tex_gradient_circle_i.png");
jest.mock("../../../../assets/3d/tex_gradient_circle_sun_i.png", () => "tex_gradient_circle_sun_i.png");
jest.mock("../../../../assets/3d/tex_sun_spots_02.png", () => "tex_sun_spots_02.png");

import {SOLAR_SYSTEM_CONFIG, SOLAR_TEXTURE_MAPPING} from "../solarSystemConfig";

describe("solarSystemConfig", () => {
  it("has unique texture keys", () => {
    const keys = SOLAR_TEXTURE_MAPPING.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("sun");
  });

  it("defines expected planet count and positive orbital values", () => {
    expect(SOLAR_SYSTEM_CONFIG).toHaveLength(4);

    SOLAR_SYSTEM_CONFIG.forEach((planet) => {
      expect(planet.id.length).toBeGreaterThan(0);
      expect(planet.orbitRadius).toBeGreaterThan(0);
      expect(planet.orbitSpeed).toBeGreaterThan(0);
      expect(planet.radius).toBeGreaterThan(0);
    });
  });

  it("includes moon and ring data for configured planets", () => {
    const withMoons = SOLAR_SYSTEM_CONFIG.filter((p) => (p.moons?.length ?? 0) > 0);
    const withRings = SOLAR_SYSTEM_CONFIG.filter((p) => p.rings);

    expect(withMoons.length).toBeGreaterThan(0);
    expect(withRings.length).toBeGreaterThan(0);
  });
});
