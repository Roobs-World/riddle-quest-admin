/** Deterministic Firebase environment used by Node unit tests. */
export const firebaseEnvironment = {
  apiKey: undefined,
  appId: undefined,
  authDomain: undefined,
  messagingSenderId: undefined,
  projectId: undefined,
  databaseUrl: undefined,
  measurementId: "G-UNIT-TEST",
  sentryDsn: undefined,
  sentryEnvironment: undefined,
  sentryRelease: undefined,
  appCheckSiteKey: "unit-test-site-key",
  functionsRegion: undefined,
  jestRuntime: "0",
  production: false,
} as const;
