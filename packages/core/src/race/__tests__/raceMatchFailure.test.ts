import {classifyRaceMatchFailure, raceMatchFailure, RaceMatchFailureSchema} from "../raceMatchFailure";

it.each(["temporarily-unavailable", "projection-unavailable", "invalid-response", "search-budget-exceeded", "eligibility-changed", "intent-expired", "intent-consumed", "access-denied", "invalid-request"] as const)(
  "preserves validated recovery details for %s", reason => {
    /** Validated failure under test. */
    const failure = raceMatchFailure(reason);
    expect(classifyRaceMatchFailure({details: {matchmaking: failure}, code: "unavailable"})).toEqual(failure);
    expect(classifyRaceMatchFailure({matchmaking: failure})).toEqual(failure);
  },
);

it.each(["permission-denied", "unauthenticated", "failed-precondition"])("classifies %s as terminal without parsing its message", code => {
  expect(classifyRaceMatchFailure({code: `functions/${code}`, message: "expired search; retry now"})).toEqual(raceMatchFailure("access-denied"));
});

it("distinguishes generic throttling from an explicit bounded-search failure", () => {
  expect(classifyRaceMatchFailure({code: "resource-exhausted"})).toEqual(raceMatchFailure("temporarily-unavailable", 1000));
  expect(classifyRaceMatchFailure({code: "resource-exhausted", details: {matchmaking: raceMatchFailure("search-budget-exceeded")}}))
    .toEqual(raceMatchFailure("search-budget-exceeded"));
  expect(classifyRaceMatchFailure({code: "invalid-argument"})).toEqual(raceMatchFailure("invalid-request"));
  expect(classifyRaceMatchFailure({code: "already-exists"})).toEqual(raceMatchFailure("intent-consumed"));
  expect(classifyRaceMatchFailure({code: "aborted"})).toEqual(raceMatchFailure("eligibility-changed"));
});

it.each([undefined, null, [], "expired", {code: 8}, new Error("permission-denied"), {code: "unavailable"}, {code: "deadline-exceeded"}])(
  "keeps unknown/infrastructure failures retryable without inspecting text: %j", error => {
    expect(classifyRaceMatchFailure(error)).toEqual(raceMatchFailure("temporarily-unavailable", 1000));
  },
);

it.each(["ZodError", "SyntaxError"])("normalizes malformed responses through %s", name => {
  expect(classifyRaceMatchFailure({name})).toEqual(raceMatchFailure("invalid-response", 1000));
});

it.each([
  {reason: "access-denied", recovery: "same-intent", retryAfterMs: 0},
  {reason: "access-denied", recovery: "none", retryAfterMs: 1},
  {reason: "intent-expired", recovery: "new-intent", retryAfterMs: 60001},
  {reason: "intent-expired", recovery: "new-intent", retryAfterMs: -1},
  {reason: "unknown", recovery: "same-intent", retryAfterMs: 0},
  {...raceMatchFailure("intent-expired"), answers: ["secret"]},
])("rejects unsafe failure contracts and falls back to the broad code: %j", failure => {
  expect(RaceMatchFailureSchema.safeParse(failure).success).toBe(false);
  expect(classifyRaceMatchFailure({code: "permission-denied", details: {matchmaking: failure}})).toEqual(raceMatchFailure("access-denied"));
});
