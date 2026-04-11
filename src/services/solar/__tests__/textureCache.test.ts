import { Texture } from "three";
import {
  createTextureCache,
  disposeAndClearTextureCache,
} from "../textureCache";

describe("textureCache", () => {
  it("creates an empty texture cache", () => {
    const cache = createTextureCache();
    expect(cache.size).toBe(0);
  });

  it("disposes textures and clears cache", () => {
    const cache = createTextureCache();
    const texture = new Texture();
    const disposeSpy = jest.spyOn(texture, "dispose");

    cache.set("t1", texture);
    cache.set("t2", null);

    disposeAndClearTextureCache(cache);

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
  });
});
