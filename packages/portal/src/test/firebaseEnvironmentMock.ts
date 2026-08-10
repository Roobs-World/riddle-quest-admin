/** Deterministic Firebase environment used by Node unit tests. */
export const firebaseEnvironment = {
  apiKey: undefined,
  appId: undefined,
  authDomain: undefined,
  messagingSenderId: undefined,
  projectId: undefined,
  measurementId: "G-UNIT-TEST",
  appCheckSiteKey: "unit-test-site-key",
  functionsRegion: undefined,
  jestRuntime: "0",
  production: false,
} as const;
