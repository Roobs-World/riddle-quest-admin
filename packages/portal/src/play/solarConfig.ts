import {PLANET_ATMOSPHERES, type PlanetAtmosphere} from "./solarAtmospheres";
import mercuryTextureUrl from "../../../../assets/3d-web/tex_planet_a.webp";
import venusTextureUrl from "../../../../assets/3d-web/tex_planet_d.webp";
import earthTextureUrl from "../../../../assets/3d-web/tex_planet_v.webp";
import marsTextureUrl from "../../../../assets/3d-web/tex_planet_r.webp";
import jupiterTextureUrl from "../../../../assets/3d-web/tex_planet_k.webp";
import saturnTextureUrl from "../../../../assets/3d-web/tex_planet_s.webp";
import uranusTextureUrl from "../../../../assets/3d-web/tex_planet_u.webp";
import moonCTextureUrl from "../../../../assets/3d-web/tex_moon_c.webp";
import moonDTextureUrl from "../../../../assets/3d-web/tex_moon_d.webp";
import moonFTextureUrl from "../../../../assets/3d-web/tex_moon_f.webp";
import moonGTextureUrl from "../../../../assets/3d-web/tex_moon_g.webp";
import moonHTextureUrl from "../../../../assets/3d-web/tex_moon_h.webp";
import ringATextureUrl from "../../../../assets/3d-web/tex_ring_a.webp";
import ringBTextureUrl from "../../../../assets/3d-web/tex_ring_b.webp";
/** Describes moon config. */
export type MoonConfig = {
  /** Stores size. */
  size: number;
  /** Stores distance. */
  distance: number;
  /** Stores orbit speed. */
  orbitSpeed: number;
  /** Stores texture. */
  texture: string;
  /** Stores start angle. */
  startAngle: number;
};

/** Describes planet config. */
export type PlanetConfig = {
  /** Stores name. */
  name: string;
  /** Stores size. */
  size: number;
  /** Stores distance. */
  distance: number;
  /** Stores orbit speed. */
  orbitSpeed: number;
  /** Stores rotation speed. */
  rotationSpeed: number;
  /** Stores texture. */
  texture: string;
  /** Stores start angle. */
  startAngle: number;
  /** Stores y position. */
  yPosition: number;
  /** Stores moons. */
  moons: MoonConfig[];
  /** Stores atmosphere. */
  atmosphere: PlanetAtmosphere;
  /** Stores ring. */
  ring?: {innerRadius: number; outerRadius: number; texture: string; tiltRadians: number};
};

/** Defines the solar system config value. */
export const SOLAR_SYSTEM_CONFIG: readonly PlanetConfig[] = [
  {
    name: "Mercury",
    size: 2.2,
    distance: 18,
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    texture: mercuryTextureUrl,
    startAngle: 0,
    yPosition: 30,
    moons: [],
    atmosphere: PLANET_ATMOSPHERES.Mercury,
  },
  {
    name: "Venus",
    size: 3,
    distance: 26,
    orbitSpeed: 0.018,
    rotationSpeed: 0.008,
    texture: venusTextureUrl,
    startAngle: Math.PI / 3,
    yPosition: 30,
    moons: [],
    atmosphere: PLANET_ATMOSPHERES.Venus,
  },
  {
    name: "Earth",
    size: 3.5,
    distance: 30,
    orbitSpeed: 0.015,
    rotationSpeed: 0.02,
    texture: earthTextureUrl,
    startAngle: (Math.PI * 2) / 3,
    yPosition: 30,
    moons: [{size: 1, distance: 7, orbitSpeed: 0.06, texture: moonDTextureUrl, startAngle: 0}],
    atmosphere: PLANET_ATMOSPHERES.Earth,
    ring: {innerRadius: 4.5, outerRadius: 6.1, texture: ringATextureUrl, tiltRadians: Math.PI / 2.45},
  },
  {
    name: "Mars",
    size: 2.6,
    distance: 35,
    orbitSpeed: 0.015,
    rotationSpeed: 0.015,
    texture: marsTextureUrl,
    startAngle: Math.PI,
    yPosition: 28,
    moons: [{size: 0.8, distance: 7, orbitSpeed: 0.08, texture: moonGTextureUrl, startAngle: 0}],
    atmosphere: PLANET_ATMOSPHERES.Mars,
  },
  {
    name: "Jupiter",
    size: 10,
    distance: 70,
    orbitSpeed: 0.004,
    rotationSpeed: 0.025,
    texture: jupiterTextureUrl,
    startAngle: Math.PI * 1.2,
    yPosition: 30,
    moons: [
      {size: 1.3, distance: 13, orbitSpeed: 0.03, texture: moonHTextureUrl, startAngle: 0},
      {size: 1, distance: 11.5, orbitSpeed: 0.032, texture: moonCTextureUrl, startAngle: Math.PI / 3},
    ],
    atmosphere: PLANET_ATMOSPHERES.Jupiter,
  },
  {
    name: "Saturn",
    size: 8.5,
    distance: 90,
    orbitSpeed: 0.005,
    rotationSpeed: 0.022,
    texture: saturnTextureUrl,
    startAngle: Math.PI * 1.7,
    yPosition: 30,
    moons: [
      {size: 2, distance: 12, orbitSpeed: 0.038, texture: moonFTextureUrl, startAngle: 0},
      {size: 1.6, distance: 12, orbitSpeed: 0.03, texture: moonDTextureUrl, startAngle: Math.PI / 2},
    ],
    atmosphere: PLANET_ATMOSPHERES.Saturn,
    ring: {innerRadius: 11.5, outerRadius: 16.5, texture: ringBTextureUrl, tiltRadians: Math.PI / 2.25},
  },
  {
    name: "Uranus",
    size: 7,
    distance: 150,
    orbitSpeed: 0.004,
    rotationSpeed: 0.018,
    texture: uranusTextureUrl,
    startAngle: Math.PI * 0.3,
    yPosition: 30,
    moons: [],
    atmosphere: PLANET_ATMOSPHERES.Uranus,
  },
] as const;
