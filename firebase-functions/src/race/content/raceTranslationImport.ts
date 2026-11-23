import {basename} from "node:path";
import {createRaceTranslationPlan, type RaceTranslationPlan} from "./raceTranslationValidation";

/** Validates bundle contents and binds the artifact name to its locale/provenance contract. */
export function createRaceTranslationImportPlan(
  input: unknown,
  source: unknown,
  inputPath: string,
): RaceTranslationPlan {
  /** Provides plan behavior. */
  const plan = createRaceTranslationPlan(input, source);
  /** Provides expected filename behavior. */
  const expectedFilename = `race-${plan.locale}-automated-translation-v1.json`;
  if (basename(inputPath) !== expectedFilename) {
    throw new Error(`translation-input-filename-mismatch:${expectedFilename}`);
  }
  return plan;
}

/** Refuses any import that cannot commit all target and retirement writes atomically. */
export function assertRaceTranslationAtomicWriteCount(targetWrites: number, retiringWrites: number): number {
  if (
    !Number.isSafeInteger(targetWrites) ||
    targetWrites < 0 ||
    !Number.isSafeInteger(retiringWrites) ||
    retiringWrites < 0
  ) {
    throw new Error("translation-import-write-count-invalid");
  }
  /** Provides writes behavior. */
  const writes = targetWrites + retiringWrites;
  if (!Number.isSafeInteger(writes) || writes > 500) {
    throw new Error(`translation-import-atomic-limit:${writes}`);
  }
  return writes;
}

/** Describes race translation snapshot version. */
export type RaceTranslationSnapshotVersion = Readonly<{
  /** Stores path. */
  path: string; /** Stores version. */
  /** Stores version. */
  version: string | null;
}>;

/** Detects every target/eligible-set change between the owner backup and atomic transaction. */
export function assertRaceTranslationImportSnapshotStable(
  expected: RaceTranslationSnapshotVersion[],
  actual: RaceTranslationSnapshotVersion[],
  label: string,
): void {
  /** Provides canonical behavior. */
  const canonical = (values: RaceTranslationSnapshotVersion[]) =>
    [...values]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({path, version}) => `${path}\0${version ?? "missing"}`);
  /** Provides expected canonical behavior. */
  const expectedCanonical = canonical(expected);
  /** Provides actual canonical behavior. */
  const actualCanonical = canonical(actual);
  if (
    expectedCanonical.length !== actualCanonical.length ||
    expectedCanonical.some((value, index) => value !== actualCanonical[index])
  ) {
    throw new Error(`translation-import-state-changed:${label}`);
  }
}
