import {LinearFilter} from "three";
import {createTextureFromAsset, loadTextureFromAsset} from "../textureLoader";

jest.mock("expo-asset", () => ({
  Asset: {
    loadAsync: jest.fn(),
  },
}));

const mockNativeDownloadAsync = jest.fn();
jest.mock("expo", () => ({
  requireNativeModule: () => ({
    downloadAsync: (...args: unknown[]) => mockNativeDownloadAsync(...args),
  }),
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("../../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

const {Asset} = require("expo-asset");
const {logger} = require("../../../utils/logger");
const {captureException} = require("../../../utils/sentry");

describe("textureLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeDownloadAsync.mockResolvedValue("file:///mock-copied-texture.png");
  });

  it("creates a texture from resolved asset metadata", () => {
    const asset = {
      width: 100,
      height: 200,
    } as any;

    const texture = createTextureFromAsset(asset);
    expect(texture.version).toBeGreaterThan(0);
    expect(texture.minFilter).toBe(LinearFilter);
    expect((texture as any).isDataTexture).toBe(true);
    expect((texture.image as any).width).toBe(100);
  });

  it("loads texture from module asset", async () => {
    Asset.loadAsync.mockResolvedValue([
      {
        localUri: "file:///mock-texture.png",
        width: 10,
        height: 10,
      },
    ]);

    const texture = await loadTextureFromAsset("path", "cache-key");

    expect(Asset.loadAsync).toHaveBeenCalledWith("path");
    expect(texture).toBeDefined();
  });

  it("copies embedded assets to file uris before creating textures", async () => {
    Asset.loadAsync.mockResolvedValue([
      {
        downloaded: true,
        hash: "asset-hash",
        localUri: "assets_3d_tex_planet_a",
        name: "tex_planet_a",
        type: "png",
        uri: "assets_3d_tex_planet_a",
        width: 10,
        height: 10,
      },
    ]);

    const texture = await loadTextureFromAsset("path", "cache-key");

    expect(mockNativeDownloadAsync).toHaveBeenCalledWith("assets_3d_tex_planet_a", "asset-hash", "png");
    expect((texture.image as any).localUri).toBe("file:///mock-copied-texture.png");
  });

  it("throws without capturing expected asset transport failures", async () => {
    Asset.loadAsync.mockRejectedValue(new Error("boom"));

    await expect(loadTextureFromAsset("path", "cache-key")).rejects.toThrow("Texture loading failed for cache-key");

    expect(logger.error).toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
