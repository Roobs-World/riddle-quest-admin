import {LinearFilter} from "three";
import {createTextureFromAsset, loadTextureFromAsset} from "../textureLoader";

jest.mock("expo-asset", () => ({
  Asset: {
    loadAsync: jest.fn(),
  },
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

  it("throws and reports when load fails", async () => {
    Asset.loadAsync.mockRejectedValue(new Error("boom"));

    await expect(loadTextureFromAsset("path", "cache-key")).rejects.toThrow("Texture loading failed for cache-key");

    expect(logger.error).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });
});
