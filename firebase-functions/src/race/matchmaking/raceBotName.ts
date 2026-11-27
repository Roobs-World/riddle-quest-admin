import {createHash} from "node:crypto";

/** A server-owned guest identity stays stable across join, poll and recorded-run retries. */
export function generateRaceBotName(seed: string): string {
  return `Guest_${createHash("sha256").update(`race-bot:${seed}`).digest("hex").slice(0, 6).toUpperCase()}`;
}
