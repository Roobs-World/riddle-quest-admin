"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectRaceRunResponse = projectRaceRunResponse;
const race_1 = require("@qwordly/core/race");
const https_1 = require("firebase-functions/v2/https");
const raceEngine_1 = require("./raceEngine");
/** Validates the exact accepted public projection before its caller commits any effects. */
function projectRaceRunResponse(run, nowMs, includeEvaluation = false, includeGuessHistory = false) {
    /** Strict decoding stays inside the transaction; diagnostics never expose immutable answers. */
    const response = race_1.RaceRunResponseSchema.safeParse({ run: (0, raceEngine_1.toRaceRunView)(run, nowMs, includeEvaluation, includeGuessHistory) });
    if (!response.success)
        throw new https_1.HttpsError("data-loss", "Stored race view is invalid.");
    return response.data;
}
//# sourceMappingURL=raceRunResponse.js.map