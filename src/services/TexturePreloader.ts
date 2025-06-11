import { TextureLoader, Texture } from "three";
import { Asset } from "expo-asset";

// Import texture assets using relative path to assets
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

export interface TexturePreloadProgress {
  loaded: number;
  total: number;
  currentTexture: string;
  percentage: number;
}

export class TexturePreloader {
  private static textureCache = new Map<string, Texture | null>();
  private static isPreloading = false;
  private static isPreloaded = false;

  // Define texture mapping for solar system
  private static readonly textureMapping = [
    { key: "mercury", path: texPlanetR },
    { key: "venus", path: texPlanetV },
    { key: "earth", path: texPlanetA },
    { key: "mars", path: texPlanetD },
    { key: "jupiter", path: texPlanetK },
    { key: "ring_venus", path: texRingA },
    { key: "ring_jupiter", path: texRingB },
    { key: "moon_earth_0", path: texMoonH },
    { key: "moon_mars_0", path: texMoonF },
    { key: "moon_mars_1", path: texMoonG },
    { key: "moon_jupiter_0", path: texMoonC },
    { key: "moon_jupiter_1", path: texMoonD },
    // Gradient textures for glowing effects
    { key: "glow_planet", path: texGradientCircle },
    { key: "glow_sun", path: texGradientCircleSun },
  ];

  /**
   * Load texture from bundled asset using expo-asset - TRUE LOCAL LOADING
   */
  private static async loadTextureFromAsset(
    loader: TextureLoader,
    assetId: number,
    cacheKey: string
  ): Promise<Texture> {
    console.time(`TexturePreloader: Load ${cacheKey}`);

    try {
      console.log(
        `TexturePreloader: Loading ${cacheKey} from bundled asset using expo-asset`
      );

      // Use expo-asset to get proper local URI for bundled assets
      const asset = Asset.fromModule(assetId);
      await asset.downloadAsync(); // Ensure asset is available locally

      console.log(
        `TexturePreloader: Asset ${cacheKey} local URI: ${asset.localUri}`
      );

      // Load texture using the local URI (no network dependency)
      const texture = loader.load(asset.localUri || asset.uri);

      console.timeEnd(`TexturePreloader: Load ${cacheKey}`);
      console.log(
        `TexturePreloader: ✅ Successfully loaded ${cacheKey} from bundled asset`
      );

      return texture;
    } catch (error) {
      console.error(
        `TexturePreloader: ❌ Failed to load ${cacheKey} from bundled asset:`,
        error
      );
      console.error(`TexturePreloader: Asset ID was: ${assetId}`);
      console.error(
        `TexturePreloader: This indicates an issue with asset bundling or expo-asset compatibility`
      );
      throw error;
    }
  }

  /**
   * Preload all solar system textures - FAULT-TOLERANT VERSION
   */
  static async preloadTextures(
    onProgress?: (progress: TexturePreloadProgress) => void
  ): Promise<Map<string, Texture | null>> {
    if (this.isPreloaded && this.textureCache.size > 0) {
      console.log(
        "TexturePreloader: Textures already preloaded, returning cache"
      );
      return this.textureCache;
    }

    if (this.isPreloading) {
      console.log(
        "TexturePreloader: Preloading already in progress, waiting..."
      );
      // Wait for current preloading to complete
      while (this.isPreloading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.textureCache;
    }

    console.log(
      "TexturePreloader: Starting fault-tolerant texture preloading..."
    );
    console.time("TexturePreloader: Total preload time");

    this.isPreloading = true;

    // Debug: Log all texture paths
    console.log("TexturePreloader: Texture mapping paths:");
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
        `TexturePreloader: Loading batch ${Math.floor(i / BATCH_SIZE) + 1} (${
          batch.length
        } textures)`
      );

      const batchPromises = batch.map(async ({ key, path }) => {
        try {
          const texture = await this.loadTextureFromAsset(
            textureLoader,
            path,
            key
          );
          this.textureCache.set(key, texture);
          console.log(`TexturePreloader: ✅ Successfully loaded ${key}`);

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
            `TexturePreloader: ⚠️ Failed to load ${key}, continuing anyway:`,
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

    console.timeEnd("TexturePreloader: Total preload time");

    const successful = Array.from(this.textureCache.values()).filter(
      (t) => t !== null
    ).length;
    const failed = total - successful;

    console.log(
      `TexturePreloader: ✅ Preloading complete - ${successful} successful, ${failed} failed`
    );

    if (failed > 0) {
      const failedKeys = Array.from(this.textureCache.entries())
        .filter(([, texture]) => texture === null)
        .map(([key]) => key);
      console.warn(
        `TexturePreloader: ⚠️ Failed textures (will use fallbacks): ${failedKeys.join(
          ", "
        )}`
      );
    }

    // Mark as preloaded even if some textures failed - solar system can still work
    this.isPreloaded = true;
    this.isPreloading = false;

    console.log(
      "TexturePreloader: 🎯 Texture preloading completed with fault tolerance"
    );
    return this.textureCache;
  }

  /**
   * Get preloaded textures
   */
  static getPreloadedTextures(): Map<string, Texture | null> {
    return this.textureCache;
  }

  /**
   * Check if textures are preloaded
   */
  static isTexturesPreloaded(): boolean {
    return this.isPreloaded;
  }

  /**
   * Clear texture cache
   */
  static clearCache(): void {
    console.log("TexturePreloader: Clearing texture cache...");
    this.textureCache.forEach((texture) => {
      if (texture) {
        texture.dispose();
      }
    });
    this.textureCache.clear();
    this.isPreloaded = false;
    this.isPreloading = false;
    console.log("TexturePreloader: Cache cleared");
  }
}
