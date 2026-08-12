import {
  redactSensitiveTelemetry,
  redactSentryEvent,
  resolveSecureSentryDsn,
  resolveSentryRelease,
} from "../shared/sentry";

describe("telemetry transport security", () => {
  it("accepts only encrypted HTTPS DSNs", () => {
    expect(resolveSecureSentryDsn(" https://public@example.ingest.sentry.io/1 "))
      .toBe("https://public@example.ingest.sentry.io/1");
    expect(resolveSecureSentryDsn(undefined)).toBeUndefined();
    expect(resolveSecureSentryDsn("   ")).toBeUndefined();
  });

  it.each(["http://example.test/1", "ws://example.test/1", "not-a-url"])(
    "rejects an insecure or malformed DSN: %s",
    (dsn) => expect(() => resolveSecureSentryDsn(dsn)).toThrow(/HTTPS/),
  );

  it("prefers the deployed Cloud Run revision over a static release", () => {
    expect(resolveSentryRelease({
      K_REVISION: " riddle-quest-functions-00042 ",
      SENTRY_RELEASE: "riddle-quest@static",
    })).toBe("riddle-quest-functions-00042");
  });

  it("falls back to a configured release when no runtime revision exists", () => {
    expect(resolveSentryRelease({SENTRY_RELEASE: " riddle-quest@commit "}))
      .toBe("riddle-quest@commit");
    expect(resolveSentryRelease({K_REVISION: " ", SENTRY_RELEASE: " "})).toBeUndefined();
  });
});

describe("telemetry redaction", () => {
  it("redacts identity, credentials, guesses, answers, and image payloads", () => {
    expect(redactSensitiveTelemetry({
      userId: "player-123",
      nested: {
        answer: "secret",
        guess: "attempt",
        authorization: "Bearer abc.def.ghi",
        safe: "kept",
        imageDataUrl: "data:image/png;base64,AAAA",
      },
    })).toEqual({
      userId: "[REDACTED]",
      nested: {
        answer: "[REDACTED]",
        guess: "[REDACTED]",
        authorization: "[REDACTED]",
        safe: "kept",
        imageDataUrl: "[REDACTED]",
      },
    });
  });

  it("scrubs bearer and compact tokens embedded in otherwise safe text", () => {
    const token = `${"a".repeat(16)}.${"b".repeat(16)}.${"c".repeat(16)}`;
    expect(redactSensitiveTelemetry(`request Bearer credential and ${token}`)).toBe(
      "request Bearer [REDACTED] and [REDACTED_TOKEN]",
    );
  });

  it("removes query strings and fragments from diagnostic URLs", () => {
    expect(redactSensitiveTelemetry({
      requestUrl: "https://api.example.test/function?token=secret&email=a%40b.test#player",
      endpoint: new URL("https://api.example.test/function?uid=player-1"),
    })).toEqual({
      requestUrl: "https://api.example.test/function",
      endpoint: "https://api.example.test/function",
    });
  });

  it("handles cyclic telemetry without throwing", () => {
    const value: Record<string, unknown> = {safe: true};
    value.self = value;
    expect(redactSensitiveTelemetry(value)).toEqual({safe: true, self: "[CIRCULAR]"});
  });

  it("removes free-form exception and log text without dropping stack metadata", () => {
    expect(redactSentryEvent({
      exception: {values: [{type: "Error", value: "answer was secret", stacktrace: {frames: []}}]},
      logentry: {message: "guess was attempt"},
      breadcrumbs: [{message: "player name"}],
      request: {data: {displayName: "Player One"}, headers: {"x-forwarded-for": "203.0.113.4"}},
      user: {username: "Player One", ip_address: "203.0.113.4"},
      contexts: {runtime: {name: "node"}},
      tags: {operation: "daily_scheduler"},
    })).toEqual({
      exception: {values: [{type: "Error", value: "[REDACTED_MESSAGE]", stacktrace: {frames: []}}]},
      logentry: {message: "[REDACTED_MESSAGE]"},
      tags: {operation: "daily_scheduler"},
    });
  });
});
