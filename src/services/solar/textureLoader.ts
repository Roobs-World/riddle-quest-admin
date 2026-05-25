/**
 * @fileoverview Texture loading utilities for Expo assets -> Three.js textures.
 */
import {Asset} from "expo-asset";
import {LinearFilter, Texture} from "three";
import {captureException} from "../../utils/sentry";
import {logger} from "../../utils/logger";

type AssetModuleReference = string | number | {default?: string | number; uri?: string};

const resolveAssetModule = (assetPath: AssetModuleReference): string | number => {
  if (typeof assetPath === "number" || typeof assetPath === "string") {
    return assetPath;
  }

  if (assetPath && (typeof assetPath.default === "number" || typeof assetPath.default === "string")) {
    return assetPath.default;
  }

  throw new Error("Unsupported texture asset module reference");
};

/**
 * Builds a Three.js texture from an already-resolved Expo asset object.
 *
 * @param asset Downloaded Expo asset metadata.
 * @returns Texture configured for expo-gl compatibility.
 */
export const createTextureFromAsset = (asset: Asset): Texture => {
  const uri = asset.localUri ?? asset.uri ?? null;
  const texture = new Texture();
  (texture.image as unknown) = {
    data: asset,
    localUri: uri,
    uri,
    width: asset.width ?? 1,
    height: asset.height ?? 1,
  };
  texture.needsUpdate = true;
  (texture as unknown as {isDataTexture: boolean}).isDataTexture = true;
  texture.minFilter = LinearFilter;
  return texture;
};

/**
 * Loads a texture from a bundled asset path and returns a Three.js texture.
 *
 * @param assetPath Asset module id/path.
 * @param cacheKey Logical key used for error context.
 * @returns Loaded texture.
 * @throws When asset fetch/download/texture creation fails.
 */
export const loadTextureFromAsset = async (assetPath: AssetModuleReference, cacheKey: string): Promise<Texture> => {
  try {
    const resolvedAssetModule = resolveAssetModule(assetPath);
    const [imageAsset] = await Asset.loadAsync(resolvedAssetModule);
    if (!imageAsset) {
      throw new Error("Asset.loadAsync returned no asset");
    }

    return createTextureFromAsset(imageAsset);
  } catch (error) {
    logger.error(`Texture loading failed for ${cacheKey}:`, error);
    captureException(error);
    throw new Error(`Texture loading failed for ${cacheKey}: ${error}`);
  }
};
