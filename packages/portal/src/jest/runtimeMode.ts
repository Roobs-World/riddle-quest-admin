/** Describes jest runtime mode. */
export type JestRuntimeMode = {
  /** Stores auth harness. */
  authHarness: boolean;
  /** Stores deterministic harness. */
  deterministicHarness: boolean;
  /** Stores mock backend. */
  mockBackend: boolean;
  /** Stores use sdk platform. */
  useSdkPlatform: boolean;
};

/** Keeps beta subscription offers out of every uploaded production artifact runtime. */
export const shouldEnableJestSubscriptions = (development: boolean): boolean => development;

/** Resolves jest runtime mode. */
export function resolveJestRuntimeMode({
  development,
  embedded,
  harness,
  testHarnessEnabled,
}: {
  /** Stores development. */
  development: boolean;
  /** Stores embedded. */
  embedded: boolean;
  /** Stores harness. */
  harness: string | null;
  /** Stores test harness enabled. */
  testHarnessEnabled: boolean;
}): JestRuntimeMode {
  /** Provides auth harness behavior. */
  const authHarness = testHarnessEnabled && (harness === "jest-auth" || harness === "race-auth");
  /** Provides deterministic harness behavior. */
  const deterministicHarness = testHarnessEnabled && (harness === "jest" || harness === "dev" || harness === "race");
  /** Provides local sdk mock behavior. */
  const localSdkMock = development && !embedded && !authHarness && !deterministicHarness;
  return {
    authHarness,
    deterministicHarness,
    mockBackend: authHarness || deterministicHarness || localSdkMock,
    useSdkPlatform: authHarness || !deterministicHarness,
  };
}
