import {
  Scene,
  PerspectiveCamera,
  DirectionalLight,
  AmbientLight,
  PointLight,
  Clock,
  Group,
  SphereGeometry,
  MeshPhongMaterial,
  Mesh,
  RingGeometry,
  MeshBasicMaterial,
  DoubleSide,
  Texture,
  TextureLoader,
  Object3D,
} from "three";
import { Asset } from "expo-asset";

// FBX Loader interface for typing
interface FBXLoaderType {
  load(
    url: string,
    onLoad: (object: Object3D) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void
  ): void;
}

// FBX Loader class - will be null if not available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FBXLoader: (new () => FBXLoaderType) | null = null;

// Check FBX Loader availability at startup
(() => {
  try {
    // Note: FBXLoader may not be available in React Native/Expo environment
    // We'll import it dynamically and handle errors gracefully
    const loaderModule = eval("require")(
      "three/examples/jsm/loaders/FBXLoader.js"
    );
    FBXLoader = loaderModule.FBXLoader;
    console.log("SolarSystemPreloader: FBXLoader available");
  } catch {
    console.warn(
      "SolarSystemPreloader: FBXLoader not available - will use fallback geometries"
    );
    console.warn("This is normal in React Native/Expo environments");
  }
})();

// Import textures using relative path to assets
import texPlanetR from "../../assets/3d/tex_planet_r.png";
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

// Import FBX models
import sunFbx from "../../assets/3d/sun.fbx";
import planetVFbx from "../../assets/3d/planet_v.fbx";
import planetRFbx from "../../assets/3d/planet_r.fbx";
import planetKFbx from "../../assets/3d/planet_k.fbx";
import planetDFbx from "../../assets/3d/planet_d.fbx";
import planetAFbx from "../../assets/3d/planet_a.fbx";
import moonKDFbx from "../../assets/3d/moon_k_d.fbx";
import moonKCFbx from "../../assets/3d/moon_k_c.fbx";
import moonDGFbx from "../../assets/3d/moon_d_g.fbx";
import moonDFFbx from "../../assets/3d/moon_d_f.fbx";
import moonAHFbx from "../../assets/3d/moon_a_h.fbx";

export interface PlanetConfig {
  id: string;
  texture: string;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  radius: number;
  moons?: MoonConfig[];
  rings?: RingConfig;
  materialType?: "phong" | "emissive"; // For different material types
  emissiveIntensity?: number; // For glowing effects
}

export interface MoonConfig {
  texture: string;
  orbitRadius: number;
  orbitSpeed: number;
  radius: number;
}

interface RingConfig {
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

export interface FBXPreloadProgress {
  loaded: number;
  total: number;
  currentModel: string;
  percentage: number;
}

export interface SolarSystemPreloadProgress {
  phase: "textures" | "fbx" | "geometries" | "materials" | "scene" | "complete";
  loaded: number;
  total: number;
  currentItem: string;
  percentage: number;
  textureProgress?: TexturePreloadProgress;
  fbxProgress?: FBXPreloadProgress;
}

export interface PreloadedSolarSystem {
  scene: Scene;
  camera: PerspectiveCamera;
  clock: Clock;
  planetsGroup: Group;
  meshes: Mesh[];
  lights: (DirectionalLight | AmbientLight | PointLight)[];
  geometries: Map<string, SphereGeometry | RingGeometry>;
  materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>;
  textures: Map<string, Texture | null>;
  fbxModels: Map<string, Object3D | null>;
}

export class SolarSystemPreloader {
  private static preloadedSystem: PreloadedSolarSystem | null = null;
  private static isPreloading = false;
  private static isPreloaded = false;
  private static textureCache = new Map<string, Texture | null>();
  private static fbxCache = new Map<string, Object3D | null>();

  // Define texture mapping for solar system - matching notes.txt structure
  private static readonly textureMapping = [
    // Planet textures (matching notes.txt)
    { key: "planet_r", path: texPlanetR },
    { key: "planet_a", path: texPlanetA },
    { key: "planet_d", path: texPlanetD },
    { key: "planet_v", path: texPlanetV },
    { key: "planet_k", path: texPlanetK },
    // Ring textures
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
  ];

  // Define FBX model mapping
  private static readonly fbxMapping = [
    { key: "sun", path: sunFbx },
    { key: "planet_r", path: planetRFbx },
    { key: "planet_a", path: planetAFbx },
    { key: "planet_d", path: planetDFbx },
    { key: "planet_v", path: planetVFbx },
    { key: "planet_k", path: planetKFbx },
    { key: "moon_a_h", path: moonAHFbx },
    { key: "moon_d_f", path: moonDFFbx },
    { key: "moon_d_g", path: moonDGFbx },
    { key: "moon_k_c", path: moonKCFbx },
    { key: "moon_k_d", path: moonKDFbx },
  ];

  // Solar system configuration based on notes.txt - using actual FBX model structure
  // Scaled up for visibility from camera distance
  private static readonly solarSystemConfig: PlanetConfig[] = [
    // planet_r - grey/green planet with no moons (closest)
    {
      id: "planet_r",
      texture: texPlanetR,
      orbitRadius: 6,
      orbitSpeed: 0.02,
      rotationSpeed: 0.01,
      radius: 2.0, // Scaled up for visibility
      materialType: "phong",
    },
    // planet_a - red planet with 1 moon: moon_a_h
    {
      id: "planet_a",
      texture: texPlanetA,
      orbitRadius: 8,
      orbitSpeed: 0.015,
      rotationSpeed: 0.008,
      radius: 2.5, // Scaled up for visibility
      materialType: "phong",
      moons: [
        {
          texture: texMoonH,
          orbitRadius: 3,
          orbitSpeed: 0.05,
          radius: 0.8,
        },
      ],
    },
    // planet_d - large orange planet with 2 moons: moon_d_f + moon_d_g
    {
      id: "planet_d",
      texture: texPlanetD,
      orbitRadius: 10,
      orbitSpeed: 0.012,
      rotationSpeed: 0.006,
      radius: 3.0, // Scaled up for visibility
      materialType: "phong",
      moons: [
        {
          texture: texMoonF,
          orbitRadius: 3.5,
          orbitSpeed: 0.04,
          radius: 0.8,
        },
        {
          texture: texMoonG,
          orbitRadius: 4,
          orbitSpeed: 0.03,
          radius: 0.8,
        },
      ],
    },
    // planet_v - blue planet with small ring
    {
      id: "planet_v",
      texture: texPlanetV,
      orbitRadius: 12,
      orbitSpeed: 0.01,
      rotationSpeed: 0.005,
      radius: 2.5, // Scaled up for visibility
      materialType: "phong",
      rings: {
        texture: texRingA,
        innerRadius: 3.5,
        outerRadius: 5.0,
      },
    },
    // planet_k - green planet with large ring and 2 moons: moon_k_c + moon_k_d
    {
      id: "planet_k",
      texture: texPlanetK,
      orbitRadius: 15,
      orbitSpeed: 0.008,
      rotationSpeed: 0.004,
      radius: 4.0, // Scaled up for visibility
      materialType: "phong",
      moons: [
        {
          texture: texMoonC,
          orbitRadius: 5,
          orbitSpeed: 0.06,
          radius: 0.8,
        },
        {
          texture: texMoonD,
          orbitRadius: 6,
          orbitSpeed: 0.04,
          radius: 0.8,
        },
      ],
      rings: {
        texture: texRingB,
        innerRadius: 5.0,
        outerRadius: 7.0,
      },
    },
  ];

  /**
   * Load texture from bundled asset using expo-asset - TRUE LOCAL LOADING
   */
  private static async loadTextureFromAsset(
    loader: TextureLoader,
    assetId: number,
    cacheKey: string
  ): Promise<Texture> {
    console.time(`SolarSystemPreloader: Load ${cacheKey}`);

    try {
      console.log(
        `SolarSystemPreloader: Loading ${cacheKey} from bundled asset using expo-asset`
      );

      // Use expo-asset to get proper local URI for bundled assets
      const asset = Asset.fromModule(assetId);
      await asset.downloadAsync(); // Ensure asset is available locally

      console.log(
        `SolarSystemPreloader: Asset ${cacheKey} local URI: ${asset.localUri}`
      );

      // Load texture using the local URI (no network dependency)
      const texture = loader.load(asset.localUri || asset.uri);

      console.timeEnd(`SolarSystemPreloader: Load ${cacheKey}`);
      console.log(
        `SolarSystemPreloader: ✅ Successfully loaded ${cacheKey} from bundled asset`
      );

      return texture;
    } catch (error) {
      console.error(
        `SolarSystemPreloader: ❌ Failed to load ${cacheKey} from bundled asset:`,
        error
      );
      console.error(`SolarSystemPreloader: Asset ID was: ${assetId}`);
      console.error(
        `SolarSystemPreloader: This indicates an issue with asset bundling or expo-asset compatibility`
      );
      throw error;
    }
  }

  /**
   * Load FBX model from bundled asset using expo-asset - TRUE LOCAL LOADING
   */
  private static async loadFBXFromAsset(
    loader: FBXLoaderType,
    assetId: number,
    cacheKey: string
  ): Promise<Object3D> {
    console.time(`SolarSystemPreloader: Load FBX ${cacheKey}`);

    try {
      console.log(
        `SolarSystemPreloader: Loading FBX ${cacheKey} from bundled asset using expo-asset`
      );

      // Use expo-asset to get proper local URI for bundled assets
      const asset = Asset.fromModule(assetId);
      await asset.downloadAsync(); // Ensure asset is available locally

      console.log(
        `SolarSystemPreloader: FBX Asset ${cacheKey} local URI: ${asset.localUri}`
      );

      // Load FBX using the local URI (no network dependency)
      return new Promise((resolve, reject) => {
        loader.load(
          asset.localUri || asset.uri,
          (fbx: Object3D) => {
            console.timeEnd(`SolarSystemPreloader: Load FBX ${cacheKey}`);
            console.log(
              `SolarSystemPreloader: ✅ Successfully loaded FBX ${cacheKey} from bundled asset`
            );
            resolve(fbx);
          },
          (progress: ProgressEvent) => {
            console.log(
              `SolarSystemPreloader: FBX ${cacheKey} loading progress:`,
              progress
            );
          },
          (error: ErrorEvent) => {
            console.error(
              `SolarSystemPreloader: ❌ Failed to load FBX ${cacheKey} from bundled asset:`,
              error
            );
            console.error(`SolarSystemPreloader: FBX Asset ID was: ${assetId}`);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error(
        `SolarSystemPreloader: ❌ Failed to load FBX ${cacheKey} from bundled asset:`,
        error
      );
      console.error(`SolarSystemPreloader: FBX Asset ID was: ${assetId}`);
      console.error(
        `SolarSystemPreloader: This indicates an issue with FBX asset bundling or expo-asset compatibility`
      );
      throw error;
    }
  }

  /**
   * Preload all solar system textures - FAULT-TOLERANT VERSION
   */
  private static async preloadTextures(
    onProgress?: (progress: TexturePreloadProgress) => void
  ): Promise<Map<string, Texture | null>> {
    if (this.textureCache.size > 0) {
      console.log(
        "SolarSystemPreloader: Textures already preloaded, returning cache"
      );
      return this.textureCache;
    }

    console.log(
      "SolarSystemPreloader: Starting fault-tolerant texture preloading..."
    );
    console.time("SolarSystemPreloader: Total texture preload time");

    // Debug: Log all texture paths
    console.log("SolarSystemPreloader: Texture mapping paths:");
    this.textureMapping.forEach(({ key, path }) => {
      console.log(`  ${key}: ${path}`);
    });

    const textureLoader = new TextureLoader();
    const total = this.textureMapping.length;
    let loaded = 0;

    // Load textures in small batches with fault tolerance
    const BATCH_SIZE = 2; // Reduced batch size for better stability
    for (let i = 0; i < this.textureMapping.length; i += BATCH_SIZE) {
      const batch = this.textureMapping.slice(i, i + BATCH_SIZE);
      console.log(
        `SolarSystemPreloader: Loading texture batch ${
          Math.floor(i / BATCH_SIZE) + 1
        } (${batch.length} textures)`
      );

      const batchPromises = batch.map(async ({ key, path }) => {
        try {
          const texture = await this.loadTextureFromAsset(
            textureLoader,
            path,
            key
          );
          this.textureCache.set(key, texture);
          console.log(`SolarSystemPreloader: ✅ Successfully loaded ${key}`);

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

          return { key, success: true };
        } catch (error) {
          console.warn(
            `SolarSystemPreloader: ⚠️ Failed to load ${key}, continuing anyway:`,
            error
          );
          this.textureCache.set(key, null); // Store null for failed textures
          loaded++;

          const percentage = Math.round((loaded / total) * 100);
          if (onProgress) {
            onProgress({
              loaded,
              total,
              currentTexture: `${key} (failed)`,
              percentage,
            });
          }

          return { key, success: false, error };
        }
      });

      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises);

      // Small delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < this.textureMapping.length) {
        await new Promise((resolve) => setTimeout(resolve, 200)); // Increased delay
      }
    }

    console.timeEnd("SolarSystemPreloader: Total texture preload time");

    const successful = Array.from(this.textureCache.values()).filter(
      (t) => t !== null
    ).length;
    const failed = total - successful;

    console.log(
      `SolarSystemPreloader: ✅ Texture preloading complete - ${successful} successful, ${failed} failed`
    );

    if (failed > 0) {
      const failedKeys = Array.from(this.textureCache.entries())
        .filter(([, texture]) => texture === null)
        .map(([key]) => key);
      console.warn(
        `SolarSystemPreloader: ⚠️ Failed textures (will use fallbacks): ${failedKeys.join(
          ", "
        )}`
      );
    }

    console.log(
      "SolarSystemPreloader: 🎯 Texture preloading completed with fault tolerance"
    );
    return this.textureCache;
  }

  /**
   * Preload all solar system FBX models - FAULT-TOLERANT VERSION
   */
  private static async preloadFBXModels(
    onProgress?: (progress: FBXPreloadProgress) => void
  ): Promise<Map<string, Object3D | null>> {
    if (this.fbxCache.size > 0) {
      console.log(
        "SolarSystemPreloader: FBX models already preloaded, returning cache"
      );
      return this.fbxCache;
    }

    // Check if FBXLoader is available
    if (!FBXLoader) {
      console.warn(
        "SolarSystemPreloader: FBXLoader not available - skipping FBX model loading"
      );
      console.warn("All objects will use fallback geometries");

      // Mark all FBX models as failed (null) so fallback geometries are used
      this.fbxMapping.forEach(({ key }) => {
        this.fbxCache.set(key, null);
      });

      // Report progress as complete
      if (onProgress) {
        onProgress({
          loaded: this.fbxMapping.length,
          total: this.fbxMapping.length,
          currentModel: "FBX loader unavailable - using fallbacks",
          percentage: 100,
        });
      }

      return this.fbxCache;
    }

    console.log(
      "SolarSystemPreloader: Starting fault-tolerant FBX model preloading..."
    );
    console.time("SolarSystemPreloader: Total FBX preload time");

    // Debug: Log all FBX paths
    console.log("SolarSystemPreloader: FBX mapping paths:");
    this.fbxMapping.forEach(({ key, path }) => {
      console.log(`  ${key}: ${path}`);
    });

    const fbxLoader = new FBXLoader();
    const total = this.fbxMapping.length;
    let loaded = 0;

    // Load FBX models in small batches with fault tolerance
    const BATCH_SIZE = 1; // Smaller batch size for FBX loading
    for (let i = 0; i < this.fbxMapping.length; i += BATCH_SIZE) {
      const batch = this.fbxMapping.slice(i, i + BATCH_SIZE);
      console.log(
        `SolarSystemPreloader: Loading FBX batch ${
          Math.floor(i / BATCH_SIZE) + 1
        } (${batch.length} models)`
      );

      const batchPromises = batch.map(async ({ key, path }) => {
        try {
          const fbx = await this.loadFBXFromAsset(fbxLoader, path, key);
          this.fbxCache.set(key, fbx);
          console.log(
            `SolarSystemPreloader: ✅ Successfully loaded FBX ${key}`
          );

          loaded++;
          const percentage = Math.round((loaded / total) * 100);

          if (onProgress) {
            onProgress({
              loaded,
              total,
              currentModel: key,
              percentage,
            });
          }

          return { key, success: true };
        } catch (error) {
          console.warn(
            `SolarSystemPreloader: ⚠️ Failed to load FBX ${key}, continuing anyway:`,
            error
          );
          this.fbxCache.set(key, null); // Store null for failed FBX models
          loaded++;

          const percentage = Math.round((loaded / total) * 100);
          if (onProgress) {
            onProgress({
              loaded,
              total,
              currentModel: `${key} (failed)`,
              percentage,
            });
          }

          return { key, success: false, error };
        }
      });

      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises);

      // Small delay between batches to prevent overwhelming the system
      if (i + BATCH_SIZE < this.fbxMapping.length) {
        await new Promise((resolve) => setTimeout(resolve, 300)); // Increased delay for FBX
      }
    }

    console.timeEnd("SolarSystemPreloader: Total FBX preload time");

    const successful = Array.from(this.fbxCache.values()).filter(
      (m) => m !== null
    ).length;
    const failed = total - successful;

    console.log(
      `SolarSystemPreloader: ✅ FBX preloading complete - ${successful} successful, ${failed} failed`
    );

    if (failed > 0) {
      const failedKeys = Array.from(this.fbxCache.entries())
        .filter(([, model]) => model === null)
        .map(([key]) => key);
      console.warn(
        `SolarSystemPreloader: ⚠️ Failed FBX models (will use fallback geometries): ${failedKeys.join(
          ", "
        )}`
      );
    }

    console.log(
      "SolarSystemPreloader: 🎯 FBX preloading completed with fault tolerance"
    );
    return this.fbxCache;
  }

  /**
   * Preload the complete 3D solar system scene
   */
  static async preloadSolarSystem(
    onProgress?: (progress: SolarSystemPreloadProgress) => void
  ): Promise<PreloadedSolarSystem> {
    // OPTIMIZATION: Return immediately if already preloaded
    if (this.isPreloaded && this.preloadedSystem) {
      console.log(
        "SolarSystemPreloader: System already preloaded - returning cached system"
      );
      if (onProgress) {
        onProgress({
          phase: "complete",
          loaded: 1,
          total: 1,
          currentItem: "Solar system ready (cached)!",
          percentage: 100,
        });
      }
      return this.preloadedSystem;
    }

    if (this.isPreloading) {
      console.log(
        "SolarSystemPreloader: Preloading already in progress - waiting for completion"
      );
      // Wait for current preloading to complete with timeout
      let waitTime = 0;
      const maxWaitTime = 30000; // 30 seconds max wait
      while (this.isPreloading && waitTime < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitTime += 100;
      }

      if (this.preloadedSystem) {
        console.log("SolarSystemPreloader: Preloading completed while waiting");
        return this.preloadedSystem;
      } else {
        throw new Error("Solar system preloading timed out or failed");
      }
    }

    this.isPreloading = true;

    try {
      console.log(
        "SolarSystemPreloader: Starting complete scene preloading..."
      );

      // Phase 1: Preload textures (30% of progress) with mandatory loading
      console.log(
        "SolarSystemPreloader: Phase 1 - Preloading textures (MANDATORY)..."
      );

      const textures = await this.preloadTextures((textureProgress) => {
        if (onProgress) {
          onProgress({
            phase: "textures",
            loaded: textureProgress.loaded,
            total: textureProgress.total,
            currentItem: textureProgress.currentTexture,
            percentage: Math.round(textureProgress.percentage * 0.3), // 30% of total
            textureProgress,
          });
        }
      });

      // Check texture loading results - all textures should load from local assets
      const successfulTextures = Array.from(textures.values()).filter(
        (t) => t !== null
      ).length;
      const totalTextures = textures.size;
      const successRate = successfulTextures / totalTextures;

      console.log(
        `SolarSystemPreloader: Texture loading results - ${successfulTextures}/${totalTextures} successful (${Math.round(
          successRate * 100
        )}%)`
      );

      if (successRate < 1.0) {
        // Some textures failed to load - continue with fallback colors
        const failedTextures = Array.from(textures.entries())
          .filter(([, texture]) => texture === null)
          .map(([key]) => key);

        console.warn(
          "SolarSystemPreloader: Some textures failed to load - continuing with fallback colors"
        );
        console.warn(
          `Failed textures (using fallbacks): ${failedTextures.join(", ")}`
        );
        console.log(
          `SolarSystemPreloader: ${successfulTextures}/${totalTextures} textures loaded successfully, ${failedTextures.length} using fallback colors`
        );
        console.log(
          "SolarSystemPreloader: The solar system will render with mixed textures and fallback colors"
        );
      }

      // Phase 2: Preload FBX models (30% of progress)
      console.log(
        "SolarSystemPreloader: Phase 2 - Preloading FBX models (OPTIONAL)..."
      );

      const fbxModels = await this.preloadFBXModels((fbxProgress) => {
        if (onProgress) {
          onProgress({
            phase: "fbx",
            loaded: fbxProgress.loaded,
            total: fbxProgress.total,
            currentItem: fbxProgress.currentModel,
            percentage: 30 + Math.round(fbxProgress.percentage * 0.3), // 30% + 30%
            fbxProgress,
          });
        }
      });

      // Check FBX loading results
      const successfulFBX = Array.from(fbxModels.values()).filter(
        (m) => m !== null
      ).length;
      const totalFBX = fbxModels.size;
      const fbxSuccessRate = successfulFBX / totalFBX;

      console.log(
        `SolarSystemPreloader: FBX loading results - ${successfulFBX}/${totalFBX} successful (${Math.round(
          fbxSuccessRate * 100
        )}%)`
      );

      if (fbxSuccessRate < 1.0) {
        // Some FBX models failed to load - continue with fallback geometries
        const failedFBX = Array.from(fbxModels.entries())
          .filter(([, model]) => model === null)
          .map(([key]) => key);

        console.warn(
          "SolarSystemPreloader: Some FBX models failed to load - continuing with fallback geometries"
        );
        console.warn(
          `Failed FBX models (using fallback geometries): ${failedFBX.join(
            ", "
          )}`
        );
        console.log(
          `SolarSystemPreloader: ${successfulFBX}/${totalFBX} FBX models loaded successfully, ${failedFBX.length} using fallback geometries`
        );
        console.log(
          "SolarSystemPreloader: The solar system will render with mixed FBX models and fallback geometries"
        );
      }

      // Phase 3: Create geometries (15% of progress) - fallback for failed FBX
      console.log("SolarSystemPreloader: Phase 3 - Creating geometries...");
      const geometries = await this.createGeometries(
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "geometries",
              loaded,
              total,
              currentItem: current,
              percentage: 60 + Math.round((loaded / total) * 15), // 60% + 15%
            });
          }
        }
      );

      // Phase 4: Create materials (15% of progress)
      console.log("SolarSystemPreloader: Phase 4 - Creating materials...");
      const materials = await this.createMaterials(
        textures,
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "materials",
              loaded,
              total,
              currentItem: current,
              percentage: 75 + Math.round((loaded / total) * 15), // 75% + 15%
            });
          }
        }
      );

      // Phase 5: Create complete scene (10% of progress)
      console.log("SolarSystemPreloader: Phase 5 - Creating complete scene...");
      this.preloadedSystem = await this.createCompleteScene(
        geometries,
        materials,
        textures,
        fbxModels,
        (loaded, total, current) => {
          if (onProgress) {
            onProgress({
              phase: "scene",
              loaded,
              total,
              currentItem: current,
              percentage: 90 + Math.round((loaded / total) * 10), // 90% + 10%
            });
          }
        }
      );

      // Complete
      if (onProgress) {
        onProgress({
          phase: "complete",
          loaded: 1,
          total: 1,
          currentItem: "Solar system ready!",
          percentage: 100,
        });
      }

      this.isPreloaded = true;
      console.log(
        "SolarSystemPreloader: Complete 3D solar system preloaded successfully!"
      );
      return this.preloadedSystem;
    } catch (error) {
      console.error(
        "SolarSystemPreloader: Critical error during preloading:",
        error
      );
      console.error(
        "SolarSystemPreloader: This error must be fixed - no fallback available"
      );
      throw error; // Re-throw to prevent silent failures
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Create enhanced geometries with high polygon counts for FBX-like quality
   */
  private static async createGeometries(
    onProgress?: (loaded: number, total: number, current: string) => void
  ): Promise<Map<string, SphereGeometry | RingGeometry>> {
    const geometries = new Map<string, SphereGeometry | RingGeometry>();

    const geometrySpecs: Array<{
      key: string;
      create: () => SphereGeometry | RingGeometry;
    }> = [
      // High-quality sun geometry - scaled up for visibility
      { key: "sun", create: () => new SphereGeometry(6.0, 64, 64) },
    ];

    // Add high-quality planet geometries
    this.solarSystemConfig.forEach((planet) => {
      // Very high polygon count for smooth, FBX-like appearance
      const segments = planet.radius > 2 ? 128 : planet.radius > 1 ? 96 : 64;

      geometrySpecs.push({
        key: `planet_${planet.id}`,
        create: () => new SphereGeometry(planet.radius, segments, segments),
      });

      // Add high-quality moon geometries
      planet.moons?.forEach((moon, i) => {
        geometrySpecs.push({
          key: `moon_${planet.id}_${i}`,
          create: () => new SphereGeometry(moon.radius, 32, 32),
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
              128 // Very high segment count for smooth rings
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
   * Create enhanced materials that mimic FBX model appearance
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
      // Enhanced sun material with bright emission-like appearance
      {
        key: "sun",
        create: () =>
          new MeshBasicMaterial({
            color: 0xffaa00,
            transparent: false,
          }),
      },
    ];

    // Add enhanced planet materials that look like FBX models
    this.solarSystemConfig.forEach((planet) => {
      const planetTexture = textures.get(planet.id);

      // Enhanced fallback colors matching FBX model appearance
      const fallbackColors = {
        planet_r: 0x8c7853, // Rocky brownish
        planet_a: 0x6b93d6, // Blue-red planet
        planet_d: 0xcd5c5c, // Orange-red planet
        planet_v: 0xffc649, // Blue planet
        planet_k: 0xd8ca9d, // Green planet
      };

      // Create sophisticated planet material
      materialSpecs.push({
        key: `planet_${planet.id}`,
        create: () => {
          if (planetTexture) {
            console.log(`✅ Using supplied texture for planet ${planet.id}`);
            return new MeshPhongMaterial({
              map: planetTexture,
              color: 0xffffff,
              shininess: 20, // Slightly shiny for realism
              transparent: false,
              // Enhanced lighting properties
              specular: 0x222222,
              reflectivity: 0.1,
            });
          } else {
            console.warn(
              `⚠️ Using fallback color for planet ${planet.id} - texture not loaded`
            );
            return new MeshPhongMaterial({
              color:
                fallbackColors[planet.id as keyof typeof fallbackColors] ||
                0x888888,
              shininess: 20,
              transparent: false,
              specular: 0x222222,
              reflectivity: 0.1,
            });
          }
        },
      });

      // Add high-quality moon materials using actual moon names from notes.txt
      planet.moons?.forEach((moon, i) => {
        // Get the actual moon texture key based on planet and moon assignments
        let moonTextureKey = "";
        if (planet.id === "planet_a") {
          moonTextureKey = "moon_a_h";
        } else if (planet.id === "planet_d") {
          moonTextureKey = i === 0 ? "moon_d_f" : "moon_d_g";
        } else if (planet.id === "planet_k") {
          moonTextureKey = i === 0 ? "moon_k_c" : "moon_k_d";
        }

        const moonTexture = textures.get(moonTextureKey);
        materialSpecs.push({
          key: `moon_${planet.id}_${i}`,
          create: () => {
            if (moonTexture) {
              console.log(
                `✅ Using supplied texture for moon ${moonTextureKey} (${planet.id}_${i})`
              );
              return new MeshPhongMaterial({
                map: moonTexture,
                color: 0xffffff,
                shininess: 5, // Less shiny than planets
                specular: 0x111111,
                reflectivity: 0.05,
              });
            } else {
              console.warn(
                `⚠️ Using fallback color for moon ${moonTextureKey} (${planet.id}_${i}) - texture not loaded`
              );
              return new MeshPhongMaterial({
                color: 0xaaaaaa,
                shininess: 5,
                specular: 0x111111,
                reflectivity: 0.05,
              });
            }
          },
        });
      });

      // Add high-quality ring materials
      if (planet.rings) {
        const ringTexture = textures.get(`ring_${planet.id}`);
        materialSpecs.push({
          key: `ring_mat_${planet.id}`,
          create: () => {
            if (ringTexture) {
              console.log(`✅ Using supplied texture for ring ${planet.id}`);
              return new MeshBasicMaterial({
                map: ringTexture,
                color: 0xffffff,
                side: DoubleSide,
                transparent: true,
                opacity: 0.9,
                alphaTest: 0.1,
              });
            } else {
              console.warn(
                `⚠️ Using fallback color for ring ${planet.id} - texture not loaded`
              );
              return new MeshBasicMaterial({
                color: 0x666666,
                side: DoubleSide,
                transparent: true,
                opacity: 0.7,
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

      // Small delay to prevent blocking
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    console.log(`✅ Created ${materials.size} high-quality materials`);
    return materials;
  }

  /**
   * Create the complete 3D scene with all objects
   */
  private static async createCompleteScene(
    geometries: Map<string, SphereGeometry | RingGeometry>,
    materials: Map<string, MeshPhongMaterial | MeshBasicMaterial>,
    textures: Map<string, Texture | null>,
    fbxModels: Map<string, Object3D | null>,
    onProgress?: (loaded: number, total: number, current: string) => void
  ): Promise<PreloadedSolarSystem> {
    // Initialize scene
    const scene = new Scene();
    const camera = new PerspectiveCamera(
      75, // Field of view
      1, // Aspect ratio (will be updated by component)
      0.1, // Near plane
      500 // Far plane - increased for larger distances
    );

    // Position camera much closer and higher for better view
    camera.position.set(15, 10, 15); // Much closer to the action
    camera.lookAt(0, 0, 0); // Look at center where sun is

    console.log(`📷 Camera positioned at (15, 10, 15) looking at (0, 0, 0)`);

    const clock = new Clock();
    const meshes: Mesh[] = [];
    const lights: (DirectionalLight | AmbientLight | PointLight)[] = [];

    onProgress?.(1, 10, "Scene setup");

    // Setup lighting - enhanced for better visibility
    const ambientLight = new AmbientLight(0x404040, 0.6); // Increased ambient light
    scene.add(ambientLight);
    lights.push(ambientLight);

    const sunLight = new DirectionalLight(0xffffff, 2.0); // Increased intensity
    sunLight.position.set(0, 10, 0);
    sunLight.target.position.set(0, 0, 0);
    scene.add(sunLight);
    scene.add(sunLight.target);
    lights.push(sunLight);

    const sunPointLight = new PointLight(0xffffff, 3.0, 200); // Increased intensity and range
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);
    lights.push(sunPointLight);

    console.log(
      `💡 Lighting setup: Ambient(0.6), Directional(2.0), Point(3.0)`
    );

    onProgress?.(2, 10, "Lighting setup");

    // Create sun - use FBX if available, otherwise fallback to geometry
    const sunFBX = fbxModels.get("sun");
    if (sunFBX) {
      // Use FBX model for sun
      const sun = sunFBX.clone();
      sun.position.set(0, 0, 0);
      sun.scale.set(6.0, 6.0, 6.0); // Scale to match desired size
      sun.userData = { isSun: true, isFromFBX: true };

      // Apply material to FBX mesh
      const sunMaterial = materials.get("sun")!;
      sun.traverse((child) => {
        if (child instanceof Mesh) {
          child.material = sunMaterial;
          meshes.push(child);
        }
      });

      scene.add(sun);
      console.log(
        `☀️ Sun created from FBX model at position (0, 0, 0) with scale 6.0`
      );
    } else {
      // Fallback to geometry-based sun
      const sunGeometry = geometries.get("sun")!;
      const sunMaterial = materials.get("sun")!;
      const sun = new Mesh(sunGeometry, sunMaterial);
      sun.position.set(0, 0, 0);
      sun.userData = { isSun: true, isFromFBX: false };
      scene.add(sun);
      meshes.push(sun);
      console.log(
        `☀️ Sun created from geometry at position (0, 0, 0) with radius 6.0`
      );
    }

    onProgress?.(3, 10, "Sun created");

    // Add planets group
    const planetsGroup = new Group();
    scene.add(planetsGroup);

    let planetCount = 0;
    for (const planetConfig of this.solarSystemConfig) {
      // Create planet group for orbital motion
      const planetGroup = new Group();
      planetGroup.userData = {
        config: planetConfig,
        orbitAngle: Math.random() * Math.PI * 2,
      };

      // Get preloaded planet texture and FBX model (may be null if failed to load)
      const planetTexture = textures.get(planetConfig.id);
      const planetFBX = fbxModels.get(planetConfig.id);

      // Create planet - use FBX if available, otherwise fallback to geometry
      let planet: Object3D | Mesh;

      if (planetFBX) {
        console.log(
          `🪐 Creating planet ${planetConfig.id} from FBX model ${
            planetTexture ? "with texture" : "with fallback color"
          }`
        );

        planet = planetFBX.clone();
        planet.position.set(planetConfig.orbitRadius, 0, 0);
        planet.scale.set(
          planetConfig.radius,
          planetConfig.radius,
          planetConfig.radius
        );
        planet.userData = {
          isPlanet: true,
          config: planetConfig,
          isFromFBX: true,
        };

        // Apply material to all meshes in the FBX model
        const planetMaterial = materials.get(`planet_${planetConfig.id}`)!;
        planet.traverse((child) => {
          if (child instanceof Mesh) {
            child.material = planetMaterial;
            meshes.push(child);
          }
        });

        planetGroup.add(planet);
        console.log(
          `🪐 Planet ${planetConfig.id} created from FBX at position (${planetConfig.orbitRadius}, 0, 0) with scale ${planetConfig.radius}`
        );
      } else {
        // Fallback to geometry-based planet
        console.log(
          `🪐 Creating planet ${planetConfig.id} from geometry ${
            planetTexture ? "with texture" : "with fallback color"
          }`
        );

        const planetGeometry = geometries.get(`planet_${planetConfig.id}`)!;
        const planetMaterial = materials.get(`planet_${planetConfig.id}`)!;

        planet = new Mesh(planetGeometry, planetMaterial);
        planet.position.set(planetConfig.orbitRadius, 0, 0);
        planet.userData = {
          isPlanet: true,
          config: planetConfig,
          isFromFBX: false,
        };
        planetGroup.add(planet);
        if (planet instanceof Mesh) {
          meshes.push(planet);
        }

        console.log(
          `🪐 Planet ${planetConfig.id} created from geometry at position (${planetConfig.orbitRadius}, 0, 0) with radius ${planetConfig.radius}`
        );
      }

      // Add rings if present (with fallback handling)
      if (planetConfig.rings) {
        const ringTexture = textures.get(`ring_${planetConfig.id}`);
        console.log(
          `💍 Adding ring for ${planetConfig.id} ${
            ringTexture ? "with texture" : "with fallback color"
          }`
        );

        const ringGeometry = geometries.get(`ring_${planetConfig.id}`)!;
        const ringMaterial = materials.get(`ring_mat_${planetConfig.id}`)!;

        const ring = new Mesh(ringGeometry, ringMaterial);
        ring.position.copy(planet.position);
        ring.rotation.x = Math.PI / 2;
        planetGroup.add(ring);
        meshes.push(ring);
      }

      // Add moons if present (with fallback handling and FBX support)
      if (planetConfig.moons) {
        for (let i = 0; i < planetConfig.moons.length; i++) {
          const moonConfig = planetConfig.moons[i];
          const moonTexture = textures.get(`moon_${planetConfig.id}_${i}`);

          // Get moon FBX key based on planet and moon assignments
          let moonFBXKey = "";
          if (planetConfig.id === "planet_a") {
            moonFBXKey = "moon_a_h";
          } else if (planetConfig.id === "planet_d") {
            moonFBXKey = i === 0 ? "moon_d_f" : "moon_d_g";
          } else if (planetConfig.id === "planet_k") {
            moonFBXKey = i === 0 ? "moon_k_c" : "moon_k_d";
          }

          const moonFBX = fbxModels.get(moonFBXKey);

          let moon: Object3D | Mesh;
          const moonAngle = (i * Math.PI * 2) / planetConfig.moons.length;

          if (moonFBX) {
            console.log(
              `🌙 Adding moon ${i} (${moonFBXKey}) for ${
                planetConfig.id
              } from FBX ${
                moonTexture ? "with texture" : "with fallback color"
              }`
            );

            moon = moonFBX.clone();
            moon.position.set(
              planetConfig.orbitRadius +
                Math.cos(moonAngle) * moonConfig.orbitRadius,
              0,
              Math.sin(moonAngle) * moonConfig.orbitRadius
            );
            moon.scale.set(
              moonConfig.radius,
              moonConfig.radius,
              moonConfig.radius
            );

            // Apply material to all meshes in the FBX model
            const moonMaterial = materials.get(`moon_${planetConfig.id}_${i}`)!;
            moon.traverse((child) => {
              if (child instanceof Mesh) {
                child.material = moonMaterial;
                meshes.push(child);
              }
            });

            moon.userData = {
              isMoon: true,
              moonConfig,
              moonIndex: i,
              orbitAngle: moonAngle,
              isFromFBX: true,
            };
          } else {
            // Fallback to geometry-based moon
            console.log(
              `🌙 Adding moon ${i} for ${planetConfig.id} from geometry ${
                moonTexture ? "with texture" : "with fallback color"
              }`
            );

            const moonGeometry = geometries.get(
              `moon_${planetConfig.id}_${i}`
            )!;
            const moonMaterial = materials.get(`moon_${planetConfig.id}_${i}`)!;

            moon = new Mesh(moonGeometry, moonMaterial);
            moon.position.set(
              planetConfig.orbitRadius +
                Math.cos(moonAngle) * moonConfig.orbitRadius,
              0,
              Math.sin(moonAngle) * moonConfig.orbitRadius
            );

            moon.userData = {
              isMoon: true,
              moonConfig,
              moonIndex: i,
              orbitAngle: moonAngle,
              isFromFBX: false,
            };

            if (moon instanceof Mesh) {
              meshes.push(moon);
            }
          }

          planetGroup.add(moon);
        }
      }

      planetsGroup.add(planetGroup);
      planetCount++;
      onProgress?.(3 + planetCount, 10, `Planet ${planetConfig.id} created`);

      // Small delay to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    // Report final scene statistics
    const textureSuccessCount = Array.from(textures.values()).filter(
      (t) => t !== null
    ).length;
    const textureFailCount = textures.size - textureSuccessCount;

    console.log(`🌌 Solar system scene created successfully!`);
    console.log(`📊 Scene statistics:`);
    console.log(`  - Meshes: ${meshes.length}`);
    console.log(`  - Lights: ${lights.length}`);
    console.log(`  - Geometries: ${geometries.size}`);
    console.log(`  - Materials: ${materials.size}`);
    console.log(
      `  - Textures loaded: ${textureSuccessCount}/${textures.size} (${textureFailCount} failures handled with fallbacks)`
    );

    onProgress?.(10, 10, "Scene complete");

    return {
      scene,
      camera,
      clock,
      planetsGroup,
      meshes,
      lights,
      geometries,
      materials,
      textures,
      fbxModels,
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
    if (this.preloadedSystem) {
      // Dispose of geometries
      this.preloadedSystem.geometries.forEach((geometry) => {
        geometry.dispose();
      });

      // Dispose of materials
      this.preloadedSystem.materials.forEach((material) => {
        material.dispose();
      });

      // Dispose of textures
      this.preloadedSystem.textures.forEach((texture) => {
        if (texture) {
          texture.dispose();
        }
      });

      // Clear scene
      while (this.preloadedSystem.scene.children.length > 0) {
        this.preloadedSystem.scene.remove(
          this.preloadedSystem.scene.children[0]
        );
      }
    }

    // Clear texture cache
    this.textureCache.forEach((texture) => {
      if (texture) {
        texture.dispose();
      }
    });
    this.textureCache.clear();

    this.preloadedSystem = null;
    this.isPreloaded = false;
    this.isPreloading = false;
    console.log("SolarSystemPreloader: Cache cleared");
  }
}
