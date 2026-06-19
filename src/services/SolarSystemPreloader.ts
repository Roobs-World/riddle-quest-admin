/**
 * @fileoverview Strict preload coordinator for the solar-system background.
 */
import {type Texture} from "three";
import {logger} from "../utils/logger";
import {captureException} from "../utils/sentry";
import {SOLAR_TEXTURE_MAPPING} from "./solar/solarSystemConfig";
import {createTextureCache, disposeAndClearTextureCache, type TextureCache} from "./solar/textureCache";
import {preloadTexturesStage, type TexturePreloadProgress} from "./solar/textureStage";
import {createGeometriesStage, type GeometryProgress, type SolarGeometry} from "./solar/geometryStage";
import {createMaterialsStage, type MaterialProgress, type SolarMaterial} from "./solar/materialStage";
import {assembleSolarSystemScene, type PreloadedSolarSystem} from "./solar/sceneStage";

export interface SolarSystemPreloadProgress {
  phase: "textures" | "geometries" | "materials" | "scene" | "complete";
  loaded: number;
  total: number;
  currentItem: string;
  percentage: number;
  textureProgress?: TexturePreloadProgress;
}

export type {PreloadedSolarSystem};

export class SolarSystemPreloader {
  private static preloadedSystem: PreloadedSolarSystem | null = null;
  private static isPreloading = false;
  private static isPreloaded = false;
  private static textureCache: TextureCache = createTextureCache();
  private static readonly textureLoadTimeoutMs = 15000;

  private static emitProgress(
    onProgress: ((progress: SolarSystemPreloadProgress) => void) | undefined,
    progress: SolarSystemPreloadProgress,
  ): void {
    onProgress?.(progress);
  }

  private static resetState(): void {
    this.preloadedSystem = null;
    this.isPreloaded = false;
    this.isPreloading = false;
  }

  private static async waitForExistingPreload(): Promise<PreloadedSolarSystem | null> {
    let waitTime = 0;
    const maxWaitTime = 10000;

    while (this.isPreloading && waitTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitTime += 100;
    }

    if (this.isPreloaded && this.preloadedSystem) {
      return this.preloadedSystem;
    }

    if (waitTime >= maxWaitTime) {
      logger.warn("SolarSystemPreloader: Existing preload did not finish in time; restarting.");
      this.resetState();
    }

    return null;
  }

  private static async preloadTextures(
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): Promise<Map<string, Texture>> {
    if (this.textureCache.size > 0) {
      logger.debug("SolarSystemPreloader: Textures already preloaded, returning cache");
      return this.textureCache;
    }

    const textures = await preloadTexturesStage(SOLAR_TEXTURE_MAPPING, this.textureLoadTimeoutMs, (progress) => {
      this.emitProgress(onProgress, {
        phase: "textures",
        loaded: progress.loaded,
        total: progress.total,
        currentItem: progress.currentTexture,
        percentage: Math.round((progress.loaded / progress.total) * 30),
        textureProgress: progress,
      });
    });

    this.textureCache = createTextureCache();
    textures.forEach((texture, key) => {
      this.textureCache.set(key, texture);
    });

    return textures;
  }

  private static async createGeometries(
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): Promise<Map<string, SolarGeometry>> {
    return createGeometriesStage((progress: GeometryProgress) => {
      this.emitProgress(onProgress, {
        phase: "geometries",
        loaded: progress.loaded,
        total: progress.total,
        currentItem: progress.currentItem,
        percentage: 30 + Math.round((progress.loaded / progress.total) * 15),
      });
    });
  }

  private static async createMaterials(
    textures: Map<string, Texture>,
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): Promise<Map<string, SolarMaterial>> {
    return createMaterialsStage(textures, (progress: MaterialProgress) => {
      this.emitProgress(onProgress, {
        phase: "materials",
        loaded: progress.loaded,
        total: progress.total,
        currentItem: progress.currentItem,
        percentage: 45 + Math.round((progress.loaded / progress.total) * 15),
      });
    });
  }

  private static async createCompleteScene(
    geometries: Map<string, SolarGeometry>,
    materials: Map<string, SolarMaterial>,
    textures: Map<string, Texture>,
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): Promise<PreloadedSolarSystem> {
    return assembleSolarSystemScene(geometries, materials, textures, (loaded, total, current) => {
      this.emitProgress(onProgress, {
        phase: "scene",
        loaded,
        total,
        currentItem: current,
        percentage: 60 + Math.round((loaded / total) * 40),
      });
    });
  }

  static async preloadSolarSystem(
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): Promise<PreloadedSolarSystem> {
    if (this.isPreloaded && this.preloadedSystem) {
      logger.debug("SolarSystemPreloader: System already preloaded, returning cached version");
      return this.preloadedSystem;
    }

    if (this.isPreloading) {
      logger.debug("SolarSystemPreloader: System is currently preloading, waiting...");
      const existing = await this.waitForExistingPreload();
      if (existing) {
        return existing;
      }
    }

    this.isPreloading = true;

    try {
      logger.debug("SolarSystemPreloader: Starting solar system preloading...");
      console.time("SolarSystemPreloader: Total preload time");

      const textures = await this.preloadTextures(onProgress);
      const geometries = await this.createGeometries(onProgress);
      const materials = await this.createMaterials(textures, onProgress);
      this.preloadedSystem = await this.createCompleteScene(geometries, materials, textures, onProgress);

      this.isPreloaded = true;

      this.emitProgress(onProgress, {
        phase: "complete",
        loaded: 100,
        total: 100,
        currentItem: "Solar system ready",
        percentage: 100,
      });

      logger.debug(`SolarSystemPreloader: ready with ${this.preloadedSystem.meshes.length} meshes`);
      return this.preloadedSystem;
    } catch (error) {
      logger.error("SolarSystemPreloader: Critical error during preloading:", error);
      captureException(error, {context: "SolarSystemPreloader.preloadSolarSystem"});
      this.resetState();
      throw error instanceof Error ? error : new Error(`Solar system preloading failed: ${String(error)}`);
    } finally {
      this.isPreloading = false;
      console.timeEnd("SolarSystemPreloader: Total preload time");
    }
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

  static clearCache(): void {
    logger.debug("SolarSystemPreloader: Clearing all caches...");
    disposeAndClearTextureCache(this.textureCache);
    this.resetState();
    this.textureCache = createTextureCache();
    logger.debug("SolarSystemPreloader: All caches cleared successfully");
  }
}
