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
  private static preloadPromise: Promise<PreloadedSolarSystem> | null = null;
  private static isPreloading = false;
  private static isPreloaded = false;
  private static textureCache: TextureCache = createTextureCache();
  private static progressListeners = new Set<(progress: SolarSystemPreloadProgress) => void>();
  private static readonly textureLoadTimeoutMs = 15000;

  private static addProgressListener(
    onProgress?: (progress: SolarSystemPreloadProgress) => void,
  ): () => void {
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

  private static async preloadTextures(): Promise<Map<string, Texture>> {
    if (this.textureCache.size > 0) {
      logger.debug("SolarSystemPreloader: Textures already preloaded, returning cache");
      return this.textureCache;
    }

    const textures = await preloadTexturesStage(SOLAR_TEXTURE_MAPPING, this.textureLoadTimeoutMs, (progress) => {
      this.emitProgress({
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

  private static async createGeometries(): Promise<Map<string, SolarGeometry>> {
    return createGeometriesStage((progress: GeometryProgress) => {
      this.emitProgress({
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
  ): Promise<Map<string, SolarMaterial>> {
    return createMaterialsStage(textures, (progress: MaterialProgress) => {
      this.emitProgress({
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
  ): Promise<PreloadedSolarSystem> {
    return assembleSolarSystemScene(geometries, materials, textures, (loaded, total, current) => {
      this.emitProgress({
        phase: "scene",
        loaded,
        total,
        currentItem: current,
        percentage: 60 + Math.round((loaded / total) * 40),
      });
    });
  }

  private static async runPreload(): Promise<PreloadedSolarSystem> {
    try {
      logger.debug("SolarSystemPreloader: Starting solar system preloading...");
      console.time("SolarSystemPreloader: Total preload time");

      const [textures, geometries] = await Promise.all([this.preloadTextures(), this.createGeometries()]);
      const materials = await this.createMaterials(textures);
      this.preloadedSystem = await this.createCompleteScene(geometries, materials, textures);

      this.isPreloaded = true;

      this.emitProgress({
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

  static clearCache(): void {
    logger.debug("SolarSystemPreloader: Clearing all caches...");
    disposeAndClearTextureCache(this.textureCache);
    this.resetState();
    this.progressListeners.clear();
    this.textureCache = createTextureCache();
    logger.debug("SolarSystemPreloader: All caches cleared successfully");
  }
}
