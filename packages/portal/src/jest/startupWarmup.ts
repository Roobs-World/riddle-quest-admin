/** Google endpoints contacted by Firebase Auth, Firestore Lite and App Check during Jest startup. */
const FIREBASE_SERVICE_ORIGINS = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://firestore.googleapis.com",
  "https://content-firebaseappcheck.googleapis.com",
] as const;

/** Parses an absolute HTTPS origin, ignoring relative or malformed configuration. */
function httpsOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    /** Parsed configured URL. */
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Callable Functions origin for one configured region. */
function functionsOrigin(region: string | undefined, projectId: string | undefined): string | null {
  if (!region || !projectId || !/^[a-z0-9-]+$/.test(region) || !/^[a-z0-9-]+$/.test(projectId)) return null;
  return `https://${region}-${projectId}.cloudfunctions.net`;
}

/** Network origins on the Jest startup critical path, in first-use order. */
export function jestStartupOrigins(environment: {
  /** Jest identity exchange base URL. */ jestFunctionsBaseUrl?: string;
  /** Default callable region. */ functionsRegion?: string;
  /** Single-player and race callable region. */ gameplayRegion?: string;
  /** Firebase project identifier. */ projectId?: string;
}): string[] {
  /** Jest gameplay runs beside eur3 unless explicitly overridden. */
  const gameplayRegion = environment.gameplayRegion || "europe-west1";
  /** Ordered candidates; duplicates and unusable values are removed below. */
  const candidates = [
    httpsOrigin(environment.jestFunctionsBaseUrl),
    ...FIREBASE_SERVICE_ORIGINS,
    functionsOrigin(gameplayRegion, environment.projectId),
    functionsOrigin(environment.functionsRegion || "us-central1", environment.projectId),
  ];
  return [...new Set(candidates.filter((origin): origin is string => origin !== null))];
}

/**
 * Opens connections to startup endpoints while the Jest SDK is still initializing.
 *
 * Identity exchange, sign-in, attestation, profile and question reads otherwise
 * each pay DNS, TCP and TLS setup serially. Firebase transports use anonymous
 * CORS fetches, so the hints must also be anonymous to share those connections.
 */
export function preconnectJestStartupOrigins(
  origins: string[],
  doc: Pick<Document, "head" | "createElement" | "querySelector"> = document,
): void {
  for (const origin of origins) {
    if (doc.querySelector(`link[rel="preconnect"][href="${origin}"]`)) continue;
    /** Connection hint owned by the document head. */
    const link = doc.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    doc.head.append(link);
  }
}
