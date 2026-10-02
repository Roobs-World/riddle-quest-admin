import {createHash} from "node:crypto";
import {parseRaceMatchOffer} from "../../race/raceMatchOfferRecord";
import {DEFAULT_RACE_MATCH_POLICY} from "../../race/raceMatchPolicy";

/** Original receipts lacked explicit pool and policy fields. */
const legacy = {userId: `reddit_${"a".repeat(40)}`, challengeId: "challenge", createdAtMs: 1000, expiresAtMs: 61000,
  fingerprint: JSON.stringify({locale: "en", categoryId: null})};
/** Current receipts preserve reproducible selection attribution. */
const current = {...legacy, recordVersion: 1, requestId: "request", provider: "reddit", locale: "en", categoryId: "history", expectedPerformanceMs: 120000,
  matchPolicySnapshot: DEFAULT_RACE_MATCH_POLICY.policy, matchPolicyHash: DEFAULT_RACE_MATCH_POLICY.hash,
  matchPolicyRevision: DEFAULT_RACE_MATCH_POLICY.policy.revision, matchPolicyVersion: DEFAULT_RACE_MATCH_POLICY.policy.algorithmVersion};

/** Physical receipt key is derived from the owner and original request. */
const documentId = createHash("sha256").update(`${legacy.userId}\u0000request`).digest("hex");

it("normalizes supported legacy preferences and validates current immutable attribution", () => {
  expect(parseRaceMatchOffer(legacy, documentId).locale).toBe("en");
  expect(parseRaceMatchOffer(current, documentId)).toMatchObject(current);
  expect(parseRaceMatchOffer({...legacy, acceptedRunId: "run", acceptedAtMs: 70000}, documentId).acceptedRunId).toBe("run");
});

it.each([
  {requestId: "another-request"}, {requestId: undefined}, {challengeId: "wrong/path"}, {expiresAtMs: NaN}, {createdAtMs: Number.MAX_SAFE_INTEGER + 1}, {expiresAtMs: 1000},
  {fingerprint: "private corrupt payload"}, {locale: "fr"}, {provider: "jest"}, {acceptedRunId: "run"},
  {acceptedAtMs: 2000}, {acceptedRunId: "run", acceptedAtMs: 999}, {startsAtMs: 2000},
  {terminalStatus: "completed"}, {terminalAtMs: 2000}, {finishedTen: true}, {actualPerformanceMs: 12000},
  {matchPolicyHash: "b".repeat(64)}, {matchPolicyRevision: 999}, {matchPolicyVersion: 2},
  {matchPolicySnapshot: undefined}, {questionOverlap: 2}, {predictionLogError: Infinity},
  {acceptedRunId: "run", acceptedAtMs: 2000, startsAtMs: 3000, readinessAcceptedAtMs: 4000},
])("rejects corrupt or inconsistent owned receipt fields without leaking stored data: %j", patch => {
  expect(() => parseRaceMatchOffer({...current, ...patch}, documentId)).toThrow("Stored matchmaking offer is invalid.");
});

it("checks the physical receipt identifier and explicit category preference", () => {
  expect(() => parseRaceMatchOffer(legacy, "invalid")).toThrow("Stored matchmaking offer is invalid.");
  expect(() => parseRaceMatchOffer({...current, fingerprint: JSON.stringify({locale: "en", categoryId: "science"})}, documentId)).toThrow();
});

it.each([0, 5])("reads a canonical timed-out receipt with %i solved answers", correctCount => {
  /** Timeout is a settled non-finish and retains explicit censored measurements. */
  const timeout = {...current, acceptedRunId: "run", acceptedAtMs: 2000, startsAtMs: 3000,
    terminalStatus: "timed_out", terminalAtMs: 303000, result: "timed_out", correctCount, finishedTen: false,
    actualPerformanceMs: null, predictionLogError: null, finishTimeDeltaMs: null};
  expect(parseRaceMatchOffer(timeout, documentId)).toMatchObject(timeout);
});

it.each([{finishedTen: true, correctCount: 10}, {actualPerformanceMs: 12000}, {predictionLogError: 0}, {finishTimeDeltaMs: 0}])(
  "rejects full-finish evidence on a timed-out receipt: %j", patch => {
    expect(() => parseRaceMatchOffer({...current, acceptedRunId: "run", acceptedAtMs: 2000, startsAtMs: 3000,
      terminalStatus: "timed_out", terminalAtMs: 303000, correctCount: 5, finishedTen: false, ...patch}, documentId)).toThrow("Stored matchmaking offer is invalid.");
  });
