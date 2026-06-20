/**
 * @fileoverview Texture preload coordinator for the solar-system background.
 */
import {type Texture} from "three";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {createTextureCache, disposeAndClearTextureCache, type TextureCache} from "./solar/textureCache";
import {preloadTexturesStage, type TexturePreloadProgress} from "./solar/textureStage";
import {resolveAssetModule, type AssetModuleReference} from "./solar/textureLoader";
import {SOLAR_SYSTEM_CONFIG} from "../components/background/SolarSystemConfig";
import sunTextureModule from "../../assets/3d/tex_sun_spots_02.png";

export interface SolarSystemPreloadProgress {
  phase: "textures" | "geometries" | "materials" | "scene" | "complete";
  loaded: number;
  total: number;
  currentItem: string;
  percentage: number;
  textureProgress?: TexturePreloadProgress;
}

export interface PreloadedSolarSystem {
  textures: TextureCache;
}

interface SolarTexturePreloadSpec {
  key: string;
  path: AssetModuleReference;
}

const getSolarTexturePreloadSpecs = (): SolarTexturePreloadSpec[] => {
  const specs: SolarTexturePreloadSpec[] = [{key: "sun", path: sunTextureModule}];
  const seenModules = new Set<string | number>();

  const addSpec = (key: string, path: AssetModuleReference): void => {
    const resolvedModule = resolveAssetModule(path);
    if (seenModules.has(resolvedModule)) {
      return;
    }

    seenModules.add(resolvedModule);
    specs.push({key, path});
  };

  SOLAR_SYSTEM_CONFIG.forEach((planet) => {
    addSpec(planet.textureKey, planet.textureModule);
    planet.moons.forEach((moon) => {
      addSpec(moon.textureKey, moon.textureModule);
    });
    if (planet.ring) {
      addSpec(`${planet.textureKey}_ring`, planet.ring.textureModule);
    }
  });

  return specs;
};

export class SolarSystemPreloader {
  private static preloadedSystem: PreloadedSolarSystem | null = null;
  private static preloadPromise: Promise<PreloadedSolarSystem> | null = null;
  private static isPreloading = false;
  private static isPreloaded = false;
  private static textureCache: TextureCache = createTextureCache();
  private static progressListeners = new Set<(progress: SolarSystemPreloadProgress) => void>();
  private static readonly textureLoadTimeoutMs = 15000;

  private static addProgressListener(onProgress?: (progress: SolarSystemPreloadProgress) => void): () => void {
    if (!onProgress) {
      return () => undefined;
    }

    this.progressListeners.add(onProgress);
    return () => {
      this.progressListeners.delete(onProgress);
    };
  }

  private static emitProgress(progress: SolarSystemPreloadProgress): void {
    this.progressListeners.forEach((listener) => {
      listener(progress);
    });
  }

  private static resetState(): void {
    this.preloadedSystem = null;
    this.preloadPromise = null;
    this.isPreloaded = false;
    this.isPreloading = false;
  }

  private static async preloadTextures(): Promise<TextureCache> {
    if (this.textureCache.size > 0) {
      logger.debug("SolarSystemPreloader: Textures already preloaded, returning cache");
      return this.textureCache;
    }

    const textureSpecs = getSolarTexturePreloadSpecs();
    const textures = await preloadTexturesStage(textureSpecs, this.textureLoadTimeoutMs, (progress) => {
      this.emitProgress({
        phase: "textures",
        loaded: progress.loaded,
        total: progress.total,
        currentItem: progress.currentTexture,
        percentage: Math.round((progress.loaded / progress.total) * 100),
        textureProgress: progress,
      });
    });

    this.textureCache = createTextureCache();
    textureSpecs.forEach((spec) => {
      const texture = textures.get(spec.key);
      if (texture) {
        this.textureCache.set(resolveAssetModule(spec.path), texture);
      }
    });

    return this.textureCache;
  }

  private static async runPreload(): Promise<PreloadedSolarSystem> {
    try {
      logger.debug("SolarSystemPreloader: Starting solar system texture preloading...");
      console.time("SolarSystemPreloader: Total preload time");

      const textures = await this.preloadTextures();
      this.preloadedSystem = {textures};
      this.isPreloaded = true;

      this.emitProgress({
        phase: "complete",
        loaded: 100,
        total: 100,
        currentItem: "Solar system ready",
        percentage: 100,
      });

      logger.debug(`SolarSystemPreloader: ready with ${this.preloadedSystem.textures.size} textures`);
      return this.preloadedSystem;
    } catch (error) {
      logger.error("SolarSystemPreloader: Critical error during preloading:", error);
      captureException(error, {context: "SolarSystemPreloader.preloadSolarSystem"});
      this.resetState();
      throw error instanceof Error ? error : new Error(`Solar system preloading failed: ${String(error)}`);
    } finally {
      this.isPreloading = false;
      this.preloadPromise = null;
      console.timeEnd("SolarSystemPreloader: Total preload time");
    }
  }

  static async preloadSolarSystem(
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): Promise<PreloadedSolarSystem> {
    const removeProgressListener = this.addProgressListener(onProgress);

    if (this.isPreloaded && this.preloadedSystem) {
      logger.debug("SolarSystemPreloader: System already preloaded, returning cached version");
      removeProgressListener();
      return this.preloadedSystem;
    }

    if (this.preloadPromise) {
      logger.debug("SolarSystemPreloader: System is currently preloading, reusing in-flight preload");
      return this.preloadPromise.finally(removeProgressListener);
    }

    if (this.isPreloading) {
      logger.warn("SolarSystemPreloader: Stale preload flag detected; restarting.");
      this.resetState();
    }

    this.isPreloading = true;
    this.preloadPromise = this.runPreload();
    return this.preloadPromise.finally(removeProgressListener);
  }

  static getPreloadedSystem(): PreloadedSolarSystem | null {
    return this.preloadedSystem;
  }

  static isSystemPreloaded(): boolean {
    return this.isPreloaded;
  }

  static clonePreloadedScene(): PreloadedSolarSystem | null {
    return this.preloadedSystem;
  }

  static getPreloadedTexture(assetModule: AssetModuleReference): Texture | null {
    return this.textureCache.get(resolveAssetModule(assetModule)) ?? null;
  }

  static clearCache(): void {
    logger.debug("SolarSystemPreloader: Clearing all caches...");
    disposeAndClearTextureCache(this.textureCache);
    this.resetState();
    this.progressListeners.clear();
    this.textureCache = createTextureCache();
    logger.debug("SolarSystemPreloader: All caches cleared successfully");
  }
}
