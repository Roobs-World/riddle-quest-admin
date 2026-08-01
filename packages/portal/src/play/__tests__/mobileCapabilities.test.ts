import {shouldLoadDecorativeWebGl} from "../performance/mobileCapabilities";

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
