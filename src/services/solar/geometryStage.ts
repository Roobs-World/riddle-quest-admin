/**
 * @fileoverview Strict geometry creation stage for the solar-system background.
 */
import {RingGeometry, SphereGeometry} from "three";
import {SOLAR_SYSTEM_CONFIG, type PlanetConfig} from "./solarSystemConfig";
import {getMoonGeometryKey, getPlanetGeometryKey, getRingGeometryKey, getSunGeometryKey} from "./solarContracts";

export type SolarGeometry = SphereGeometry | RingGeometry;

export interface GeometryProgress {
  loaded: number;
  total: number;
  currentItem: string;
}

const createGeometryEntries = (): Array<{key: string; create: () => SolarGeometry}> => {
  const entries: Array<{key: string; create: () => SolarGeometry}> = [
    {key: getSunGeometryKey(), create: () => new SphereGeometry(20.0, 48, 48)},
  ];

  SOLAR_SYSTEM_CONFIG.forEach((planet: PlanetConfig) => {
    entries.push({
      key: getPlanetGeometryKey(planet),
      create: () => new SphereGeometry(planet.radius, 32, 32),
    });

    planet.moons?.forEach((moon, moonIndex) => {
      entries.push({
        key: getMoonGeometryKey(planet, moonIndex),
        create: () => new SphereGeometry(moon.radius, 24, 24),
      });
    });

    const rings = planet.rings;
    if (rings) {
      entries.push({
        key: getRingGeometryKey(planet),
        create: () => new RingGeometry(rings.innerRadius, rings.outerRadius, 64),
      });
    }
  });

  return entries;
};

export const createGeometriesStage = async (
  onProgress?: (progress: GeometryProgress) => void,
): Promise<Map<string, SolarGeometry>> => {
  const geometries = new Map<string, SolarGeometry>();
  const entries = createGeometryEntries();

  entries.forEach((entry, index) => {
    if (geometries.has(entry.key)) {
      throw new Error(`Duplicate geometry key detected: ${entry.key}`);
    }

    geometries.set(entry.key, entry.create());
    onProgress?.({
      loaded: index + 1,
      total: entries.length,
      currentItem: entry.key,
    });
  });

  return geometries;
};
