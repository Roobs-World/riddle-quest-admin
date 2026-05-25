import {TextureDebugger} from "../TextureDebugger";

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: jest.fn(),
  },
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

const {Asset} = require("expo-asset");
const {logger} = require("../../utils/logger");
const {captureException} = require("../../utils/sentry");

describe("TextureDebugger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tests a single asset successfully", async () => {
    Asset.fromModule.mockReturnValue({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: "file://mock-texture.png",
    });

    const result = await TextureDebugger.testSingleAsset(123, "single");

    expect(result).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("single"));
  });

  it("returns false and reports when single asset load fails", async () => {
    Asset.fromModule.mockImplementation(() => {
      throw new Error("asset fail");
    });

    const result = await TextureDebugger.testSingleAsset(123, "broken");

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });

  it("iterates all assets and records failures", async () => {
    Asset.fromModule
      .mockImplementationOnce(() => {
        throw new Error("first fail");
      })
      .mockImplementation(() => ({
        name: "mock",
        downloadAsync: jest.fn().mockResolvedValue(undefined),
        localUri: "file://ok.png",
      }));

    await TextureDebugger.testAllAssets();

    expect(Asset.fromModule).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("first fail"));
  });

  it("handles localUri validation failures in bulk run", async () => {
    Asset.fromModule.mockReturnValue({
      name: "bad-uri",
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: "bad",
    });

    await TextureDebugger.testAllAssets();

    expect(logger.error).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });

  it("logs all-success summary when every asset validates", async () => {
    Asset.fromModule.mockReturnValue({
      name: "ok",
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: "file://this-is-a-valid-local-uri.png",
    });

    await TextureDebugger.testAllAssets();

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("All texture assets loaded successfully"));
  });

  it("returns false for single asset when localUri is missing", async () => {
    Asset.fromModule.mockReturnValue({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: "",
    });

    const result = await TextureDebugger.testSingleAsset(999, "missing-uri");

    expect(result).toBe(false);
    expect(captureException).toHaveBeenCalled();
  });
});
