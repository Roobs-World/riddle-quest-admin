import {browserCallableSecurityOptions} from "./callableSecurity";

/** Adds gameplay beside eur3 while retaining the endpoint used by existing clients and the Reddit gateway. */
export const gameplayCallableOptions = {
  ...browserCallableSecurityOptions,
  region: ["us-central1", "europe-west1"],
};

/**
 * Keeps the single-player critical path warm, matching the race interactive policy.
 *
 * Question delivery, guess submission and completion sit directly between a
 * player's input and visible feedback, so a cold start after idle would stall
 * play for seconds. Lower-frequency actions (hints, skips, coin spends) keep the
 * scale-to-zero defaults.
 */
export const gameplayInteractiveCallableOptions = {
  ...gameplayCallableOptions,
  minInstances: 1,
};
