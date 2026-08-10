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

/** Resolves jest runtime mode. */
export function resolveJestRuntimeMode({
  development,
  embedded,
  harness,
  testHarnessEnabled,
}: {
  development: boolean;
  embedded: boolean;
  harness: string | null;
  testHarnessEnabled: boolean;
}): JestRuntimeMode {
  const authHarness = testHarnessEnabled && (harness === "jest-auth" || harness === "race-auth");
  const deterministicHarness = testHarnessEnabled && (harness === "jest" || harness === "dev" || harness === "race");
  const localSdkMock = development && !embedded && !authHarness && !deterministicHarness;
  return {
    authHarness,
    deterministicHarness,
    mockBackend: authHarness || deterministicHarness || localSdkMock,
    useSdkPlatform: authHarness || !deterministicHarness,
  };
}
