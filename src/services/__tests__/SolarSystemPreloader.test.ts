import { SolarSystemPreloader } from "../SolarSystemPreloader";

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

jest.mock("../solar/solarSystemConfig", () => ({
  SOLAR_TEXTURE_MAPPING: [
    { key: "sun", path: "sun.png" },
    { key: "planet_a", path: "a.png" },
    { key: "moon_a_h", path: "h.png" },
    { key: "ring_planet_v", path: "r.png" },
    { key: "glow_sun", path: "g.png" },
  ],
  SOLAR_SYSTEM_CONFIG: [
    {
      id: "planet_a",
      texture: "a.png",
      orbitRadius: 10,
      orbitSpeed: 0.1,
      rotationSpeed: 0.01,
      radius: 2,
      materialType: "phong",
      moons: [{ texture: "h.png", orbitRadius: 5, orbitSpeed: 0.2, radius: 1 }],
      rings: { texture: "r.png", innerRadius: 3, outerRadius: 5 },
    },
    {
      id: "planet_v",
      texture: "v.png",
      orbitRadius: 20,
      orbitSpeed: 0.05,
      rotationSpeed: 0.02,
      radius: 3,
      materialType: "phong",
      rings: { texture: "r.png", innerRadius: 4, outerRadius: 7 },
    },
  ],
}));

jest.mock("../solar/textureLoader", () => ({
  loadTextureFromAsset: jest.fn(async () => ({ isMockTexture: true })),
}));

jest.mock("../solar/textureCache", () => ({
  createTextureCache: jest.fn(() => new Map()),
  disposeAndClearTextureCache: jest.fn((cache: Map<string, unknown>) => cache.clear()),
}));

jest.mock("../solar/sceneFactory", () => ({
  createSceneSetup: jest.fn(() => {
    const { Scene, PerspectiveCamera } = require("three");
    return {
      scene: new Scene(),
      camera: new PerspectiveCamera(60, 1, 0.1, 1000),
    };
  }),
  addEnhancedLights: jest.fn((scene, lights) => {
    const { AmbientLight } = require("three");
    const light = new AmbientLight(0xffffff, 1);
    scene.add(light);
    lights.push(light);
  }),
  addSunMeshes: jest.fn((scene, geometries, _textures, meshes) => {
    const { Mesh, MeshBasicMaterial, SphereGeometry } = require("three");
    const sunGeo = geometries.get("sun") || new SphereGeometry(1, 8, 8);
    const sun = new Mesh(sunGeo, new MeshBasicMaterial({ color: 0xffff00 }));
    scene.add(sun);
    meshes.push(sun);
  }),
}));

const { loadTextureFromAsset } = require("../solar/textureLoader");
const { captureException } = require("../../utils/sentry");
const { disposeAndClearTextureCache } = require("../solar/textureCache");
const { logger } = require("../../utils/logger");
const { createSceneSetup } = require("../solar/sceneFactory");
const { Scene, PerspectiveCamera, Group, SphereGeometry } = require("three");

describe("SolarSystemPreloader", () => {
  let setTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((fn: any) => {
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

    expect(system.scene).toBeInstanceOf(Scene);
    expect(system.camera).toBeInstanceOf(PerspectiveCamera);
    expect(system.planetsGroup).toBeInstanceOf(Group);
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
    (SolarSystemPreloader as any).textureCache.set("already", { mock: true });

    const textures = await (SolarSystemPreloader as any).preloadTextures();

    expect(textures.get("already")).toEqual({ mock: true });
  });

  it("returns preloaded system when another preload finishes while waiting", async () => {
    const waitingResult = {
      scene: new Scene(),
      camera: new PerspectiveCamera(60, 1, 0.1, 1000),
      planetsGroup: new Group(),
      meshes: [],
      lights: [],
      geometries: new Map(),
      materials: new Map(),
      textures: new Map(),
    };

    (SolarSystemPreloader as any).isPreloaded = false;
    (SolarSystemPreloader as any).isPreloading = true;
    (SolarSystemPreloader as any).preloadedSystem = waitingResult;

    setTimeoutSpy.mockImplementationOnce((fn: any) => {
      (SolarSystemPreloader as any).isPreloading = false;
      fn();
      return 0 as any;
    });

    const result = await SolarSystemPreloader.preloadSolarSystem();

    expect(result).toBe(waitingResult);
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

  it("keeps going when texture loading fails and stores fallback null", async () => {
    loadTextureFromAsset.mockImplementation(async (_path: string, key: string) => {
      if (key === "planet_a") {
        throw new Error("texture fail");
      }
      return { isMockTexture: true };
    });

    const system = await SolarSystemPreloader.preloadSolarSystem();

    expect(system.textures.has("planet_a")).toBe(true);
    expect(system.textures.get("planet_a")).toBeNull();
  });

  it("supports clone and clear cache", async () => {
    await SolarSystemPreloader.preloadSolarSystem();

    const clone = SolarSystemPreloader.clonePreloadedScene();
    expect(clone).toBe(SolarSystemPreloader.getPreloadedSystem());

    SolarSystemPreloader.clearCache();
    expect(disposeAndClearTextureCache).toHaveBeenCalled();
    expect(SolarSystemPreloader.isSystemPreloaded()).toBe(false);
    expect(SolarSystemPreloader.getPreloadedSystem()).toBeNull();
    expect(SolarSystemPreloader.clonePreloadedScene()).toBeNull();
  });

  it("rethrows with wrapped message on preload failure", async () => {
    createSceneSetup.mockImplementationOnce(() => {
      throw new Error("scene fail");
    });

    await expect(SolarSystemPreloader.preloadSolarSystem()).rejects.toThrow(
      "Solar system preloading failed: scene fail"
    );
    expect(captureException).toHaveBeenCalled();
  });

  it("covers fallback path when planet geometry/material are missing", async () => {
    const geometries = new Map<string, any>([
      ["sun", new SphereGeometry(1, 8, 8)],
    ]);
    const materials = new Map<string, any>();
    const textures = new Map<string, any>();

    const result = await (SolarSystemPreloader as any).createCompleteScene(
      geometries,
      materials,
      textures
    );

    expect(result.planetsGroup.children.length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });
});
