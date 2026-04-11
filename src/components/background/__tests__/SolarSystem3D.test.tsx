import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { ColorManagement } from "three";

const mockSetClearColor = jest.fn();
const mockLookAt = jest.fn();
const mockDownloadAsync = jest.fn().mockResolvedValue(undefined);
const mockFromModule = jest.fn();
const frameCallbacks: Array<() => void> = [];

jest.mock("@react-three/fiber", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    Canvas: ({ children, onCreated, ...props }: any) => {
      if (onCreated) {
        onCreated({
          gl: { setClearColor: mockSetClearColor },
          camera: { lookAt: mockLookAt },
        });
      }

      return React.createElement(View, { testID: "mock-canvas", ...props }, children);
    },
    useFrame: (cb: () => void) => {
      frameCallbacks.push(cb);
    },
  };
});

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: (...args: any[]) => mockFromModule(...args),
  },
}));

const {
  default: SolarSystem3D,
  __resetSolarSystem3DTextureCacheForTests,
  __applySunFrameUpdateForTests,
  __applyMoonFrameUpdateForTests,
  __applyPlanetFrameUpdateForTests,
} = require("../SolarSystem3D");

describe("SolarSystem3D", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    frameCallbacks.length = 0;
    __resetSolarSystem3DTextureCacheForTests();
    mockFromModule.mockReturnValue({
      downloaded: false,
      width: 64,
      height: 64,
      downloadAsync: mockDownloadAsync,
    });
  });

  it("loads textures via expo-asset when not downloaded", async () => {
    render(<SolarSystem3D />);

    await waitFor(() => {
      expect(mockFromModule).toHaveBeenCalled();
      expect(mockDownloadAsync).toHaveBeenCalled();
    });
  });

  it("renders canvas with configured camera and GL setup", () => {
    const { getByTestId } = render(<SolarSystem3D />);

    const canvas = getByTestId("mock-canvas");
    expect(canvas.props.camera).toMatchObject({
      position: [0, 45, 350],
      fov: 60,
      near: 0.1,
      far: 1700,
    });
    expect(canvas.props.frameloop).toBe("always");

    expect(mockSetClearColor).toHaveBeenCalledWith(0x000000, 0);
    expect(mockLookAt).toHaveBeenCalledWith(0, 0, 0);
  });

  it("disables Three color management for expo-gl compatibility", () => {
    render(<SolarSystem3D />);
    expect(ColorManagement.enabled).toBe(false);
  });

  it("handles texture loading failures without crashing", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    __resetSolarSystem3DTextureCacheForTests();
    mockFromModule.mockImplementation(() => {
      throw new Error("asset failure");
    });

    expect(() => render(<SolarSystem3D />)).not.toThrow();

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "Failed to load texture:",
        expect.any(Error)
      );
    });

    warnSpy.mockRestore();
  });

  it("reuses cached textures on subsequent mounts", async () => {
    const first = render(<SolarSystem3D />);
    await waitFor(() => expect(mockFromModule).toHaveBeenCalled());
    const callCountAfterFirst = mockFromModule.mock.calls.length;

    first.unmount();
    render(<SolarSystem3D />);

    await waitFor(() => {
      expect(mockFromModule.mock.calls.length).toBe(callCountAfterFirst);
    });
  });

  it("applies sun, moon, and planet frame updates through helper functions", () => {
    const sun = { rotation: { x: 0, y: 0 } };
    __applySunFrameUpdateForTests(sun);
    expect(sun.rotation.x).toBeCloseTo(0.002);
    expect(sun.rotation.y).toBeCloseTo(0.008);
    expect(() => __applySunFrameUpdateForTests(null)).not.toThrow();

    const moonPositionSet = jest.fn();
    const moon = { position: { set: moonPositionSet }, rotation: { y: 0 } };
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
    const planetGroup = { position: { set: groupPositionSet } };
    const planetMesh = { rotation: { y: 0 } };
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
    const nextPlanetOrbit = __applyPlanetFrameUpdateForTests(
      planetGroup,
      planetMesh,
      0,
      planetConfig
    );
    expect(nextPlanetOrbit).toBeCloseTo(0.1);
    expect(groupPositionSet).toHaveBeenCalled();
    expect(planetMesh.rotation.y).toBeCloseTo(0.03);
    expect(
      __applyPlanetFrameUpdateForTests(null, null, 0, planetConfig)
    ).toBeCloseTo(0.1);
  });
});
