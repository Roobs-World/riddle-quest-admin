/**
 * @fileoverview Strict texture preload stage for the solar-system background.
 */
import {Texture} from "three";
import type {AssetModuleReference} from "./textureLoader";
import {loadTextureFromAsset} from "./textureLoader";

export interface TexturePreloadProgress {
  loaded: number;
  total: number;
  currentTexture: string;
  percentage: number;
}

export interface TexturePreloadSpec {
  key: string;
  path: AssetModuleReference;
}

export const preloadTexturesStage = async (
  specs: TexturePreloadSpec[],
  timeoutMs: number,
  onProgress?: (progress: TexturePreloadProgress) => void,
): Promise<Map<string, Texture>> => {
  const loadedTextures = new Map<string, Texture>();
  const total = specs.length;
  let loaded = 0;

  const loadWithTimeout = async (spec: TexturePreloadSpec): Promise<void> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const texture = await Promise.race([
        loadTextureFromAsset(spec.path, spec.key),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Texture ${spec.key} timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);

      loadedTextures.set(spec.key, texture);
      loaded += 1;
      onProgress?.({
        loaded,
        total,
        currentTexture: spec.key,
        percentage: Math.round((loaded / total) * 100),
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  await Promise.all(specs.map((spec) => loadWithTimeout(spec)));
  return loadedTextures;
};
