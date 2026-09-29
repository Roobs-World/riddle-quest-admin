import {createHash} from "node:crypto";
import {HttpsError} from "firebase-functions/v2/https";
import type {RaceRiddleSnapshot} from "./raceEngine";

/** Hashes the exact ordered content played, including text and accepted answers. */
export function raceDeckContentVersion(riddles: RaceRiddleSnapshot[]): string {
  const canonical = riddles.map((riddle) => ({
    riddleId: riddle.riddleId, canonicalRiddleId: riddle.canonicalRiddleId,
    text: riddle.text, answer: riddle.answer, position: riddle.position,
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Validates and copies a persisted immutable deck against its canonical ordering. */
export function validateRaceDeckSnapshot(value: unknown, canonicalIds: string[], expectedContentVersion?: string): RaceRiddleSnapshot[] {
  if (!Array.isArray(value) || value.length !== canonicalIds.length || value.length === 0) {
    throw new HttpsError("failed-precondition", "The immutable race deck is unavailable.");
  }
  const snapshot = value.map((riddle: unknown, position) => {
    if (typeof riddle !== "object" || riddle === null) throw new HttpsError("data-loss", "Invalid race deck snapshot.");
    const record = riddle as Record<string, unknown>;
    if (typeof record.riddleId !== "string" || typeof record.text !== "string" || typeof record.answer !== "string" ||
      record.canonicalRiddleId !== canonicalIds[position] || record.position !== position) {
      throw new HttpsError("data-loss", "Race deck snapshot does not match the challenge.");
    }
    return {
      riddleId: record.riddleId, canonicalRiddleId: canonicalIds[position],
      text: record.text, answer: record.answer, position,
    };
  });
  if (expectedContentVersion !== undefined && raceDeckContentVersion(snapshot) !== expectedContentVersion) {
    throw new HttpsError("data-loss", "Race deck content does not match its immutable revision.");
  }
  return snapshot;
}
