/**
 * @fileoverview Helpers for managing disposable Three.js texture caches.
 */
import {Texture} from "three";

/** Cache shape for keyed texture instances. */
export type TextureCache = Map<string, Texture>;

/**
 * Creates a fresh texture cache map.
 *
 * @returns Empty `TextureCache`.
 */
export const createTextureCache = (): TextureCache => new Map<string, Texture>();

/**
 * Disposes every cached texture instance, then clears the cache map.
 *
 * @param cache Cache to dispose and clear.
 */
export const disposeAndClearTextureCache = (cache: TextureCache): void => {
  cache.forEach((texture) => {
    texture.dispose();
  });
  cache.clear();
};
