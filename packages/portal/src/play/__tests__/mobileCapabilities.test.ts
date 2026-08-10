import {getMobileCapabilities, shouldLoadDecorativeWebGl} from "../performance/mobileCapabilities";

const capableDevice = {
  deviceMemory: 8,
  hardwareConcurrency: 8,
  saveData: false,
  effectiveType: "4g",
  reducedMotion: false,
  webGlAvailable: true,
};

it("loads decorative WebGL on capable devices", () => {
  expect(shouldLoadDecorativeWebGl(capableDevice)).toBe(true);
});

it.each([
  {deviceMemory: 4},
  {hardwareConcurrency: 4},
  {saveData: true},
  {effectiveType: "2g"},
  {reducedMotion: true},
  {webGlAvailable: false},
])("skips decorative WebGL for constrained capability %o", (constraint) => {
  expect(shouldLoadDecorativeWebGl({...capableDevice, ...constraint})).toBe(false);
});

describe("runtime mobile capability detection", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "navigator");
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "WebGLRenderingContext");
  });

  it("reads browser hardware, connection, motion, and WebGL capabilities", () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {deviceMemory: 8, hardwareConcurrency: 12, connection: {saveData: true, effectiveType: "3g"}},
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {matchMedia: jest.fn(() => ({matches: true}))},
    });
    Object.defineProperty(globalThis, "WebGLRenderingContext", {configurable: true, value: class {}});

    expect(getMobileCapabilities()).toEqual({
      deviceMemory: 8,
      hardwareConcurrency: 12,
      saveData: true,
      effectiveType: "3g",
      reducedMotion: true,
      webGlAvailable: true,
    });
  });

  it("handles browsers without network information or WebGL", () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {hardwareConcurrency: 2},
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {matchMedia: jest.fn(() => ({matches: false}))},
    });

    expect(getMobileCapabilities()).toEqual({
      deviceMemory: undefined,
      hardwareConcurrency: 2,
      saveData: undefined,
      effectiveType: undefined,
      reducedMotion: false,
      webGlAvailable: false,
    });
  });
});
