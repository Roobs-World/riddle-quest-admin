/**
 * @fileoverview
 * Preloader and factory for the 3D solar system background scene.
 *
 * This service is responsible for:
 * - Preloading and validating all planet, moon, ring, and glow textures
 *   using Expo's `Asset` system.
 * - Constructing high-quality Three.js geometries, materials, lights,
 *   and meshes representing the Riddle Quest solar system.
 * - Exposing a cached, preconstructed scene graph that can be reused by
 *   React Three Fiber components without redoing expensive setup work.
 */
import {
  Scene,
  PerspectiveCamera,
  DirectionalLight,
  AmbientLight,
  PointLight,
  Group,
  SphereGeometry,
  MeshPhongMaterial,
  Mesh,
  RingGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Texture,
} from "three";
import type {MeshBasicMaterialParameters, MeshPhongMaterialParameters} from "three";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {PlanetConfig, SOLAR_SYSTEM_CONFIG, SOLAR_TEXTURE_MAPPING} from "./solar/solarSystemConfig";
import {loadTextureFromAsset} from "./solar/textureLoader";
import {createTextureCache, disposeAndClearTextureCache} from "./solar/textureCache";
import {addEnhancedLights, addSunMeshes, createSceneSetup} from "./solar/sceneFactory";

/**
 * Solar System Preloader Service - v2.4.0 EXPO ASSET SYSTEM
 *
 * Loads textures using proper Expo Asset loading and creates procedural geometries.
 * Uses Asset.fromModule() and downloadAsync() for reliable texture loading in Expo.
 * All objects are generated procedurally with high-quality materials.
 *
 * This ensures reliable texture loading and guaranteed visibility with realistic textures.
 */

export interface TexturePreloadProgress {
  loaded: number;
  total: number;
  currentTexture: string;
  percentage: number;
}

export interface SolarSystemPreloadProgress {
  phase: "textures" | "geometries" | "materials" | "scene" | "complete";
  loaded: number;
  total: number;
  currentItem: string;
  percentage: number;
  textureProgress?: TexturePreloadProgress;
}

export interface PreloadedSolarSystem {
  scene: Scene;
  camera: PerspectiveCamera;
  planetsGroup: Group;
  meshes: Mesh[];
  lights: (DirectionalLight | AmbientLight | PointLight)[];
  geometries: Map<string, SphereGeometry | RingGeometry>;
  materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>;
  textures: Map<string, Texture | null>;
}

export class SolarSystemPreloader {
  private static preloadedSystem: PreloadedSolarSystem | null = null;
  private static isPreloading = false;
  private static isPreloaded = false;
  private static textureCache = createTextureCache();
  private static readonly texturePreloadConcurrency = 4;

  private static readonly textureMapping = SOLAR_TEXTURE_MAPPING;
  private static readonly solarSystemConfig: PlanetConfig[] = SOLAR_SYSTEM_CONFIG;

  /**
   * Preload all solar system textures - WITH FALLBACKS for system stability
   */
  private static async preloadTextures(
    onProgress?: (progress: TexturePreloadProgress) => void,
  ): Promise<Map<string, Texture | null>> {
    if (this.textureCache.size > 0) {
      logger.debug("SolarSystemPreloader: Textures already preloaded, returning cache");
      return this.textureCache;
    }

    logger.debug("SolarSystemPreloader: Loading textures with fallback support...");

    const pendingTextures = [...this.textureMapping];
    const total = this.textureMapping.length;
    let loaded = 0;
    let successfullyLoaded = 0;

    const loadNextTexture = async (): Promise<void> => {
      while (pendingTextures.length > 0) {
        const nextTexture = pendingTextures.shift();
        if (!nextTexture) {
          return;
        }

        const {key, path} = nextTexture;
        try {
          const texturePromise = loadTextureFromAsset(path, key);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Texture ${key} timeout after 3 seconds`)), 3000);
          });

          const texture = await Promise.race([texturePromise, timeoutPromise]);
          this.textureCache.set(key, texture ?? null);

          if (texture) {
            successfullyLoaded++;
          }
        } catch (error) {
          logger.warn(`Texture load failed for ${key}, using fallback color`, error);
          this.textureCache.set(key, null);
        } finally {
          loaded++;
          const percentage = Math.round((loaded / total) * 100);
          onProgress?.({
            loaded,
            total,
            currentTexture: key,
            percentage,
          });
        }
      }
    };

    const workers = Array.from({length: Math.min(this.texturePreloadConcurrency, total)}, () => loadNextTexture());
    await Promise.all(workers);

    logger.debug(
      `SolarSystemPreloader: Texture loading completed - ${successfullyLoaded}/${total} loaded successfully, ${
        total - successfullyLoaded
      } will use fallback colors`,
    );
    return this.textureCache;
  }

  /**
   * Preload solar system with textures
   */
  static async preloadSolarSystem(
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): Promise<PreloadedSolarSystem> {
    if (this.isPreloaded && this.preloadedSystem) {
      logger.debug("SolarSystemPreloader: System already preloaded, returning cached version");
      return this.preloadedSystem;
    }

    if (this.isPreloading) {
      logger.debug("SolarSystemPreloader: System is currently preloading, waiting...");
      // Add timeout to prevent infinite waiting
      let waitTime = 0;
      const maxWaitTime = 10000; // 10 seconds max wait
      while (this.isPreloading && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitTime += 100;
      }
      if (waitTime >= maxWaitTime) {
        logger.warn("SolarSystemPreloader: Wait timeout, creating new instance");
        this.isPreloading = false; // Reset the flag
      } else if (this.preloadedSystem) {
        return this.preloadedSystem;
      }
    }

    this.isPreloading = true;

    try {
      logger.debug("SolarSystemPreloader: Starting solar system preloading...");
      console.time("SolarSystemPreloader: Total preload time");

      // Phase 1: Preload textures (30% of progress) - STRICT LOADING, NO FALLBACKS
      logger.debug("SolarSystemPreloader: Phase 1 - Preloading textures...");

      const textures = await this.preloadTextures((textureProgress) => {
        if (onProgress) {
          onProgress({
            phase: "textures",
            loaded: textureProgress.loaded,
            total: textureProgress.total,
            currentItem: textureProgress.currentTexture,
            percentage: Math.round(textureProgress.percentage * 0.3),
            textureProgress,
          });
        }
      });

      logger.debug("SolarSystemPreloader: ✅ Texture loading completed with fallback support");

      // Phase 2: Create geometries (15% of progress)
      logger.debug("SolarSystemPreloader: Phase 2 - Creating geometries...");
      const geometries = await this.createGeometries((loaded, total, current) => {
        if (onProgress) {
          onProgress({
            phase: "geometries",
            loaded,
            total,
            currentItem: current,
            percentage: 30 + Math.round((loaded / total) * 15),
          });
        }
      });

      // Phase 3: Create materials (15% of progress)
      logger.debug("SolarSystemPreloader: Phase 3 - Creating materials...");
      const materials = await this.createMaterials(textures, (loaded, total, current) => {
        if (onProgress) {
          onProgress({
            phase: "materials",
            loaded,
            total,
            currentItem: current,
            percentage: 45 + Math.round((loaded / total) * 15),
          });
        }
      });

      // Phase 4: Create scene (40% of progress)
      logger.debug("SolarSystemPreloader: Phase 4 - Creating scene...");
      this.preloadedSystem = await this.createCompleteScene(
        geometries,
        materials,
        textures,
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "scene",
              loaded,
              total,
              currentItem: current,
              percentage: 60 + Math.round((loaded / total) * 40),
            });
          }
        },
      );

      console.timeEnd("SolarSystemPreloader: Total preload time");
      this.isPreloaded = true;
      this.isPreloading = false;

      if (onProgress) {
        onProgress({
          phase: "complete",
          loaded: 100,
          total: 100,
          currentItem: "Solar system ready!",
          percentage: 100,
        });
      }

      logger.debug("🌌 SolarSystemPreloader: PRELOADING COMPLETE");
      logger.debug(`✅ Solar system ready with ${this.preloadedSystem.meshes.length} meshes`);

      return this.preloadedSystem;
    } catch (error) {
      logger.error("SolarSystemPreloader: Critical error during preloading:", error);
      captureException(error);
      this.isPreloading = false;

      // Re-throw the error as the system should still work with fallback colors
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Solar system preloading failed: ${errorMessage}`);
    }
  }

  /**
   * Create enhanced geometries with high polygon counts for GLB-like quality
   */
  private static async createGeometries(
    onProgress?: (loaded: number, total: number, current: string) => void,
  ): Promise<Map<string, SphereGeometry | RingGeometry>> {
    const geometries = new Map<string, SphereGeometry | RingGeometry>();

    const geometrySpecs: Array<{
      key: string;
      create: () => SphereGeometry | RingGeometry;
    }> = [
      // High-quality sun geometry for beautiful appearance
      {key: "sun", create: () => new SphereGeometry(20.0, 48, 48)},
    ];

    // Use high-quality spheres for beautiful appearance
    this.solarSystemConfig.forEach((planet) => {
      // High-quality geometry for smooth, detailed planets
      const segments = 32; // High polygon count for smooth appearance

      geometrySpecs.push({
        key: `planet_${planet.id}`,
        create: () => new SphereGeometry(planet.radius, segments, segments),
      });

      // Add high-quality moon geometries
      planet.moons?.forEach((moonConfig, i) => {
        geometrySpecs.push({
          key: `moon_${planet.id}_${i}`,
          create: () => new SphereGeometry(moonConfig.radius, 24, 24), // High-quality moons
        });
      });

      // Add high-quality ring geometries
      if (planet.rings) {
        geometrySpecs.push({
          key: `ring_${planet.id}`,
          create: () =>
            new RingGeometry(
              planet.rings!.innerRadius,
              planet.rings!.outerRadius,
              64, // High segment count for smooth rings
            ),
        });
      }
    });

    // Create geometries with progress tracking
    for (let i = 0; i < geometrySpecs.length; i++) {
      const spec = geometrySpecs[i];
      geometries.set(spec.key, spec.create());
      onProgress?.(i + 1, geometrySpecs.length, spec.key);

      // Small delay to prevent blocking
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    return geometries;
  }

  /**
   * Create enhanced materials using textures with proper lighting response
   */
  private static async createMaterials(
    textures: Map<string, Texture | null>,
    onProgress?: (loaded: number, total: number, current: string) => void,
  ): Promise<Map<string, MeshPhongMaterial | MeshBasicMaterial>> {
    const materials = new Map<string, MeshPhongMaterial | MeshBasicMaterial>();

    const materialSpecs: Array<{
      key: string;
      create: () => MeshPhongMaterial | MeshBasicMaterial;
    }> = [
      // Sun: MeshBasicMaterial with glow texture if available
      {
        key: "sun",
        create: () => {
          const sunTexture = textures.get("sun") ?? textures.get("glow_sun");
          const sunMaterialParameters: MeshBasicMaterialParameters = {
            color: 0xffff00,
            transparent: false,
          };

          if (sunTexture) {
            sunMaterialParameters.map = sunTexture;
          }

          return new MeshBasicMaterial(sunMaterialParameters);
        },
      },
    ];

    // Planets - WITH FALLBACK COLORS for stability
    this.solarSystemConfig.forEach((planet) => {
      materialSpecs.push({
        key: `planet_${planet.id}`,
        create: () => {
          // Find the texture key for this planet (id already has the "planet_" prefix)
          const planetTextureKey = planet.id;
          const planetTexture = textures.get(planetTextureKey);

          // Fallback colors for each planet
          const fallbackColors = {
            planet_a: 0x4488ff, // Venus - Blue
            planet_d: 0xff6644, // Mars - Red-orange
            planet_v: 0xffaa44, // Jupiter - Gold
            planet_k: 0x88ff44, // Saturn - Green
          };

          if (planetTexture) {
            logger.debug(`🪐 Planet ${planet.id} using texture`);
            return new MeshPhongMaterial({
              map: planetTexture,
              color: 0xffffff, // White to show texture properly
              shininess: 30,
              specular: 0x111111,
            });
          } else {
            const fallbackColor = fallbackColors[planet.id as keyof typeof fallbackColors] || 0x888888;
            logger.debug(`🪐 Planet ${planet.id} using fallback color: ${fallbackColor.toString(16)}`);
            return new MeshPhongMaterial({
              color: fallbackColor,
              shininess: 30,
              specular: 0x111111,
            });
          }
        },
      });

      // Moons - WITH FALLBACK COLORS for stability
      planet.moons?.forEach((_moon, i) => {
        // Determine moon texture key
        let moonTextureKey = "";
        if (planet.id === "planet_a") moonTextureKey = "moon_a_h";
        else if (planet.id === "planet_d") moonTextureKey = i === 0 ? "moon_d_f" : "moon_d_g";
        else if (planet.id === "planet_k") moonTextureKey = i === 0 ? "moon_k_c" : "moon_k_d";

        const moonTexture = textures.get(moonTextureKey);
        materialSpecs.push({
          key: `moon_${planet.id}_${i}`,
          create: () => {
            if (moonTexture) {
              logger.debug(`🌙 Moon ${planet.id}_${i} using texture`);
              return new MeshPhongMaterial({
                map: moonTexture,
                color: 0xffffff, // White to show texture properly
                shininess: 10,
                specular: 0x080808,
              });
            } else {
              logger.debug(`🌙 Moon ${planet.id}_${i} using fallback color: gray`);
              return new MeshPhongMaterial({
                color: 0xbbbbbb, // Gray fallback for moons
                shininess: 10,
                specular: 0x080808,
              });
            }
          },
        });
      });

      // Rings - WITH FALLBACK COLORS for stability
      if (planet.rings) {
        // Determine ring texture key
        let ringTextureKey = "";
        if (planet.id === "planet_v") ringTextureKey = "ring_planet_v";
        else if (planet.id === "planet_k") ringTextureKey = "ring_planet_k";
        const ringTexture = textures.get(ringTextureKey);
        materialSpecs.push({
          key: `ring_mat_${planet.id}`,
          create: () => {
            // Fallback colors for rings
            const fallbackRingColors = {
              planet_v: 0x6666ff, // Jupiter rings - Blue
              planet_k: 0xffcc66, // Saturn rings - Gold
            };

            if (ringTexture) {
              logger.debug(`💍 Ring ${planet.id} using texture`);
              return new MeshPhongMaterial({
                map: ringTexture,
                color: 0xffffff, // White to show texture properly
                shininess: 5,
                specular: 0x050505,
                transparent: true,
                opacity: 0.8,
                alphaTest: 0.1,
                side: DoubleSide,
              });
            } else {
              const fallbackColor = fallbackRingColors[planet.id as keyof typeof fallbackRingColors] || 0x999999;
              logger.debug(`💍 Ring ${planet.id} using fallback color: ${fallbackColor.toString(16)}`);
              return new MeshPhongMaterial({
                color: fallbackColor,
                shininess: 5,
                specular: 0x050505,
                transparent: true,
                opacity: 0.6,
                side: DoubleSide,
              });
            }
          },
        });
      }
    });

    // Create materials with progress tracking
    for (let i = 0; i < materialSpecs.length; i++) {
      const spec = materialSpecs[i];
      materials.set(spec.key, spec.create());
      onProgress?.(i + 1, materialSpecs.length, spec.key);
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }
    return materials;
  }

  /**
   * Create the complete 3D scene with all objects
   */
  private static async createCompleteScene(
    geometries: Map<string, SphereGeometry | RingGeometry>,
    materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>,
    textures: Map<string, Texture | null>,
    onProgress?: (loaded: number, total: number, current: string) => void,
  ): Promise<PreloadedSolarSystem> {
    const {scene, camera} = createSceneSetup();

    const meshes: Mesh[] = [];
    const lights: (DirectionalLight | AmbientLight | PointLight)[] = [];

    onProgress?.(1, 10, "Scene setup");
    addEnhancedLights(scene, lights);

    onProgress?.(2, 10, "Enhanced lighting setup");
    addSunMeshes(scene, geometries, textures, meshes);
    onProgress?.(3, 10, "Sun created");

    // Add planets group
    const planetsGroup = new Group();
    scene.add(planetsGroup);

    for (const planetConfig of this.solarSystemConfig) {
      const planetGroup = new Group();
      planetGroup.userData = {
        config: planetConfig,
        orbitAngle: Math.random() * Math.PI * 2,
      };

      // Position the planet group at its initial orbital position
      planetGroup.position.set(planetConfig.orbitRadius, 0, 0);

      let planet: Mesh | null = null;

      // Use the correct planet-specific texture
      const planetTextureKey = `planet_${planetConfig.id}`;

      try {
        // Create planets with REQUIRED textures and geometries - NO FALLBACKS
        const planetGeometry = geometries.get(`planet_${planetConfig.id}`);
        const planetMaterial = materials.get(`planet_${planetConfig.id}`);

        if (!planetGeometry) {
          throw new Error(`CRITICAL: Missing geometry for planet ${planetConfig.id} - NO FALLBACKS ALLOWED`);
        }
        if (!planetMaterial) {
          throw new Error(`CRITICAL: Missing material for planet ${planetConfig.id} - NO FALLBACKS ALLOWED`);
        }

        planet = new Mesh(planetGeometry, planetMaterial);
        planet.position.set(0, 0, 0); // Planet at center of its group - group will be positioned at orbit
        planet.userData = {
          isPlanet: true,
          config: planetConfig,
          isFromGLB: false,
          assignedTexture: planetTextureKey,
        };
        planetGroup.add(planet);
        if (planet instanceof Mesh) meshes.push(planet);
        logger.debug(`🪐 Planet ${planetConfig.id} added with REQUIRED texture ${planetTextureKey}.`);
      } catch (err) {
        logger.error(`❌ Exception while creating planet ${planetConfig.id}:`, err);
        captureException(err);
      }

      // Add moons to this planet - ONLY if the planet was successfully created AND added to scene
      if (planetConfig.moons) {
        if (!planet) {
          logger.warn(
            `⚠️ Skipping ${planetConfig.moons.length} moon(s) for ${planetConfig.id} because planet failed to create - no orphaned moons allowed.`,
          );
        } else {
          // Validate planet is actually in the scene before adding moons
          const isPlanetInGroup = planetGroup.children.includes(planet);

          if (!isPlanetInGroup) {
            logger.warn(
              `⚠️ Skipping ${planetConfig.moons.length} moon(s) for ${planetConfig.id} because planet is not in the scene group - no orphaned moons allowed.`,
            );
          } else {
            for (let i = 0; i < planetConfig.moons.length; i++) {
              const moonConfig = planetConfig.moons[i];
              let moon: Mesh | null = null;
              try {
                const moonGeometry = geometries.get(`moon_${planetConfig.id}_${i}`);
                const moonMaterial = materials.get(`moon_${planetConfig.id}_${i}`);

                if (!moonGeometry) {
                  logger.error(`❌ Missing geometry for moon ${planetConfig.id}_${i}, using fallback sphere.`);
                }
                if (!moonMaterial) {
                  logger.error(`❌ Missing material for moon ${planetConfig.id}_${i}, using fallback material.`);
                }

                moon = new Mesh(
                  moonGeometry || new SphereGeometry(moonConfig.radius, 16, 16),
                  moonMaterial ||
                    new MeshPhongMaterial({
                      color: 0xbbbbbb,
                      shininess: 10,
                      specular: 0x080808,
                    }),
                );
                moon.position.set(
                  Math.cos(i * Math.PI) * moonConfig.orbitRadius,
                  0,
                  Math.sin(i * Math.PI) * moonConfig.orbitRadius,
                );
                moon.userData = {
                  isMoon: true,
                  moonConfig,
                  moonIndex: i,
                  orbitAngle: i * Math.PI,
                  isFromGLB: false,
                  parentPlanet: planetConfig.id,
                  hasValidatedPlanet: true,
                };
                planetGroup.add(moon);
                if (moon instanceof Mesh) meshes.push(moon);
                logger.debug(`🌙 Moon ${planetConfig.id}_${i} added with correct texture (planet validated).`);
              } catch (err) {
                logger.error(`❌ Exception while creating moon ${planetConfig.id}_${i}:`, err);
                captureException(err);
              }
            }
          }
        }
      }

      // Add rings to this planet - ONLY if the planet was successfully created AND added to scene
      if (planetConfig.rings) {
        if (!planet) {
          logger.warn(
            `⚠️ Skipping ring for ${planetConfig.id} because planet failed to create - no standalone rings allowed.`,
          );
        } else {
          let ringTextureKey = "";
          if (planetConfig.id === "planet_v") ringTextureKey = "ring_planet_v";
          else if (planetConfig.id === "planet_k") ringTextureKey = "ring_planet_k";
          const ringTexture = textures.get(ringTextureKey);
          const ringGeometry = geometries.get(`ring_${planetConfig.id}`);
          const ringMaterial = materials.get(`ring_mat_${planetConfig.id}`);

          // Validate planet is actually in the scene before adding rings
          const isPlanetInGroup = planetGroup.children.includes(planet);

          if (!isPlanetInGroup) {
            logger.warn(
              `⚠️ Skipping ring for ${planetConfig.id} because planet is not in the scene group - no orphaned rings allowed.`,
            );
          } else if (!ringGeometry) {
            logger.error(`❌ Missing geometry for ring ${planetConfig.id}, skipping ring.`);
          } else if (!ringMaterial) {
            logger.error(`❌ Missing material for ring ${planetConfig.id}, using fallback material.`);
            // Only create ring with validated geometry and confirmed planet presence
            const fallbackRingMaterialParameters: MeshPhongMaterialParameters = {
              color: ringTexture ? 0xffffff : 0x8888ff,
              shininess: 5,
              specular: 0x050505,
              transparent: true,
              opacity: 0.8,
              alphaTest: 0.1,
              side: DoubleSide,
            };

            if (ringTexture) {
              fallbackRingMaterialParameters.map = ringTexture;
            }

            const fallbackRingMaterial = new MeshPhongMaterial(fallbackRingMaterialParameters);
            const ring = new Mesh(ringGeometry, fallbackRingMaterial);
            ring.position.set(0, 0, 0);
            ring.rotation.x = Math.PI / 2;
            ring.userData = {
              isRing: true,
              parentPlanet: planetConfig.id,
              hasValidatedPlanet: true,
            };
            planetGroup.add(ring);
            if (ring instanceof Mesh) meshes.push(ring);
            logger.debug(`💍 Ring for planet ${planetConfig.id} added with fallback material (planet validated).`);
          } else {
            // Only create ring with validated geometry and confirmed planet presence
            const ring = new Mesh(ringGeometry, ringMaterial);
            ring.position.set(0, 0, 0);
            ring.rotation.x = Math.PI / 2;
            ring.userData = {
              isRing: true,
              parentPlanet: planetConfig.id,
              hasValidatedPlanet: true,
            };
            planetGroup.add(ring);
            if (ring instanceof Mesh) meshes.push(ring);
            logger.debug(`💍 Ring for planet ${planetConfig.id} added with correct material (planet validated).`);
          }
        }
      }
      planetsGroup.add(planetGroup);
    }
    logger.debug(`🪐 Planets group has ${planetsGroup.children.length} children.`);
    setTimeout(() => {
      logger.debug(
        "🔎 Scene children:",
        scene.children.map((c) => c.userData),
      );
    }, 1000);

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
  }

  /**
   * Get preloaded solar system
   */
  static getPreloadedSystem(): PreloadedSolarSystem | null {
    return this.preloadedSystem;
  }

  /**
   * Check if solar system is preloaded
   */
  static isSystemPreloaded(): boolean {
    return this.isPreloaded;
  }

  /**
   * Clone the preloaded scene for use (creates a fresh instance)
   */
  static clonePreloadedScene(): PreloadedSolarSystem | null {
    if (!this.preloadedSystem) {
      return null;
    }

    // For now, return the same instance since Three.js objects can be shared
    // In the future, if we need multiple instances, we could implement cloning
    return this.preloadedSystem;
  }

  /**
   * Clear preloaded system and free memory
   */
  static clearCache(): void {
    logger.debug("SolarSystemPreloader: Clearing all caches...");

    // Dispose textures before clearing references.
    disposeAndClearTextureCache(this.textureCache);
    this.preloadedSystem = null;
    this.isPreloaded = false;
    this.isPreloading = false;

    logger.debug("SolarSystemPreloader: All caches cleared successfully");
  }
}
