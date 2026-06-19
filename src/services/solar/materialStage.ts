/**
 * @fileoverview Strict material creation stage for the solar-system background.
 */
import {DoubleSide, MeshBasicMaterial, MeshPhongMaterial, type Texture} from "three";
import {SOLAR_SYSTEM_CONFIG, type PlanetConfig} from "./solarSystemConfig";
import {
  getMoonMaterialKey,
  getMoonTextureKey,
  getPlanetMaterialKey,
  getPlanetTextureKey,
  getRingMaterialKey,
  getRingTextureKey,
  getSunMaterialKey,
} from "./solarContracts";

export type SolarMaterial = MeshPhongMaterial | MeshBasicMaterial;

export interface MaterialProgress {
  loaded: number;
  total: number;
  currentItem: string;
}

const requireTexture = (textures: Map<string, Texture>, key: string): Texture => {
  const texture = textures.get(key);
  if (!texture) {
    throw new Error(`Missing required solar texture: ${key}`);
  }

  return texture;
};

const createMaterialEntries = (
  textures: Map<string, Texture>,
): Array<{key: string; create: () => SolarMaterial}> => {
  const entries: Array<{key: string; create: () => SolarMaterial}> = [
    {
      key: getSunMaterialKey(),
      create: () =>
        new MeshBasicMaterial({
          color: 0xffff00,
          map: requireTexture(textures, getSunMaterialKey()),
          transparent: false,
        }),
    },
  ];

  SOLAR_SYSTEM_CONFIG.forEach((planet: PlanetConfig) => {
    entries.push({
      key: getPlanetMaterialKey(planet),
      create: () =>
        new MeshPhongMaterial({
          map: requireTexture(textures, getPlanetTextureKey(planet)),
          color: 0xffffff,
          shininess: 48,
          specular: 0x383838,
        }),
    });

    planet.moons?.forEach((_moon, moonIndex) => {
      entries.push({
        key: getMoonMaterialKey(planet, moonIndex),
        create: () =>
          new MeshPhongMaterial({
            map: requireTexture(textures, getMoonTextureKey(planet, moonIndex)),
            color: 0xffffff,
            shininess: 12,
            specular: 0x111111,
          }),
      });
    });

    if (planet.rings) {
      entries.push({
        key: getRingMaterialKey(planet),
        create: () =>
          new MeshPhongMaterial({
            map: requireTexture(textures, getRingTextureKey(planet)),
            color: 0xffffff,
            shininess: 8,
            specular: 0x111111,
            transparent: true,
            opacity: 0.48,
            alphaTest: 0.01,
            depthWrite: false,
            side: DoubleSide,
          }),
      });
    }
  });

  return entries;
};

export const createMaterialsStage = async (
  textures: Map<string, Texture>,
  onProgress?: (progress: MaterialProgress) => void,
): Promise<Map<string, SolarMaterial>> => {
  const materials = new Map<string, SolarMaterial>();
  const entries = createMaterialEntries(textures);

  entries.forEach((entry, index) => {
    if (materials.has(entry.key)) {
      throw new Error(`Duplicate material key detected: ${entry.key}`);
    }

    materials.set(entry.key, entry.create());
    onProgress?.({
      loaded: index + 1,
      total: entries.length,
      currentItem: entry.key,
    });
  });

  return materials;
};
