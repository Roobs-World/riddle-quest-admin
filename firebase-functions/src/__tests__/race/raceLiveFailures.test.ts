import {HttpsError} from "firebase-functions/v2/https";
import {liveRaceGatewayFailure} from "../../race/live/raceLiveFailures";

it.each(["invalid-argument", "failed-precondition", "not-found", "permission-denied", "unauthenticated", "resource-exhausted"] as const)("preserves the authoritative %s category without private details", code => {
  /** Only the known category is safe to return across Devvit. */
  const response = liveRaceGatewayFailure(new HttpsError(code, "private answer and account detail", {answer: "secret"}));
  expect(response.body).toEqual({error: "live-race-request-failed", code});
  expect(response.status).toBeLessThan(500);
  expect(JSON.stringify(response)).not.toMatch(/private|answer|secret/);
});
it("keeps unexpected failures retryable instead of claiming that the command was rejected", () => {
  expect(liveRaceGatewayFailure(new Error("private infrastructure detail")))
    .toEqual({status: 503, body: {error: "live-race-request-failed", code: "unavailable"}});
});
