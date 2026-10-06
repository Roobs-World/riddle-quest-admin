"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RaceMatchFailureSchema = void 0;
exports.raceMatchFailure = raceMatchFailure;
exports.classifyRaceMatchFailure = classifyRaceMatchFailure;
const zod_1 = require("zod");
/** Recovery decisions are protocol facts, independent of provider error text. */
const recoveries = {
    "temporarily-unavailable": "same-intent",
    "projection-unavailable": "same-intent",
    "invalid-response": "same-intent",
    "search-budget-exceeded": "new-intent",
    "eligibility-changed": "new-intent",
    "intent-expired": "new-intent",
    "intent-consumed": "new-intent",
    "access-denied": "none",
    "invalid-request": "none",
};
/** Bounded, answer-free search failure and its prescribed recovery. */
exports.RaceMatchFailureSchema = zod_1.z.object({
    reason: zod_1.z.enum(["temporarily-unavailable", "projection-unavailable", "invalid-response", "search-budget-exceeded", "eligibility-changed",
        "intent-expired", "intent-consumed", "access-denied", "invalid-request"]),
    recovery: zod_1.z.enum(["same-intent", "new-intent", "none"]),
    retryAfterMs: zod_1.z.number().int().min(0).max(60000),
}).strict().superRefine((failure, context) => {
    if (failure.recovery !== recoveries[failure.reason] || failure.recovery === "none" && failure.retryAfterMs !== 0)
        context.addIssue({ code: "custom", message: "Invalid matchmaking recovery policy." });
});
/** Builds one internally consistent failure without carrying provider messages. */
function raceMatchFailure(reason, retryAfterMs = 0) {
    return exports.RaceMatchFailureSchema.parse({ reason, recovery: recoveries[reason], retryAfterMs });
}
/** Structured errors can be SDK instances or plain gateway records. */
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
/**
 * Normalizes provider failures through typed details and stable error codes.
 * Generic resource exhaustion is treated as infrastructure throttling; only an
 * explicit bounded-search failure rotates the intent. Messages are never parsed.
 */
function classifyRaceMatchFailure(error) {
    /** Explicit backend recovery instructions take precedence over HTTP/SDK categories. */
    const value = record(error);
    /** Provider details may contain explicit bounded-search recovery instructions. */
    const details = record(value?.details);
    /** Malformed instructions fall back to the stable provider error-code mapping. */
    const supplied = exports.RaceMatchFailureSchema.safeParse(details?.matchmaking ?? value?.matchmaking);
    if (supplied.success)
        return supplied.data;
    /** Firebase prefixes callable codes; gateway adapters provide the same bare codes. */
    const code = typeof value?.code === "string" ? value.code.replace(/^functions\//, "") : "unknown";
    if (["permission-denied", "unauthenticated", "failed-precondition"].includes(code))
        return raceMatchFailure("access-denied");
    if (code === "invalid-argument")
        return raceMatchFailure("invalid-request");
    if (code === "already-exists")
        return raceMatchFailure("intent-consumed");
    if (code === "aborted")
        return raceMatchFailure("eligibility-changed");
    if (value?.name === "ZodError" || value?.name === "SyntaxError")
        return raceMatchFailure("invalid-response", 1000);
    return raceMatchFailure("temporarily-unavailable", 1000);
}
