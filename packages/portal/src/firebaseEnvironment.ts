/** Vite-provided Firebase runtime configuration. */
export const firebaseEnvironment = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  measurementId: import.meta.env.VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID,
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  sentryEnvironment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  sentryRelease: import.meta.env.VITE_SENTRY_RELEASE,
  appCheckSiteKey: import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY,
  functionsRegion: import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION,
  jestRuntime: import.meta.env.VITE_JEST_RUNTIME,
  production: import.meta.env.PROD,
} as const;
