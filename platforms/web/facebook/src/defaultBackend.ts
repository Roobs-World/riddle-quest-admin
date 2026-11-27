import {FacebookBackendClient, type FacebookBackendPort} from "./backend";

/** Creates the production HTTP identity client from compile-time Facebook configuration. */
export function createDefaultFacebookBackend(): FacebookBackendPort {
  return new FacebookBackendClient(import.meta.env.VITE_FACEBOOK_FUNCTIONS_BASE_URL || "/", {
    allowInsecureLoopback: import.meta.env.DEV,
  });
}
