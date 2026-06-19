/**
 * @fileoverview Canonical solar-system key helpers shared across preload stages.
 */
import type {PlanetConfig} from "./solarSystemConfig";

export const SOLAR_TEXTURE_KEYS = {
  SUN: "sun",
  GLOW_SUN: "glow_sun",
  GLOW_SUN_INTENSE: "glow_sun_intense",
  GLOW_PLANET_INTENSE: "glow_planet_intense",
} as const;

export const getSunGeometryKey = (): string => "sun";
export const getSunMaterialKey = (): string => "sun";

export const getPlanetTextureKey = (planet: PlanetConfig): string => planet.textureKey;
export const getPlanetGeometryKey = (planet: PlanetConfig): string => `planet:${planet.textureKey}`;
export const getPlanetMaterialKey = (planet: PlanetConfig): string => `material:${planet.textureKey}`;

export const getMoonTextureKey = (planet: PlanetConfig, moonIndex: number): string => {
  const moon = planet.moons?.[moonIndex];
  if (!moon) {
    throw new Error(`Missing moon config at index ${moonIndex} for planet ${planet.id}`);
  }

  return moon.textureKey;
};

export const getMoonGeometryKey = (planet: PlanetConfig, moonIndex: number): string => {
  const moon = planet.moons?.[moonIndex];
  if (!moon) {
    throw new Error(`Missing moon config at index ${moonIndex} for planet ${planet.id}`);
  }

  return `moon:${planet.textureKey}:${moon.textureKey}`;
};

export const getMoonMaterialKey = (planet: PlanetConfig, moonIndex: number): string => {
  const moon = planet.moons?.[moonIndex];
  if (!moon) {
    throw new Error(`Missing moon config at index ${moonIndex} for planet ${planet.id}`);
  }

  return `material:${planet.textureKey}:${moon.textureKey}`;
};

export const getRingTextureKey = (planet: PlanetConfig): string => {
  if (!planet.rings) {
    throw new Error(`Missing ring config for planet ${planet.id}`);
  }

  return planet.rings.textureKey;
};

export const getRingGeometryKey = (planet: PlanetConfig): string => `ring:${planet.textureKey}`;
export const getRingMaterialKey = (planet: PlanetConfig): string => `ring-material:${planet.textureKey}`;
