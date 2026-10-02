import {StartRaceRunRequestSchema, type StartRaceRunRequest} from "@qwordly/core/race";

/** Validates and journals a start receipt only while its originating journey owns creation. */
export function recordOwnedRaceStart(
  payload: Record<string, unknown>,
  replayRequestId: string | undefined,
  createReceipt: (operation: string) => string,
  current: () => boolean,
  retain: (request: StartRaceRunRequest) => void,
): string | undefined {
  if (!current()) return;
  /** The external factory can replace account or navigation before returning its receipt. */
  const requestId = replayRequestId ?? createReceipt("raceStart");
  if (!current()) return;
  /** Validate only a still-owned selection; retired invalid receipts cannot fail replacements. */
  const request = StartRaceRunRequestSchema.parse({...payload, requestId});
  if (!current()) return;
  retain(request);
  return request.requestId;
}
