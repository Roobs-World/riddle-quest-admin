/** Comparable input revisions share the origin adopted during recovery. */
export type DraftCheckpointRevision = Readonly<{
  /** Recovery lineage shared by comparable snapshots. */ origin: string;
  /** Accepted input changes within that lineage. */ sequence: number;
}>;

/** Optional ordering metadata never invalidates required gameplay deliveries. */
export function parseDraftCheckpointRevision(value: unknown): DraftCheckpointRevision | undefined {
  if (typeof value !== "object" || value === null || !("origin" in value) || !("sequence" in value) ||
    typeof value.origin !== "string" || value.origin.length < 1 || value.origin.length > 128 ||
    typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence) || value.sequence < 0) return undefined;
  return {origin: value.origin, sequence: value.sequence};
}
