/**
 * @fileoverview Texture loading utilities for Expo assets -> Three.js textures.
 */
import {Asset} from "expo-asset";
import {requireNativeModule} from "expo";
import {ClampToEdgeWrapping, LinearFilter, Texture} from "three";
import {logger} from "../../utils/logger";

export type AssetModuleReference = string | number | {default?: string | number; uri?: string};

interface ExpoAssetModule {
  downloadAsync: (uri: string, md5Hash: string | null, type: string) => Promise<string>;
}

let expoAssetModule: ExpoAssetModule | null = null;

const getExpoAssetModule = (): ExpoAssetModule => {
  if (!expoAssetModule) {
    expoAssetModule = requireNativeModule("ExpoAsset") as ExpoAssetModule;
  }
  return expoAssetModule;
};

export const resolveAssetModule = (assetPath: AssetModuleReference): string | number => {
  if (typeof assetPath === "number" || typeof assetPath === "string") {
    return assetPath;
  }

  if (assetPath && (typeof assetPath.default === "number" || typeof assetPath.default === "string")) {
    return assetPath.default;
  }

  throw new Error("Unsupported texture asset module reference");
};

export const ensureFileUriAsset = async (asset: Asset): Promise<Asset> => {
  if (asset.localUri?.startsWith("file://")) {
    return asset;
  }

  const copiedUri = await getExpoAssetModule().downloadAsync(asset.uri, asset.hash, asset.type);
  asset.localUri = copiedUri;
  return asset;
};

/**
 * Builds a Three.js texture from an already-resolved Expo asset object.
 *
 * @param asset Downloaded Expo asset metadata.
 * @returns Texture configured for expo-gl compatibility.
 */
export const createTextureFromAsset = (asset: Asset): Texture => {
  const uri = asset.localUri ?? asset.uri ?? null;
  if (uri && !uri.startsWith("file://")) {
    throw new Error(`Texture asset ${asset.name || "unknown"} did not resolve to a file:// localUri`);
  }

  const image = {
    localUri: uri,
    uri,
    width: asset.width ?? 1,
    height: asset.height ?? 1,
  };

  const texture = new Texture();
  // Expo GL's native Android image loader reads `localUri` from the object
  // passed to texImage2D. Keep this as a plain object so JSI can read it
  // consistently from embedded release assets.
  (texture.image as unknown) = {
    data: image,
    ...image,
  };
  texture.needsUpdate = true;
  (texture as unknown as {isDataTexture: boolean}).isDataTexture = true;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.flipY = false;
  texture.unpackAlignment = 1;
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

    const fileAsset = await ensureFileUriAsset(imageAsset);
    return createTextureFromAsset(fileAsset);
  } catch (error) {
    logger.error(`Texture loading failed for ${cacheKey}:`, error);
    throw new Error(`Texture loading failed for ${cacheKey}: ${error}`);
  }
};
