/**
 * @fileoverview Strict scene assembly stage for the solar-system background.
 */
import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  PointLight,
  RingGeometry,
  Scene,
  SphereGeometry,
  Texture,
} from "three";
import {logger} from "../../utils/logger";
import {SOLAR_SYSTEM_CONFIG, type PlanetConfig} from "./solarSystemConfig";
import {
  getMoonGeometryKey,
  getMoonMaterialKey,
  getPlanetGeometryKey,
  getPlanetMaterialKey,
  getRingGeometryKey,
  getRingMaterialKey,
  getSunGeometryKey,
} from "./solarContracts";

export interface SceneSetup {
  scene: Scene;
  camera: PerspectiveCamera;
}

export interface PreloadedSolarSystem {
  scene: Scene;
  camera: PerspectiveCamera;
  planetsGroup: Group;
  meshes: Mesh[];
  lights: (DirectionalLight | AmbientLight | PointLight)[];
  geometries: Map<string, SphereGeometry | RingGeometry>;
  materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>;
  textures: Map<string, Texture>;
}

export const createSceneSetup = (): SceneSetup => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(90, 1, 0.1, 800);
  camera.position.set(90, 60, 90);
  camera.lookAt(0, 0, 0);

  logger.debug("Camera positioned at (90, 60, 90) looking at center (0, 0, 0) for compact solar system view");

  return {scene, camera};
};

export const addEnhancedLights = (scene: Scene, lights: (DirectionalLight | AmbientLight | PointLight)[]): void => {
  const sunLight = new PointLight(0xfff4d6, 45000.0, 0, 2);
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = false;
  scene.add(sunLight);
  lights.push(sunLight);

  const ambientLight = new AmbientLight(0x443322, 0.18);
  scene.add(ambientLight);
  lights.push(ambientLight);

  logger.debug("Strict solar lighting setup initialized.");
};

export const addSunMeshes = (
  scene: Scene,
  geometries: Map<string, SphereGeometry | RingGeometry>,
  textures: Map<string, Texture>,
  meshes: Mesh[],
): void => {
  const sunGeometry = geometries.get(getSunGeometryKey());
  if (!sunGeometry) {
    throw new Error("Missing required sun geometry");
  }

  const sunTextureKeys = ["sun", "glow_sun", "glow_sun_intense", "glow_planet_intense"];
  const sunScales = [1.0, 1.25, 1.5, 1.8];

  sunTextureKeys.forEach((textureKey, index) => {
    const texture = textures.get(textureKey);
    if (!texture) {
      throw new Error(`Missing required sun texture: ${textureKey}`);
    }

    const material = new MeshPhongMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 5.0,
      shininess: 150,
      transparent: true,
      opacity: 0.95 - index * 0.2,
      depthWrite: false,
      map: texture,
    });

    const sunMesh = new Mesh(sunGeometry, material);
    sunMesh.position.set(0, 0, 0);
    sunMesh.scale.setScalar(sunScales[index]);
    sunMesh.userData = {isSun: true, sunLayer: index, assignedTexture: textureKey};
    scene.add(sunMesh);
    meshes.push(sunMesh);
  });
};

const addPlanetSystem = (
  planetConfig: PlanetConfig,
  planetsGroup: Group,
  geometries: Map<string, SphereGeometry | RingGeometry>,
  materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>,
  textures: Map<string, Texture>,
  meshes: Mesh[],
): void => {
  const planetGroup = new Group();
  planetGroup.userData = {
    config: planetConfig,
    orbitAngle: Math.random() * Math.PI * 2,
  };
  planetGroup.position.set(planetConfig.orbitRadius, 0, 0);

  const planetGeometry = geometries.get(getPlanetGeometryKey(planetConfig));
  if (!planetGeometry) {
    throw new Error(`Missing geometry for planet ${planetConfig.id}`);
  }

  const planetMaterial = materials.get(getPlanetMaterialKey(planetConfig));
  if (!planetMaterial) {
    throw new Error(`Missing material for planet ${planetConfig.id}`);
  }

  const planet = new Mesh(planetGeometry, planetMaterial);
  planet.position.set(0, 0, 0);
  planet.userData = {
    isPlanet: true,
    config: planetConfig,
    isFromGLB: false,
    assignedTexture: planetConfig.textureKey,
  };
  planetGroup.add(planet);
  meshes.push(planet);

  planetConfig.moons?.forEach((_moon, moonIndex) => {
    const moonGeometry = geometries.get(getMoonGeometryKey(planetConfig, moonIndex));
    if (!moonGeometry) {
      throw new Error(`Missing geometry for moon ${planetConfig.id}_${moonIndex}`);
    }

    const moonMaterial = materials.get(getMoonMaterialKey(planetConfig, moonIndex));
    if (!moonMaterial) {
      throw new Error(`Missing material for moon ${planetConfig.id}_${moonIndex}`);
    }

    const moon = new Mesh(moonGeometry, moonMaterial);
    const moonConfig = planetConfig.moons?.[moonIndex];
    if (!moonConfig) {
      throw new Error(`Missing moon config for planet ${planetConfig.id} at index ${moonIndex}`);
    }

    moon.position.set(
      Math.cos(moonIndex * Math.PI) * moonConfig.orbitRadius,
      0,
      Math.sin(moonIndex * Math.PI) * moonConfig.orbitRadius,
    );
    moon.userData = {
      isMoon: true,
      moonConfig,
      moonIndex,
      orbitAngle: moonIndex * Math.PI,
      isFromGLB: false,
      parentPlanet: planetConfig.id,
      hasValidatedPlanet: true,
      assignedTexture: moonConfig.textureKey,
    };
    planetGroup.add(moon);
    meshes.push(moon);
  });

  if (planetConfig.rings) {
    const ringGeometry = geometries.get(getRingGeometryKey(planetConfig));
    if (!ringGeometry) {
      throw new Error(`Missing geometry for ring ${planetConfig.id}`);
    }

    const ringMaterial = materials.get(getRingMaterialKey(planetConfig));
    if (!ringMaterial) {
      throw new Error(`Missing material for ring ${planetConfig.id}`);
    }

    const ring = new Mesh(ringGeometry, ringMaterial);
    ring.position.set(0, 0, 0);
    ring.rotation.x = Math.PI / 2;
    ring.userData = {
      isRing: true,
      parentPlanet: planetConfig.id,
      hasValidatedPlanet: true,
      assignedTexture: planetConfig.rings.textureKey,
    };
    planetGroup.add(ring);
    meshes.push(ring);
  }

  planetsGroup.add(planetGroup);
};

export const assembleSolarSystemScene = (
  geometries: Map<string, SphereGeometry | RingGeometry>,
  materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>,
  textures: Map<string, Texture>,
  onProgress?: (loaded: number, total: number, current: string) => void,
): PreloadedSolarSystem => {
  try {
    const {scene, camera} = createSceneSetup();
    const meshes: Mesh[] = [];
    const lights: (DirectionalLight | AmbientLight | PointLight)[] = [];

    onProgress?.(1, 1 + SOLAR_SYSTEM_CONFIG.length, "Scene setup");
    addEnhancedLights(scene, lights);
    onProgress?.(2, 1 + SOLAR_SYSTEM_CONFIG.length, "Lighting");
    addSunMeshes(scene, geometries, textures, meshes);
    onProgress?.(3, 1 + SOLAR_SYSTEM_CONFIG.length, "Sun");

    const planetsGroup = new Group();
    scene.add(planetsGroup);

    SOLAR_SYSTEM_CONFIG.forEach((planetConfig, index) => {
      addPlanetSystem(planetConfig, planetsGroup, geometries, materials, textures, meshes);
      onProgress?.(4 + index, 4 + SOLAR_SYSTEM_CONFIG.length, planetConfig.id);
    });

    return {
      scene,
      camera,
      planetsGroup,
      meshes,
      lights,
      geometries,
      materials,
      textures,
    };
  } catch (error) {
    logger.error("Solar scene assembly failed:", error);
    throw error;
  }
};
