import {resolveJestRuntimeMode} from "../runtimeMode";

it("uses Jest's SDK and a local backend mock for standalone development", () => {
  expect(resolveJestRuntimeMode({development: true, embedded: false, harness: null})).toEqual({
    authHarness: false,
    deterministicHarness: false,
    mockBackend: true,
    useSdkPlatform: true,
  });
});

it("uses the real SDK and backend inside the hosted emulator", () => {
  expect(resolveJestRuntimeMode({development: true, embedded: true, harness: null})).toEqual({
    authHarness: false,
    deterministicHarness: false,
    mockBackend: false,
    useSdkPlatform: true,
  });
});

it("keeps the deterministic browser harness isolated from the Jest host", () => {
  expect(resolveJestRuntimeMode({development: true, embedded: false, harness: "jest"})).toEqual({
    authHarness: false,
    deterministicHarness: true,
    mockBackend: true,
    useSdkPlatform: false,
  });
});

it("runs authentication harnesses through the SDK adapter with a mock backend", () => {
  expect(resolveJestRuntimeMode({development: false, embedded: false, harness: "jest-auth"})).toEqual({
    authHarness: true,
    deterministicHarness: false,
    mockBackend: true,
    useSdkPlatform: true,
  });
});
