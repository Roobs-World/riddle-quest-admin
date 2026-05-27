import {render, waitFor} from "@testing-library/react-native";
import React from "react";
import {ColorManagement} from "three";

const mockSetClearColor = jest.fn();
const mockLookAt = jest.fn();
const mockPixelStorei = jest.fn();
const mockGetContext = jest.fn(() => ({
  pixelStorei: mockPixelStorei,
}));
const mockLoadAsync = jest.fn();
const mockNativeDownloadAsync = jest.fn();
const frameCallbacks: Array<() => void> = [];

jest.mock("@react-three/fiber", () => {
  const React = require("react");
  const {View} = require("react-native");

  return {
    Canvas: ({children, onCreated, ...props}: any) => {
      if (onCreated) {
        onCreated({
          gl: {getContext: mockGetContext, setClearColor: mockSetClearColor},
          camera: {lookAt: mockLookAt},
        });
      }

      return React.createElement(View, {testID: "mock-canvas", ...props}, children);
    },
    useFrame: (cb: () => void) => {
      frameCallbacks.push(cb);
    },
  };
});

jest.mock("expo-asset", () => ({
  Asset: {
    loadAsync: (...args: any[]) => mockLoadAsync(...args),
  },
}));

jest.mock("expo-modules-core", () => ({
  requireNativeModule: () => ({
    downloadAsync: (...args: any[]) => mockNativeDownloadAsync(...args),
  }),
}));

const {
  default: SolarSystem3D,
  __resetSolarSystem3DTextureCacheForTests,
  __createSunMaterialForTests,
  __getSolarCanvasFrameloopForTests,
  __applySunFrameUpdateForTests,
  __applyMoonFrameUpdateForTests,
  __applyPlanetFrameUpdateForTests,
} = require("../SolarSystem3D");

describe("SolarSystem3D", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    frameCallbacks.length = 0;
    __resetSolarSystem3DTextureCacheForTests();
    mockGetContext.mockReturnValue({
      pixelStorei: mockPixelStorei,
    });
    mockNativeDownloadAsync.mockResolvedValue("file:///mock-downloaded-texture.png");
    mockLoadAsync.mockResolvedValue([
      {
        localUri: "file:///mock-texture.png",
        width: 64,
        height: 64,
      },
    ]);
  });

  it("loads textures via expo-asset", async () => {
    render(<SolarSystem3D />);

    await waitFor(() => {
      expect(mockLoadAsync).toHaveBeenCalled();
    });
  });

  it("copies embedded Android drawable resources to file uris for expo-gl", async () => {
    mockLoadAsync.mockResolvedValue([
      {
        downloaded: true,
        hash: "asset-hash",
        height: 64,
        localUri: "assets_3d_tex_planet_a",
        name: "tex_planet_a",
        type: "png",
        uri: "assets_3d_tex_planet_a",
        width: 64,
      },
    ]);

    render(<SolarSystem3D />);

    await waitFor(() => {
      expect(mockNativeDownloadAsync).toHaveBeenCalledWith("assets_3d_tex_planet_a", "asset-hash", "png");
    });
  });

  it("renders canvas with configured camera and GL setup", () => {
    const {getByTestId} = render(<SolarSystem3D />);

    const canvas = getByTestId("mock-canvas");
    expect(canvas.props.camera).toMatchObject({
      position: [0, 45, 350],
      fov: 60,
      near: 0.1,
      far: 1700,
    });
    expect(canvas.props.frameloop).toBe("always");

    expect(mockSetClearColor).toHaveBeenCalledWith(0x000000, 0);
    expect(mockGetContext).toHaveBeenCalled();
    expect(mockLookAt).toHaveBeenCalledWith(0, 0, 0);
  });

  it("pauses the canvas frame loop when the background is hidden", () => {
    const {getByTestId} = render(<SolarSystem3D visible={false} />);

    expect(getByTestId("mock-canvas").props.frameloop).toBe("never");
    expect(__getSolarCanvasFrameloopForTests(false)).toBe("never");
    expect(__getSolarCanvasFrameloopForTests(true)).toBe("always");
  });

  it("disables Three color management for expo-gl compatibility", () => {
    render(<SolarSystem3D />);
    expect(ColorManagement.enabled).toBe(false);
  });

  it("uses the sun texture for both diffuse and emissive material channels", () => {
    const texture = {isTexture: true};
    const material = __createSunMaterialForTests(texture);

    expect(material.map).toBe(texture);
    expect(material.emissiveMap).toBe(texture);
    expect(material.shininess).toBe(0);
  });

  it("handles texture loading failures without crashing", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    __resetSolarSystem3DTextureCacheForTests();
    mockLoadAsync.mockRejectedValue(new Error("asset failure"));

    expect(() => render(<SolarSystem3D />)).not.toThrow();

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Failed to load texture:", expect.any(Error));
    });

    warnSpy.mockRestore();
  });

  it("reuses cached textures on subsequent mounts", async () => {
    const first = render(<SolarSystem3D />);
    await waitFor(() => expect(mockLoadAsync).toHaveBeenCalled());
    const callCountAfterFirst = mockLoadAsync.mock.calls.length;

    first.unmount();
    render(<SolarSystem3D />);

    await waitFor(() => {
      expect(mockLoadAsync.mock.calls.length).toBe(callCountAfterFirst);
    });
  });

  it("applies sun, moon, and planet frame updates through helper functions", () => {
    const sun = {rotation: {x: 0, y: 0}};
    __applySunFrameUpdateForTests(sun);
    expect(sun.rotation.x).toBeCloseTo(0.002);
    expect(sun.rotation.y).toBeCloseTo(0.008);
    expect(() => __applySunFrameUpdateForTests(null)).not.toThrow();

    const moonPositionSet = jest.fn();
    const moon = {position: {set: moonPositionSet}, rotation: {y: 0}};
    const moonConfig = {
      size: 1,
      distance: 10,
      orbitSpeed: 0.2,
      color: 0xffffff,
      textureModule: 1,
      startAngle: 0,
    };
    const nextMoonOrbit = __applyMoonFrameUpdateForTests(moon, 0, moonConfig);
    expect(nextMoonOrbit).toBeCloseTo(0.2);
    expect(moonPositionSet).toHaveBeenCalled();
    expect(moon.rotation.y).toBeCloseTo(0.02);
    expect(__applyMoonFrameUpdateForTests(null, 0, moonConfig)).toBeCloseTo(0.2);

    const groupPositionSet = jest.fn();
    const planetGroup = {position: {set: groupPositionSet}};
    const planetMesh = {rotation: {y: 0}};
    const planetConfig = {
      name: "test",
      size: 1,
      distance: 50,
      yPosition: 5,
      orbitSpeed: 0.1,
      rotationSpeed: 0.03,
      textureModule: 1,
      startAngle: 0,
      moons: [],
    };
    const nextPlanetOrbit = __applyPlanetFrameUpdateForTests(planetGroup, planetMesh, 0, planetConfig);
    expect(nextPlanetOrbit).toBeCloseTo(0.1);
    expect(groupPositionSet).toHaveBeenCalled();
    expect(planetMesh.rotation.y).toBeCloseTo(0.03);
    expect(__applyPlanetFrameUpdateForTests(null, null, 0, planetConfig)).toBeCloseTo(0.1);
  });
});
