import {browserCallableSecurityOptions} from "./callableSecurity";

/** Adds gameplay beside eur3 while retaining the endpoint used by existing clients and the Reddit gateway. */
export const gameplayCallableOptions = {
  ...browserCallableSecurityOptions,
  region: ["us-central1", "europe-west1"],
};
