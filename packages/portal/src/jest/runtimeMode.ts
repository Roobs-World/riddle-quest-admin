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

/** Keeps subscription offers out of production until the live provider lifecycle gate passes. */
export const shouldEnableJestSubscriptions = (development: boolean): boolean => development;

/** Resolves jest runtime mode. */
export function resolveJestRuntimeMode({
  development,
  embedded: _embedded,
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
  // Localhost cannot reach the production purchase authority. Keep Jest's real
  // SDK when the Developer Console embeds the dev server, but use the local
  // idempotent grant mock so recovery can finish before completePurchase.
  /** Provides local backend mock behavior. */
  const localBackendMock = development && !authHarness && !deterministicHarness;
  return {
    authHarness,
    deterministicHarness,
    mockBackend: authHarness || deterministicHarness || localBackendMock,
    useSdkPlatform: authHarness || !deterministicHarness,
  };
}
