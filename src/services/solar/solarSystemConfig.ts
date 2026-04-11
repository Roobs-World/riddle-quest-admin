/**
 * @fileoverview Static solar-system texture mapping and celestial configuration.
 */
import texPlanetV from "../../../assets/3d/tex_planet_v.png";
import texPlanetA from "../../../assets/3d/tex_planet_a.png";
import texPlanetD from "../../../assets/3d/tex_planet_d.png";
import texPlanetK from "../../../assets/3d/tex_planet_k.png";

import texMoonH from "../../../assets/3d/tex_moon_h.png";
import texMoonF from "../../../assets/3d/tex_moon_f.png";
import texMoonG from "../../../assets/3d/tex_moon_g.png";
import texMoonC from "../../../assets/3d/tex_moon_c.png";
import texMoonD from "../../../assets/3d/tex_moon_d.png";

import texRingA from "../../../assets/3d/tex_ring_a.png";
import texRingB from "../../../assets/3d/tex_ring_b.png";

import texGradientCircle from "../../../assets/3d/tex_gradient_circle.png";
import texGradientCircleSun from "../../../assets/3d/tex_gradient_circle_sun.png";
import texGradientCircleI from "../../../assets/3d/tex_gradient_circle_i.png";
import texGradientCircleSunI from "../../../assets/3d/tex_gradient_circle_sun_i.png";

/**
 * Config for one planet in the rendered solar system.
 */
export interface PlanetConfig {
  id: string;
  texture: string;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  radius: number;
  materialType: "basic" | "phong";
  moons?: MoonConfig[];
  rings?: RingConfig;
}

/**
 * Config for one moon orbiting a planet.
 */
export interface MoonConfig {
  texture: string;
  orbitRadius: number;
  orbitSpeed: number;
  radius: number;
}

/**
 * Config for a planet ring mesh.
 */
export interface RingConfig {
  texture: string;
  innerRadius: number;
  outerRadius: number;
}

/**
 * Mapping between logical texture keys and bundled asset paths.
 */
export interface TextureMappingEntry {
  key: string;
  path: string;
}

/**
 * Canonical texture mapping used by preload and material builders.
 */
export const SOLAR_TEXTURE_MAPPING: TextureMappingEntry[] = [
  { key: "planet_a", path: texPlanetA },
  { key: "planet_d", path: texPlanetD },
  { key: "planet_v", path: texPlanetV },
  { key: "planet_k", path: texPlanetK },
  { key: "ring_planet_v", path: texRingA },
  { key: "ring_planet_k", path: texRingB },
  { key: "moon_a_h", path: texMoonH },
  { key: "moon_d_f", path: texMoonF },
  { key: "moon_d_g", path: texMoonG },
  { key: "moon_k_c", path: texMoonC },
  { key: "moon_k_d", path: texMoonD },
  { key: "glow_planet", path: texGradientCircle },
  { key: "glow_sun", path: texGradientCircleSun },
  { key: "glow_planet_intense", path: texGradientCircleI },
  { key: "glow_sun_intense", path: texGradientCircleSunI },
];

/**
 * Canonical planet/moon/ring configuration used to construct the scene graph.
 */
export const SOLAR_SYSTEM_CONFIG: PlanetConfig[] = [
  {
    id: "planet_a",
    texture: texPlanetA,
    orbitRadius: 35,
    orbitSpeed: 0.7,
    rotationSpeed: 0.015,
    radius: 5.0,
    materialType: "phong",
    moons: [
      {
        texture: texMoonH,
        orbitRadius: 8,
        orbitSpeed: 2.0,
        radius: 2.0,
      },
    ],
  },
  {
    id: "planet_d",
    texture: texPlanetD,
    orbitRadius: 45,
    orbitSpeed: 0.6,
    rotationSpeed: 0.012,
    radius: 4.5,
    materialType: "phong",
    moons: [
      {
        texture: texMoonF,
        orbitRadius: 10,
        orbitSpeed: 1.5,
        radius: 1.8,
      },
      {
        texture: texMoonG,
        orbitRadius: 13,
        orbitSpeed: 1.2,
        radius: 2.0,
      },
    ],
  },
  {
    id: "planet_v",
    texture: texPlanetV,
    orbitRadius: 60,
    orbitSpeed: 0.45,
    rotationSpeed: 0.008,
    radius: 8.0,
    materialType: "phong",
    rings: {
      texture: texRingA,
      innerRadius: 10.0,
      outerRadius: 14.0,
    },
  },
  {
    id: "planet_k",
    texture: texPlanetK,
    orbitRadius: 75,
    orbitSpeed: 0.3,
    rotationSpeed: 0.006,
    radius: 7.5,
    materialType: "phong",
    moons: [
      {
        texture: texMoonC,
        orbitRadius: 15,
        orbitSpeed: 1.0,
        radius: 2.5,
      },
      {
        texture: texMoonD,
        orbitRadius: 20,
        orbitSpeed: 0.9,
        radius: 2.2,
      },
    ],
    rings: {
      texture: texRingB,
      innerRadius: 12.0,
      outerRadius: 18.0,
    },
  },
];
