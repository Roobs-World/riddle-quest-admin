/**
 * @fileoverview Texture loading utilities for Expo assets -> Three.js textures.
 */
import { Asset } from "expo-asset";
import { LinearFilter, Texture } from "three";
import { captureException } from "../../utils/sentry";
import { logger } from "../../utils/logger";

/**
 * Builds a Three.js texture from an already-resolved Expo asset object.
 *
 * @param asset Downloaded Expo asset metadata.
 * @returns Texture configured for expo-gl compatibility.
 */
export const createTextureFromAsset = (asset: Asset): Texture => {
  const texture = new Texture();
  (texture.image as unknown) = {
    data: asset,
    width: asset.width,
    height: asset.height,
  };
  texture.needsUpdate = true;
  (texture as unknown as { isDataTexture: boolean }).isDataTexture = true;
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
export const loadTextureFromAsset = async (
  assetPath: string | number,
  cacheKey: string
): Promise<Texture> => {
  try {
    const imageAsset = Asset.fromModule(assetPath);
    if (!imageAsset.downloaded) {
      await imageAsset.downloadAsync();
    }
    return createTextureFromAsset(imageAsset);
  } catch (error) {
    logger.error(`Texture loading failed for ${cacheKey}:`, error);
    captureException(error);
    throw new Error(`Texture loading failed for ${cacheKey}: ${error}`);
  }
};
