"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRaceTranslationImportPlan = createRaceTranslationImportPlan;
exports.assertRaceTranslationAtomicWriteCount = assertRaceTranslationAtomicWriteCount;
exports.assertRaceTranslationImportSnapshotStable = assertRaceTranslationImportSnapshotStable;
const node_path_1 = require("node:path");
const raceTranslationValidation_1 = require("./raceTranslationValidation");
/** Validates bundle contents and binds the artifact name to its locale/provenance contract. */
function createRaceTranslationImportPlan(input, source, inputPath) {
    /** Provides plan behavior. */
    const plan = (0, raceTranslationValidation_1.createRaceTranslationPlan)(input, source);
    /** Provides expected filename behavior. */
    const expectedFilename = `race-${plan.locale}-automated-translation-v1.json`;
    if ((0, node_path_1.basename)(inputPath) !== expectedFilename) {
        throw new Error(`translation-input-filename-mismatch:${expectedFilename}`);
    }
    return plan;
}
/** Refuses any import that cannot commit all target and retirement writes atomically. */
function assertRaceTranslationAtomicWriteCount(targetWrites, retiringWrites) {
    if (!Number.isSafeInteger(targetWrites) ||
        targetWrites < 0 ||
        !Number.isSafeInteger(retiringWrites) ||
        retiringWrites < 0) {
        throw new Error("translation-import-write-count-invalid");
    }
    /** Provides writes behavior. */
    const writes = targetWrites + retiringWrites;
    if (!Number.isSafeInteger(writes) || writes > 500) {
        throw new Error(`translation-import-atomic-limit:${writes}`);
    }
    return writes;
}
/** Detects every target/eligible-set change between the owner backup and atomic transaction. */
function assertRaceTranslationImportSnapshotStable(expected, actual, label) {
    /** Provides canonical behavior. */
    const canonical = (values) => [...values]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ path, version }) => `${path}\0${version ?? "missing"}`);
    /** Provides expected canonical behavior. */
    const expectedCanonical = canonical(expected);
    /** Provides actual canonical behavior. */
    const actualCanonical = canonical(actual);
    if (expectedCanonical.length !== actualCanonical.length ||
        expectedCanonical.some((value, index) => value !== actualCanonical[index])) {
        throw new Error(`translation-import-state-changed:${label}`);
    }
}
//# sourceMappingURL=raceTranslationImport.js.map