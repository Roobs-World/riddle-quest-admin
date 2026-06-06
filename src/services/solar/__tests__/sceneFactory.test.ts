import {AmbientLight, Mesh, PointLight, RingGeometry, Scene, SphereGeometry, Texture} from "three";
import {addEnhancedLights, addSunMeshes, createSceneSetup} from "../sceneFactory";

describe("sceneFactory", () => {
  it("creates scene setup with expected camera defaults", () => {
    const {scene, camera} = createSceneSetup();

    expect(scene).toBeInstanceOf(Scene);
    expect(camera.position.x).toBe(90);
    expect(camera.position.y).toBe(60);
    expect(camera.position.z).toBe(90);
  });

  it("adds enhanced lights to scene and output array", () => {
    const scene = new Scene();
    const lights: Array<PointLight | AmbientLight> = [];

    addEnhancedLights(scene, lights);

    expect(lights).toHaveLength(2);
    expect(scene.children.some((child) => child instanceof PointLight)).toBe(true);
    expect(scene.children.some((child) => child instanceof AmbientLight)).toBe(true);
  });

  it("adds layered sun meshes when sun geometry is available", () => {
    const scene = new Scene();
    const geometries = new Map<string, SphereGeometry | RingGeometry>([["sun", new SphereGeometry(10, 8, 8)]]);
    const textures = new Map<string, Texture>([
      ["sun", new Texture()],
      ["glow_sun", new Texture()],
      ["glow_sun_intense", new Texture()],
      ["glow_planet_intense", new Texture()],
    ]);
    const meshes: Mesh[] = [];

    addSunMeshes(scene, geometries, textures, meshes);

    expect(meshes).toHaveLength(4);
    expect(scene.children.filter((child) => child instanceof Mesh)).toHaveLength(4);
  });

  it("throws when sun geometry is missing", () => {
    const scene = new Scene();
    const geometries = new Map<string, SphereGeometry | RingGeometry>();
    const textures = new Map<string, Texture>([
      ["sun", new Texture()],
      ["glow_sun", new Texture()],
      ["glow_sun_intense", new Texture()],
      ["glow_planet_intense", new Texture()],
    ]);
    const meshes: Mesh[] = [];

    expect(() => addSunMeshes(scene, geometries, textures, meshes)).toThrow("Missing required sun geometry");
  });

  it("throws when a required sun texture is missing", () => {
    const scene = new Scene();
    const geometries = new Map<string, SphereGeometry | RingGeometry>([["sun", new SphereGeometry(10, 8, 8)]]);
    const textures = new Map<string, Texture>([
      ["sun", new Texture()],
      ["glow_sun", new Texture()],
      ["glow_sun_intense", new Texture()],
    ]);
    const meshes: Mesh[] = [];

    expect(() => addSunMeshes(scene, geometries, textures, meshes)).toThrow("Missing required sun texture");
  });

  it("throws when an exception occurs during sun mesh creation", () => {
    const scene = {
      add: jest.fn(() => {
        throw new Error("add failed");
      }),
    } as unknown as Scene;
    const geometries = new Map<string, SphereGeometry | RingGeometry>([["sun", new SphereGeometry(10, 8, 8)]]);
    const textures = new Map<string, Texture>([
      ["sun", new Texture()],
      ["glow_sun", new Texture()],
      ["glow_sun_intense", new Texture()],
      ["glow_planet_intense", new Texture()],
    ]);
    const meshes: Mesh[] = [];

    expect(() => addSunMeshes(scene, geometries, textures, meshes)).toThrow("add failed");
  });
});
