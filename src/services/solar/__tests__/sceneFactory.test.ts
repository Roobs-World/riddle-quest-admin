import {
  AmbientLight,
  DirectionalLight,
  Mesh,
  RingGeometry,
  Scene,
  SphereGeometry,
  Texture,
} from "three";
import { addEnhancedLights, addSunMeshes, createSceneSetup } from "../sceneFactory";
import { captureException } from "../../../utils/sentry";

jest.mock("../../../utils/sentry", () => ({
  captureException: jest.fn(),
}));

describe("sceneFactory", () => {
  it("creates scene setup with expected camera defaults", () => {
    const { scene, camera } = createSceneSetup();

    expect(scene).toBeInstanceOf(Scene);
    expect(camera.position.x).toBe(90);
    expect(camera.position.y).toBe(60);
    expect(camera.position.z).toBe(90);
  });

  it("adds enhanced lights to scene and output array", () => {
    const scene = new Scene();
    const lights: (DirectionalLight | AmbientLight | any)[] = [];

    addEnhancedLights(scene, lights as any);

    expect(lights).toHaveLength(5);
    expect(scene.children.some((child) => child instanceof AmbientLight)).toBe(true);
    expect(scene.children.some((child) => child instanceof DirectionalLight)).toBe(true);
  });

  it("adds layered sun meshes when sun geometry is available", () => {
    const scene = new Scene();
    const geometries = new Map<string, SphereGeometry | RingGeometry>([
      ["sun", new SphereGeometry(10, 8, 8)],
    ]);
    const textures = new Map<string, Texture | null>([
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

  it("adds fallback sun mesh when geometry is missing", () => {
    const scene = new Scene();
    const geometries = new Map<string, SphereGeometry | RingGeometry>();
    const textures = new Map<string, Texture | null>();
    const meshes: Mesh[] = [];

    addSunMeshes(scene, geometries, textures, meshes);

    expect(meshes).toHaveLength(1);
    expect((meshes[0].userData as any).isFallback).toBe(true);
  });

  it("falls back when an exception occurs during sun mesh creation", () => {
    let addCount = 0;
    const scene = {
      add: jest.fn(() => {
        addCount += 1;
        if (addCount === 1) {
          throw new Error("add failed");
        }
      }),
    } as unknown as Scene;
    const geometries = new Map<string, SphereGeometry | RingGeometry>([
      ["sun", new SphereGeometry(10, 8, 8)],
    ]);
    const textures = new Map<string, Texture | null>([["glow_sun", new Texture()]]);
    const meshes: Mesh[] = [];

    addSunMeshes(scene, geometries, textures, meshes);

    expect(meshes).toHaveLength(1);
    expect((meshes[0].userData as any).isFallback).toBe(true);
    expect(captureException).toHaveBeenCalled();
  });
});
