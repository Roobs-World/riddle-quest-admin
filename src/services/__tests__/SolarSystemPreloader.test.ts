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

  it("preloads and caches the solar system", async () => {
    const progressEvents: string[] = [];

    const system = await SolarSystemPreloader.preloadSolarSystem((progress) => {
      progressEvents.push(progress.phase);
    });

    expect(system.meshes.length).toBeGreaterThan(0);
    expect(system.geometries.size).toBeGreaterThan(0);
    expect(system.materials.size).toBeGreaterThan(0);
    expect(system.textures.size).toBeGreaterThan(0);
    expect(progressEvents).toContain("textures");
    expect(progressEvents).toContain("geometries");
    expect(progressEvents).toContain("materials");
    expect(progressEvents).toContain("scene");
    expect(progressEvents).toContain("complete");
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

  it("creates geometries while texture loading is still pending", async () => {
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
    expect(progressEvents).toContain("geometries");
    expect(progressEvents).not.toContain("materials");

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

  it("supports clone and clear cache", async () => {
    await SolarSystemPreloader.preloadSolarSystem();

    const clone = SolarSystemPreloader.clonePreloadedScene();
    expect(clone).toBe(SolarSystemPreloader.getPreloadedSystem());

    SolarSystemPreloader.clearCache();
    expect(SolarSystemPreloader.isSystemPreloaded()).toBe(false);
    expect(SolarSystemPreloader.getPreloadedSystem()).toBeNull();
    expect(SolarSystemPreloader.clonePreloadedScene()).toBeNull();
  });

  it("rejects missing geometry during scene assembly", async () => {
    const geometries = new Map<string, any>();
    const materials = new Map<string, any>();
    const textures = new Map<string, any>();

    await expect((SolarSystemPreloader as any).createCompleteScene(geometries, materials, textures)).rejects.toThrow(
      "Missing required sun geometry",
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
