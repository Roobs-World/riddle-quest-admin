import {resolveJestRuntimeMode, shouldEnableJestSubscriptions} from "../runtimeMode";

it("uses Jest's SDK and a local backend mock for standalone development", () => {
  expect(resolveJestRuntimeMode({development: true, embedded: false, harness: null, testHarnessEnabled: true})).toEqual(
    {
      authHarness: false,
      deterministicHarness: false,
      mockBackend: true,
      useSdkPlatform: true,
    },
  );
});

it("uses the real SDK and local backend mock inside the hosted emulator", () => {
  expect(resolveJestRuntimeMode({development: true, embedded: true, harness: null, testHarnessEnabled: true})).toEqual({
    authHarness: false,
    deterministicHarness: false,
    mockBackend: true,
    useSdkPlatform: true,
  });
});

it("keeps the deterministic browser harness isolated from the Jest host", () => {
  expect(
    resolveJestRuntimeMode({development: true, embedded: false, harness: "jest", testHarnessEnabled: true}),
  ).toEqual({
    authHarness: false,
    deterministicHarness: true,
    mockBackend: true,
    useSdkPlatform: false,
  });
});

it("runs authentication harnesses through the SDK adapter with a mock backend", () => {
  expect(
    resolveJestRuntimeMode({development: false, embedded: false, harness: "jest-auth", testHarnessEnabled: true}),
  ).toEqual({
    authHarness: true,
    deterministicHarness: false,
    mockBackend: true,
    useSdkPlatform: true,
  });
});

it("does not let production query parameters enable a mock backend", () => {
  expect(
    resolveJestRuntimeMode({
      development: false,
      embedded: true,
      harness: "race-auth",
      testHarnessEnabled: false,
    }),
  ).toEqual({
    authHarness: false,
    deterministicHarness: false,
    mockBackend: false,
    useSdkPlatform: true,
  });
});

it("keeps subscriptions disabled in the normal uploaded production runtime", () => {
  expect(shouldEnableJestSubscriptions(false)).toBe(false);
});

it("retains subscription coverage in local development", () => {
  expect(shouldEnableJestSubscriptions(true)).toBe(true);
});
