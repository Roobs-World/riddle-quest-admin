/**
 * @fileoverview
 * Preloader and factory for the 3D solar system background scene.
 *
 * This service is responsible for:
 * - Preloading and validating all planet, moon, ring, and glow textures
 *   using Expo's `Asset` system.
 * - Constructing high-quality Three.js geometries, materials, lights,
 *   and meshes representing the Qwordly solar system.
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
  TextureLoader,
} from "three";
import { Asset } from "expo-asset";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Solar System Preloader Service - v2.4.0 EXPO ASSET SYSTEM
 *
 * Loads textures using proper Expo Asset loading and creates procedural geometries.
 * Uses Asset.fromModule() and downloadAsync() for reliable texture loading in Expo.
 * All objects are generated procedurally with high-quality materials.
 *
 * This ensures reliable texture loading and guaranteed visibility with realistic textures.
 */

// Import textures using relative path to assets
// REMOVED texPlanetR import due to loading issues
import texPlanetV from "../../assets/3d/tex_planet_v.png";
import texPlanetA from "../../assets/3d/tex_planet_a.png";
import texPlanetD from "../../assets/3d/tex_planet_d.png";
import texPlanetK from "../../assets/3d/tex_planet_k.png";

import texMoonH from "../../assets/3d/tex_moon_h.png";
import texMoonF from "../../assets/3d/tex_moon_f.png";
import texMoonG from "../../assets/3d/tex_moon_g.png";
import texMoonC from "../../assets/3d/tex_moon_c.png";
import texMoonD from "../../assets/3d/tex_moon_d.png";

import texRingA from "../../assets/3d/tex_ring_a.png";
import texRingB from "../../assets/3d/tex_ring_b.png";

// Gradient textures for glowing effects
import texGradientCircle from "../../assets/3d/tex_gradient_circle.png";
import texGradientCircleSun from "../../assets/3d/tex_gradient_circle_sun.png";
import texGradientCircleI from "../../assets/3d/tex_gradient_circle_i.png";
import texGradientCircleSunI from "../../assets/3d/tex_gradient_circle_sun_i.png";

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

export interface MoonConfig {
  texture: string;
  orbitRadius: number;
  orbitSpeed: number;
  radius: number;
}

export interface RingConfig {
  texture: string;
  innerRadius: number;
  outerRadius: number;
}

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
  private static textureCache = new Map<string, Texture | null>();

  // Define texture mapping for solar system - matching notes.txt structure
  private static readonly textureMapping = [
    // Planet textures (matching notes.txt) - REMOVED planet_r due to loading issues
    { key: "planet_a", path: texPlanetA },
    { key: "planet_d", path: texPlanetD },
    { key: "planet_v", path: texPlanetV },
    { key: "planet_k", path: texPlanetK },
    // Ring textures (using consistent naming)
    { key: "ring_planet_v", path: texRingA },
    { key: "ring_planet_k", path: texRingB },
    // Moon textures (matching notes.txt assignments)
    { key: "moon_a_h", path: texMoonH }, // moon for planet_a
    { key: "moon_d_f", path: texMoonF }, // first moon for planet_d
    { key: "moon_d_g", path: texMoonG }, // second moon for planet_d
    { key: "moon_k_c", path: texMoonC }, // first moon for planet_k
    { key: "moon_k_d", path: texMoonD }, // second moon for planet_k
    // Gradient textures for glowing effects
    { key: "glow_planet", path: texGradientCircle },
    { key: "glow_sun", path: texGradientCircleSun },
    { key: "glow_planet_intense", path: texGradientCircleI },
    { key: "glow_sun_intense", path: texGradientCircleSunI },
  ];

  // Solar system configuration - ULTRA FAST MOVING planets for extreme visibility
  // Safe orbital distances from sun (radius 15) with EXTREME speed increases
  private static readonly solarSystemConfig: PlanetConfig[] = [
    // REMOVED Mercury (planet_r) due to texture loading issues
    // Venus - first planet with moon (blue) - MUCH CLOSER TO SUN
    {
      id: "planet_a",
      texture: texPlanetA,
      orbitRadius: 35, // CLOSE to sun (was 75) - 15 unit clearance from sun surface
      orbitSpeed: 0.7, // ULTRA FAST - 2.8x faster than before (was 0.25)
      rotationSpeed: 0.015,
      radius: 5.0, // Slightly larger than Mercury
      materialType: "phong",
      moons: [
        {
          texture: texMoonH,
          orbitRadius: 8, // Closer moon orbit (was 10)
          orbitSpeed: 2.0, // EXTREMELY fast moon - 2.5x faster than before (was 0.8)
          radius: 2.0, // Small moon
        },
      ],
    },
    // Mars - red planet with 2 moons (orange) - MUCH CLOSER TO SUN
    {
      id: "planet_d",
      texture: texPlanetD,
      orbitRadius: 45, // CLOSE to sun (was 105) - compact spacing
      orbitSpeed: 0.6, // ULTRA FAST - 3x faster than before (was 0.2)
      rotationSpeed: 0.012,
      radius: 4.5, // Small rocky planet
      materialType: "phong",
      moons: [
        {
          texture: texMoonF,
          orbitRadius: 10, // Closer first moon (was 12)
          orbitSpeed: 1.5, // EXTREMELY fast moon - 2.5x faster than before (was 0.6)
          radius: 1.8, // Small moon
        },
        {
          texture: texMoonG,
          orbitRadius: 13, // Closer second moon (was 16)
          orbitSpeed: 1.2, // EXTREMELY fast moon - 2.4x faster than before (was 0.5)
          radius: 2.0, // Slightly larger moon
        },
      ],
    },
    // Jupiter - gas giant with rings (blue) - MUCH CLOSER TO SUN
    {
      id: "planet_v",
      texture: texPlanetV,
      orbitRadius: 60, // CLOSE to sun (was 140) - compact gas giant
      orbitSpeed: 0.45, // ULTRA FAST - 3x faster than before (was 0.15)
      rotationSpeed: 0.008,
      radius: 8.0, // Large gas giant
      materialType: "phong",
      rings: {
        texture: texRingA,
        innerRadius: 10.0, // Ring system
        outerRadius: 14.0,
      },
    },
    // Saturn - outermost with rings and moons (green) - MUCH CLOSER TO SUN
    {
      id: "planet_k",
      texture: texPlanetK,
      orbitRadius: 75, // CLOSE to sun (was 185) - compact outer planet
      orbitSpeed: 0.3, // ULTRA FAST - 3x faster than before (was 0.1)
      rotationSpeed: 0.006,
      radius: 7.5, // Large but smaller than Jupiter
      materialType: "phong",
      moons: [
        {
          texture: texMoonC,
          orbitRadius: 15, // Closer first moon (was 18)
          orbitSpeed: 1.0, // EXTREMELY fast moon - 2.5x faster than before (was 0.4)
          radius: 2.5, // Larger moon
        },
        {
          texture: texMoonD,
          orbitRadius: 20, // Closer outer moon (was 25)
          orbitSpeed: 0.9, // EXTREMELY fast moon - 2.57x faster than before (was 0.35)
          radius: 2.2, // Slightly smaller
        },
      ],
      rings: {
        texture: texRingB,
        innerRadius: 12.0, // Prominent ring system
        outerRadius: 18.0,
      },
    },
  ];

  /**
   * Preload and verify all assets are downloaded before texture loading
   */
  private static async preloadAndVerifyAssets(): Promise<void> {
    logger.debug("🔍 Preloading and verifying all solar system assets...");

    const assetPromises = this.textureMapping.map(async ({ key, path }) => {
      try {
        logger.debug(`📦 Preloading asset: ${key}`);

        // Create asset and ensure it's downloaded
        const asset = Asset.fromModule(path);

        // Force download with longer timeout
        await Promise.race([
          asset.downloadAsync(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Asset download timeout: ${key}`)),
              30000
            )
          ),
        ]);

        // Verify the asset is actually downloaded and has a localUri
        if (!asset.downloaded) {
          throw new Error(`Asset ${key} not marked as downloaded`);
        }

        if (!asset.localUri) {
          throw new Error(`Asset ${key} has no localUri after download`);
        }

        logger.debug(`✅ Asset ${key} verified: ${asset.localUri}`);
        return { key, asset };
      } catch (error) {
        logger.error(`❌ Failed to preload asset ${key}:`, error);
        captureException(error);
        throw new Error(`CRITICAL: Asset ${key} failed to preload: ${error}`);
      }
    });

    // Wait for all assets to be preloaded and verified
    const preloadedAssets = await Promise.all(assetPromises);

    logger.debug(
      `✅ All ${preloadedAssets.length} assets preloaded and verified successfully`
    );
  }

  /**
   * Preload all solar system textures - WITH FALLBACKS for system stability
   */
  private static async preloadTextures(
    onProgress?: (progress: TexturePreloadProgress) => void
  ): Promise<Map<string, Texture | null>> {
    if (this.textureCache.size > 0) {
      logger.debug(
        "SolarSystemPreloader: Textures already preloaded, returning cache"
      );
      return this.textureCache;
    }

    logger.debug(
      "SolarSystemPreloader: Loading textures with fallback support..."
    );

    // Debug: Log all texture mappings to diagnose import issues
    logger.debug("📝 Texture mappings to load:");
    this.textureMapping.forEach(({ key, path }, index) => {
      logger.debug(`  ${index + 1}. ${key} -> ${typeof path} (${path})`);
    });

    const textureLoader = new TextureLoader();
    const total = this.textureMapping.length;
    let loaded = 0;
    let successfullyLoaded = 0;

    // Load textures individually with graceful fallbacks
    for (const { key, path } of this.textureMapping) {
      try {
        logger.debug(`🔄 Attempting to load texture: ${key}`);

        // Individual 3-second timeout per texture for faster failure detection
        const texturePromise = this.loadTextureFromAsset(
          textureLoader,
          path,
          key
        );
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Texture ${key} timeout after 3 seconds`)),
            3000
          );
        });

        const texture = await Promise.race([texturePromise, timeoutPromise]);

        if (texture) {
          this.textureCache.set(key, texture);
          successfullyLoaded++;
          logger.debug(`✅ Successfully loaded ${key}`);
        } else {
          this.textureCache.set(key, null);
          logger.warn(
            `⚠️ Texture ${key} loaded as null, will use fallback color`
          );
        }
      } catch (error) {
        logger.warn(
          `⚠️ Failed to load texture ${key}, will use fallback color:`,
          error
        );
        this.textureCache.set(key, null);
      }

      loaded++;
      const percentage = Math.round((loaded / total) * 100);

      if (onProgress) {
        onProgress({
          loaded,
          total,
          currentTexture: key,
          percentage,
        });
      }

      // Small delay to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    logger.debug(
      `SolarSystemPreloader: Texture loading completed - ${successfullyLoaded}/${total} loaded successfully, ${
        total - successfullyLoaded
      } will use fallback colors`
    );
    return this.textureCache;
  }

  /**
   * Load texture from bundled asset using Expo Asset system
   * Assumes assets are already preloaded and verified
   */
  private static async loadTextureFromAsset(
    loader: TextureLoader,
    assetPath: string | number,
    cacheKey: string
  ): Promise<Texture> {
    try {
      logger.debug(
        `SolarSystemPreloader: Loading texture ${cacheKey} from verified asset`
      );

      // ✅ Get the already-downloaded asset
      const imageAsset = Asset.fromModule(assetPath);

      // Ensure asset is downloaded
      if (!imageAsset.downloaded) {
        logger.debug(`⚠️ Asset ${cacheKey} not downloaded, downloading...`);
        await imageAsset.downloadAsync();
      }

      // Prefer localUri (local file) over uri (HTTP URL) for reliability
      const textureUri = imageAsset.localUri || imageAsset.uri;

      if (!textureUri) {
        throw new Error(
          `Asset ${cacheKey} has no localUri or uri after download`
        );
      }

      logger.debug(`  Using asset URI for Three.js: ${textureUri}`);

      // ✅ Use TextureLoader with localUri from verified asset
      return new Promise<Texture>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(
            new Error(`Texture loading timeout: ${cacheKey} after 5 seconds`)
          );
        }, 5000); // 5 second timeout per individual texture load (using local files now)

        logger.debug(
          `  Starting TextureLoader.load for ${cacheKey} with verified URI: ${textureUri}`
        );

        loader.load(
          textureUri,
          (texture) => {
            clearTimeout(timeoutId);
            logger.debug(
              `SolarSystemPreloader: ✅ Successfully loaded ${cacheKey} via verified Expo Asset`
            );
            logger.debug(`  Texture details:`, {
              width: texture.image?.width,
              height: texture.image?.height,
              format: texture.format,
              type: texture.type,
            });
            resolve(texture);
          },
          (progress) => {
            logger.debug(`  Loading progress for ${cacheKey}:`, progress);
          },
          (error) => {
            clearTimeout(timeoutId);
            logger.error(`  TextureLoader error for ${cacheKey}:`, error);
            reject(
              new Error(
                `Failed to load ${cacheKey} via verified Expo Asset: ${error}`
              )
            );
          }
        );
      });
    } catch (error) {
      logger.error(`Verified asset loading failed for ${cacheKey}:`, error);
      captureException(error);
      throw new Error(
        `Verified asset loading failed for ${cacheKey}: ${error}`
      );
    }
  }

  /**
   * Preload solar system with textures
   */
  static async preloadSolarSystem(
    onProgress?: (progress: SolarSystemPreloadProgress) => void
  ): Promise<PreloadedSolarSystem> {
    if (this.isPreloaded && this.preloadedSystem) {
      logger.debug(
        "SolarSystemPreloader: System already preloaded, returning cached version"
      );
      return this.preloadedSystem;
    }

    if (this.isPreloading) {
      logger.debug(
        "SolarSystemPreloader: System is currently preloading, waiting..."
      );
      // Add timeout to prevent infinite waiting
      let waitTime = 0;
      const maxWaitTime = 10000; // 10 seconds max wait
      while (this.isPreloading && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitTime += 100;
      }
      if (waitTime >= maxWaitTime) {
        logger.warn(
          "SolarSystemPreloader: Wait timeout, creating new instance"
        );
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

      logger.debug(
        "SolarSystemPreloader: ✅ Texture loading completed with fallback support"
      );

      // Phase 2: Create geometries (15% of progress)
      logger.debug("SolarSystemPreloader: Phase 2 - Creating geometries...");
      const geometries = await this.createGeometries(
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "geometries",
              loaded,
              total,
              currentItem: current,
              percentage: 30 + Math.round((loaded / total) * 15),
            });
          }
        }
      );

      // Phase 3: Create materials (15% of progress)
      logger.debug("SolarSystemPreloader: Phase 3 - Creating materials...");
      const materials = await this.createMaterials(
        textures,
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "materials",
              loaded,
              total,
              currentItem: current,
              percentage: 45 + Math.round((loaded / total) * 15),
            });
          }
        }
      );

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
        }
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
      logger.debug(
        `✅ Solar system ready with ${this.preloadedSystem.meshes.length} meshes`
      );

      return this.preloadedSystem;
    } catch (error) {
      logger.error(
        "SolarSystemPreloader: Critical error during preloading:",
        error
      );
      captureException(error);
      this.isPreloading = false;

      // Re-throw the error as the system should still work with fallback colors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Solar system preloading failed: ${errorMessage}`);
    }
  }

  /**
   * Create enhanced geometries with high polygon counts for GLB-like quality
   */
  private static async createGeometries(
    onProgress?: (loaded: number, total: number, current: string) => void
  ): Promise<Map<string, SphereGeometry | RingGeometry>> {
    const geometries = new Map<string, SphereGeometry | RingGeometry>();

    const geometrySpecs: Array<{
      key: string;
      create: () => SphereGeometry | RingGeometry;
    }> = [
      // High-quality sun geometry for beautiful appearance
      { key: "sun", create: () => new SphereGeometry(20.0, 48, 48) },
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
      planet.moons?.forEach((moon, i) => {
        geometrySpecs.push({
          key: `moon_${planet.id}_${i}`,
          create: () => new SphereGeometry(moon.radius, 24, 24), // High-quality moons
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
              64 // High segment count for smooth rings
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
    onProgress?: (loaded: number, total: number, current: string) => void
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
          const sunTexture = textures.get("glow_sun");
          return new MeshBasicMaterial({
            map: sunTexture || undefined,
            color: 0xffff00,
            transparent: false,
          });
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
            const fallbackColor =
              fallbackColors[planet.id as keyof typeof fallbackColors] ||
              0x888888;
            logger.debug(
              `🪐 Planet ${
                planet.id
              } using fallback color: ${fallbackColor.toString(16)}`
            );
            return new MeshPhongMaterial({
              color: fallbackColor,
              shininess: 30,
              specular: 0x111111,
            });
          }
        },
      });

      // Moons - WITH FALLBACK COLORS for stability
      planet.moons?.forEach((moon, i) => {
        // Determine moon texture key
        let moonTextureKey = "";
        if (planet.id === "planet_a") moonTextureKey = "moon_a_h";
        else if (planet.id === "planet_d")
          moonTextureKey = i === 0 ? "moon_d_f" : "moon_d_g";
        else if (planet.id === "planet_k")
          moonTextureKey = i === 0 ? "moon_k_c" : "moon_k_d";

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
              logger.debug(
                `🌙 Moon ${planet.id}_${i} using fallback color: gray`
              );
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
              const fallbackColor =
                fallbackRingColors[
                  planet.id as keyof typeof fallbackRingColors
                ] || 0x999999;
              logger.debug(
                `💍 Ring ${
                  planet.id
                } using fallback color: ${fallbackColor.toString(16)}`
              );
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
    onProgress?: (loaded: number, total: number, current: string) => void
  ): Promise<PreloadedSolarSystem> {
    // Initialize scene
    const scene = new Scene();
    const camera = new PerspectiveCamera(
      90, // Wider field of view for better solar system visibility
      1, // Aspect ratio (will be updated by component)
      0.1, // Near plane
      800 // Increased far plane for larger view distance
    );

    // Position camera for optimal centered view of the compact solar system
    camera.position.set(90, 60, 90); // Closer position for compact orbital radii (35-75 units)
    camera.lookAt(0, 0, 0); // Look at center where sun is

    logger.debug(
      `📷 Camera positioned at (90, 60, 90) looking at center (0, 0, 0) for optimal compact solar system view`
    );

    const meshes: Mesh[] = [];
    const lights: (DirectionalLight | AmbientLight | PointLight)[] = [];

    onProgress?.(1, 10, "Scene setup");

    // Setup enhanced lighting for better texture visibility
    // 1. Ambient light for overall scene illumination - INCREASED for MeshPhongMaterial
    const ambientLight = new AmbientLight(0x404080, 1.2); // Increased from 0.4 to 1.2
    scene.add(ambientLight);
    lights.push(ambientLight);

    // 2. Main sun light - directional light from sun - INCREASED for MeshPhongMaterial
    const sunLight = new DirectionalLight(0xffffff, 4.0); // Increased from 1.8 to 4.0
    sunLight.position.set(10, 5, 10); // Position away from sun for better illumination
    sunLight.target.position.set(0, 0, 0);
    sunLight.castShadow = false; // Disable shadows for performance
    scene.add(sunLight);
    scene.add(sunLight.target);
    lights.push(sunLight);

    // 3. Sun point light - central illumination from sun position - INCREASED for MeshPhongMaterial
    const sunPointLight = new PointLight(0xffffff, 5.0, 300); // Increased from 2.5 to 5.0
    sunPointLight.position.set(0, 0, 0);
    sunPointLight.castShadow = false; // Disable shadows for performance
    scene.add(sunPointLight);
    lights.push(sunPointLight);

    // 4. Additional rim lighting for planet definition - INCREASED for MeshPhongMaterial
    const rimLight1 = new DirectionalLight(0x8888ff, 0.8); // Increased from 0.3 to 0.8
    rimLight1.position.set(-20, 10, -20);
    rimLight1.target.position.set(0, 0, 0);
    scene.add(rimLight1);
    scene.add(rimLight1.target);
    lights.push(rimLight1);

    const rimLight2 = new DirectionalLight(0xff8888, 0.6); // Increased from 0.2 to 0.6
    rimLight2.position.set(20, -10, 20);
    rimLight2.target.position.set(0, 0, 0);
    scene.add(rimLight2);
    scene.add(rimLight2.target);
    lights.push(rimLight2);

    logger.debug(
      `💡 Enhanced lighting setup for MeshPhongMaterial: Ambient(1.2), Sun Directional(4.0), Sun Point(5.0), Rim Lights(0.8, 0.6)`
    );

    onProgress?.(2, 10, "Enhanced lighting setup");

    // Create sun - use geometry
    const sunGeometry = geometries.get("sun");
    const sunGlowTextures = [
      textures.get("glow_sun"),
      textures.get("glow_sun_intense"),
      textures.get("glow_planet"),
      textures.get("glow_planet_intense"),
    ];
    const sunMeshes: Mesh[] = [];
    try {
      if (sunGeometry) {
        const sunScales = [1.0, 1.1, 1.2, 1.3];
        for (let i = 0; i < sunGlowTextures.length; i++) {
          const sunMaterial = new MeshPhongMaterial({
            map: sunGlowTextures[i] || undefined,
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1.5,
            shininess: 100,
            transparent: true,
            opacity: 0.7 - i * 0.15,
            depthWrite: false,
          });
          const sunMesh = new Mesh(sunGeometry, sunMaterial);
          sunMesh.position.set(0, 0, 0);
          sunMesh.scale.setScalar(sunScales[i]);
          sunMesh.userData = { isSun: true, sunLayer: i };
          scene.add(sunMesh);
          meshes.push(sunMesh);
          sunMeshes.push(sunMesh);
        }
        logger.debug("☀️ Sun (multi-layered glow) added to scene.");
      } else {
        logger.error("❌ Sun geometry missing! Using fallback sphere.");
        const fallbackSun = new Mesh(
          new SphereGeometry(20.0, 16, 16),
          new MeshBasicMaterial({ color: 0xffff00 })
        );
        fallbackSun.position.set(0, 0, 0);
        fallbackSun.userData = { isSun: true, isFallback: true };
        scene.add(fallbackSun);
        meshes.push(fallbackSun);
        sunMeshes.push(fallbackSun);
        logger.debug("☀️ Emergency fallback sun added to scene.");
      }
    } catch (err) {
      logger.error("❌ Exception while creating sun mesh:", err);
      captureException(err);
      const fallbackSun = new Mesh(
        new SphereGeometry(20.0, 16, 16),
        new MeshBasicMaterial({ color: 0xffff00 })
      );
      fallbackSun.position.set(0, 0, 0);
      fallbackSun.userData = { isSun: true, isFallback: true };
      scene.add(fallbackSun);
      meshes.push(fallbackSun);
      sunMeshes.push(fallbackSun);
      logger.debug("☀️ Emergency fallback sun added to scene.");
    }
    if (!sunMeshes.length) {
      logger.error("❌ No sun mesh present in scene after all attempts!");
    }
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
          throw new Error(
            `CRITICAL: Missing geometry for planet ${planetConfig.id} - NO FALLBACKS ALLOWED`
          );
        }
        if (!planetMaterial) {
          throw new Error(
            `CRITICAL: Missing material for planet ${planetConfig.id} - NO FALLBACKS ALLOWED`
          );
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
        logger.debug(
          `🪐 Planet ${planetConfig.id} added with REQUIRED texture ${planetTextureKey}.`
        );
      } catch (err) {
        logger.error(
          `❌ Exception while creating planet ${planetConfig.id}:`,
          err
        );
        captureException(err);
      }

      // Add moons to this planet - ONLY if the planet was successfully created AND added to scene
      if (planetConfig.moons) {
        if (!planet) {
          logger.warn(
            `⚠️ Skipping ${planetConfig.moons.length} moon(s) for ${planetConfig.id} because planet failed to create - no orphaned moons allowed.`
          );
        } else {
          // Validate planet is actually in the scene before adding moons
          const isPlanetInGroup = planetGroup.children.includes(planet);

          if (!isPlanetInGroup) {
            logger.warn(
              `⚠️ Skipping ${planetConfig.moons.length} moon(s) for ${planetConfig.id} because planet is not in the scene group - no orphaned moons allowed.`
            );
          } else {
            for (let i = 0; i < planetConfig.moons.length; i++) {
              const moonConfig = planetConfig.moons[i];
              let moon: Mesh | null = null;
              try {
                const moonGeometry = geometries.get(
                  `moon_${planetConfig.id}_${i}`
                );
                const moonMaterial = materials.get(
                  `moon_${planetConfig.id}_${i}`
                );

                if (!moonGeometry) {
                  logger.error(
                    `❌ Missing geometry for moon ${planetConfig.id}_${i}, using fallback sphere.`
                  );
                }
                if (!moonMaterial) {
                  logger.error(
                    `❌ Missing material for moon ${planetConfig.id}_${i}, using fallback material.`
                  );
                }

                moon = new Mesh(
                  moonGeometry || new SphereGeometry(moonConfig.radius, 16, 16),
                  moonMaterial ||
                    new MeshPhongMaterial({
                      color: 0xbbbbbb,
                      shininess: 10,
                      specular: 0x080808,
                    })
                );
                moon.position.set(
                  Math.cos(i * Math.PI) * moonConfig.orbitRadius,
                  0,
                  Math.sin(i * Math.PI) * moonConfig.orbitRadius
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
                logger.debug(
                  `🌙 Moon ${planetConfig.id}_${i} added with correct texture (planet validated).`
                );
              } catch (err) {
                logger.error(
                  `❌ Exception while creating moon ${planetConfig.id}_${i}:`,
                  err
                );
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
            `⚠️ Skipping ring for ${planetConfig.id} because planet failed to create - no standalone rings allowed.`
          );
        } else {
          let ringTextureKey = "";
          if (planetConfig.id === "planet_v") ringTextureKey = "ring_planet_v";
          else if (planetConfig.id === "planet_k")
            ringTextureKey = "ring_planet_k";
          const ringTexture = textures.get(ringTextureKey);
          const ringGeometry = geometries.get(`ring_${planetConfig.id}`);
          const ringMaterial = materials.get(`ring_mat_${planetConfig.id}`);

          // Validate planet is actually in the scene before adding rings
          const isPlanetInGroup = planetGroup.children.includes(planet);

          if (!isPlanetInGroup) {
            logger.warn(
              `⚠️ Skipping ring for ${planetConfig.id} because planet is not in the scene group - no orphaned rings allowed.`
            );
          } else if (!ringGeometry) {
            logger.error(
              `❌ Missing geometry for ring ${planetConfig.id}, skipping ring.`
            );
          } else if (!ringMaterial) {
            logger.error(
              `❌ Missing material for ring ${planetConfig.id}, using fallback material.`
            );
            // Only create ring with validated geometry and confirmed planet presence
            const fallbackRingMaterial = new MeshPhongMaterial({
              map: ringTexture || undefined,
              color: ringTexture ? 0xffffff : 0x8888ff,
              shininess: 5,
              specular: 0x050505,
              transparent: true,
              opacity: 0.8,
              alphaTest: 0.1,
              side: DoubleSide,
            });
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
            logger.debug(
              `💍 Ring for planet ${planetConfig.id} added with fallback material (planet validated).`
            );
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
            logger.debug(
              `💍 Ring for planet ${planetConfig.id} added with correct material (planet validated).`
            );
          }
        }
      }
      planetsGroup.add(planetGroup);
    }
    logger.debug(
      `🪐 Planets group has ${planetsGroup.children.length} children.`
    );
    setTimeout(() => {
      logger.debug(
        "🔎 Scene children:",
        scene.children.map((c) => c.userData)
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

    // Clear all cached data
    this.textureCache.clear();
    this.preloadedSystem = null;
    this.isPreloaded = false;
    this.isPreloading = false;

    // Dispose of textures properly
    this.textureCache.forEach((texture) => {
      if (texture) {
        texture.dispose();
      }
    });

    logger.debug("SolarSystemPreloader: All caches cleared successfully");
  }
}
