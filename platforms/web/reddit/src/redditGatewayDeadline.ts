/** Same-origin gateway reads and mutations have a bounded local delivery wait. */
export const REDDIT_GATEWAY_REQUEST_TIMEOUT_MS = 15_000;

/** Bounds delivery, aborts browser transport, and consumes any late result without claiming server cancellation. */
export const withRedditGatewayDeadline = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  /** Each transport owns its own cancellation signal. */
  const controller = new AbortController();
  /** Pending deadline is always cleared after a terminal local result. */
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    /** Response headers and body decoding share one delivery deadline. */
    const request = operation(controller.signal);
    /** Expiration remains an unconfirmed operation outcome, never an accepted receipt. */
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(Object.assign(new Error("reddit-gateway-request-timed-out"), {code: "deadline-exceeded"}));
        controller.abort();
      }, REDDIT_GATEWAY_REQUEST_TIMEOUT_MS);
    });
    return await Promise.race([request, deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};
