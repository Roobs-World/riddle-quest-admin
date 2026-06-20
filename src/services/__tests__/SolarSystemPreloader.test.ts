import {Texture} from "three";
import {SolarSystemPreloader} from "../SolarSystemPreloader";

jest.mock("../../utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

jest.mock("../solar/textureLoader", () => ({
  loadTextureFromAsset: jest.fn(async () => new (require("three").Texture)()),
  resolveAssetModule: jest.fn((assetModule) => {
    if (assetModule && typeof assetModule === "object" && "default" in assetModule) {
      return assetModule.default;
    }
    return assetModule;
  }),
}));

const {loadTextureFromAsset} = require("../solar/textureLoader");
const {captureException} = require("../../utils/sentry");
const {logger} = require("../../utils/logger");
const mockLoadTextureFromAsset = loadTextureFromAsset as jest.Mock;

describe("SolarSystemPreloader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadTextureFromAsset.mockReset();
    mockLoadTextureFromAsset.mockResolvedValue(new Texture());
    SolarSystemPreloader.clearCache();
  });

  it("preloads and caches the solar system textures", async () => {
    const progressEvents: string[] = [];

    const system = await SolarSystemPreloader.preloadSolarSystem((progress) => {
      progressEvents.push(progress.phase);
    });

    expect(system.textures.size).toBeGreaterThan(0);
    expect(progressEvents).toContain("textures");
    expect(progressEvents).not.toContain("geometries");
    expect(progressEvents).not.toContain("materials");
    expect(progressEvents).not.toContain("scene");
    expect(progressEvents).toContain("complete");
    expect("meshes" in system).toBe(false);
    expect(SolarSystemPreloader.isSystemPreloaded()).toBe(true);
    expect(SolarSystemPreloader.getPreloadedSystem()).toBe(system);
  });

  it("reuses cached preload on subsequent calls", async () => {
    await SolarSystemPreloader.preloadSolarSystem();
    const firstCallCount = loadTextureFromAsset.mock.calls.length;

    const second = await SolarSystemPreloader.preloadSolarSystem();

    expect(second).toBe(SolarSystemPreloader.getPreloadedSystem());
    expect(loadTextureFromAsset.mock.calls.length).toBe(firstCallCount);
  });

  it("returns cached textures immediately when preloadTextures has cache", async () => {
    (SolarSystemPreloader as any).textureCache.set("already", new Texture());

    const textures = await (SolarSystemPreloader as any).preloadTextures();

    expect(textures.get("already")).toBeInstanceOf(Texture);
  });

  it("reuses the in-flight preload for concurrent callers", async () => {
    let resolveTextureLoad: (texture: Texture) => void = () => undefined;
    const textureLoad = new Promise<Texture>((resolve) => {
      resolveTextureLoad = resolve;
    });
    mockLoadTextureFromAsset.mockReturnValue(textureLoad);

    const firstProgressEvents: string[] = [];
    const secondProgressEvents: string[] = [];
    const first = SolarSystemPreloader.preloadSolarSystem((progress) => {
      firstProgressEvents.push(progress.phase);
    });
    const second = SolarSystemPreloader.preloadSolarSystem((progress) => {
      secondProgressEvents.push(progress.phase);
    });

    await Promise.resolve();
    const callsWhilePending = loadTextureFromAsset.mock.calls.length;

    resolveTextureLoad(new Texture());
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(secondResult).toBe(firstResult);
    expect(loadTextureFromAsset.mock.calls.length).toBe(callsWhilePending);
    expect(firstProgressEvents).toContain("complete");
    expect(secondProgressEvents).toContain("complete");
  });

  it("does not build scene resources while texture loading is still pending", async () => {
    let resolveTextureLoad: (texture: Texture) => void = () => undefined;
    const textureLoad = new Promise<Texture>((resolve) => {
      resolveTextureLoad = resolve;
    });
    mockLoadTextureFromAsset.mockReturnValue(textureLoad);

    const progressEvents: string[] = [];
    const preload = SolarSystemPreloader.preloadSolarSystem((progress) => {
      progressEvents.push(progress.phase);
    });

    await Promise.resolve();
    expect(progressEvents).not.toContain("geometries");
    expect(progressEvents).not.toContain("materials");
    expect(progressEvents).not.toContain("scene");

    resolveTextureLoad(new Texture());
    await preload;
    expect(progressEvents).toContain("complete");
  });

  it("resets stale preload flag before starting a new preload", async () => {
    (SolarSystemPreloader as any).isPreloaded = false;
    (SolarSystemPreloader as any).isPreloading = true;
    (SolarSystemPreloader as any).preloadedSystem = null;

    await SolarSystemPreloader.preloadSolarSystem();

    expect((SolarSystemPreloader as any).isPreloading).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith("SolarSystemPreloader: Stale preload flag detected; restarting.");
  });

  it("fails fast when a required texture load fails", async () => {
    loadTextureFromAsset.mockImplementation(async (_path: string, key: string) => {
      if (key === "planet_a") {
        throw new Error("texture fail");
      }
      return new Texture();
    });

    await expect(SolarSystemPreloader.preloadSolarSystem()).rejects.toThrow("texture fail");
    expect(captureException).toHaveBeenCalled();
  });

  it("supports cached lookup and clear cache", async () => {
    await SolarSystemPreloader.preloadSolarSystem();

    const system = SolarSystemPreloader.getPreloadedSystem();
    expect(system).not.toBeNull();
    const firstTextureKey = Array.from(system?.textures.keys() ?? [])[0];
    expect(SolarSystemPreloader.getPreloadedTexture(firstTextureKey)).toBe(system?.textures.get(firstTextureKey));

    SolarSystemPreloader.clearCache();
    expect(SolarSystemPreloader.isSystemPreloaded()).toBe(false);
    expect(SolarSystemPreloader.getPreloadedSystem()).toBeNull();
    expect(SolarSystemPreloader.getPreloadedTexture(firstTextureKey)).toBeNull();
  });
});
