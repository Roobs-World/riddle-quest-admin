import {ApiError} from "./errors.js";

export interface Deadline {readonly expiresAtMs: number}

/** Leaves six seconds of Vercel's sixty-second limit for response and runtime overhead. */
export function requestDeadline(): Deadline {return {expiresAtMs: Date.now() + 54_000};}

export function reserveDeadline(deadline: Deadline, reserveMs: number): Deadline {
  return {expiresAtMs: deadline.expiresAtMs - reserveMs};
}

export function remainingMs(deadline: Deadline): number {return Math.max(0, deadline.expiresAtMs - Date.now());}

export function deadlineSignal(deadline: Deadline, maximumMs: number): AbortSignal {
  const milliseconds = Math.min(maximumMs, remainingMs(deadline));
  if (milliseconds < 1) throw new ApiError(503, "notification-request-deadline");
  return AbortSignal.timeout(milliseconds);
}
