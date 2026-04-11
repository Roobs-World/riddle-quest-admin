import { LinearFilter } from "three";
import { createTextureFromAsset, loadTextureFromAsset } from "../textureLoader";

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn(),
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

const { Asset } = require("expo-asset");
const { logger } = require("../../../utils/logger");
const { captureException } = require("../../../utils/sentry");

describe("textureLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a data texture from asset metadata", () => {
    const asset = {
      width: 100,
      height: 200,
    } as any;

    const texture = createTextureFromAsset(asset);
    expect(texture.version).toBeGreaterThan(0);
    expect((texture as any).isDataTexture).toBe(true);
    expect(texture.minFilter).toBe(LinearFilter);
    expect((texture.image as any).width).toBe(100);
  });

  it("loads texture from module asset", async () => {
    const downloadAsync = jest.fn().mockResolvedValue(undefined);
    Asset.fromModule.mockReturnValue({
      downloaded: false,
      downloadAsync,
      width: 10,
      height: 10,
    });

    const texture = await loadTextureFromAsset("path", "cache-key");

    expect(downloadAsync).toHaveBeenCalledTimes(1);
    expect(texture).toBeDefined();
  });

  it("throws and reports when load fails", async () => {
    Asset.fromModule.mockImplementation(() => {
      throw new Error("boom");
    });

    await expect(loadTextureFromAsset("path", "cache-key")).rejects.toThrow(
      "Texture loading failed for cache-key"
    );

    expect(logger.error).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });
});
