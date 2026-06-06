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
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadTextureFromAsset.mockReset();
    mockLoadTextureFromAsset.mockResolvedValue(new Texture());
    setTimeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });
    SolarSystemPreloader.clearCache();
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
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

  it("returns preloaded system when another preload finishes while waiting", async () => {
    (SolarSystemPreloader as any).isPreloaded = false;
    (SolarSystemPreloader as any).isPreloading = true;
    const waitingResult = {
      scene: {} as any,
      camera: {} as any,
      planetsGroup: {} as any,
      meshes: [],
      lights: [],
      geometries: new Map(),
      materials: new Map(),
      textures: new Map(),
    };
    (SolarSystemPreloader as any).preloadedSystem = waitingResult;

    setTimeoutSpy.mockImplementationOnce((fn: any) => {
      (SolarSystemPreloader as any).isPreloading = false;
      fn();
      return 0 as any;
    });

    const result = await SolarSystemPreloader.preloadSolarSystem();

    expect(result).toBeDefined();
    expect(SolarSystemPreloader.isSystemPreloaded()).toBe(true);
  });

  it("resets stuck preload flag after wait timeout", async () => {
    (SolarSystemPreloader as any).isPreloaded = false;
    (SolarSystemPreloader as any).isPreloading = true;
    (SolarSystemPreloader as any).preloadedSystem = null;

    const original = setTimeoutSpy;
    original.mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });

    await SolarSystemPreloader.preloadSolarSystem();

    expect((SolarSystemPreloader as any).isPreloading).toBe(false);
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
