import {redactBrowserSentryEvent, redactBrowserTelemetry, resolveSecureBrowserSentryDsn} from "../sentryPrivacy";

describe("browser telemetry transport security", () => {
  it("accepts only encrypted HTTPS DSNs", () => {
    expect(resolveSecureBrowserSentryDsn(" https://public@example.ingest.sentry.io/1 ")).toBe(
      "https://public@example.ingest.sentry.io/1",
    );
    expect(resolveSecureBrowserSentryDsn(undefined)).toBeUndefined();
    expect(resolveSecureBrowserSentryDsn("   ")).toBeUndefined();
  });

  it.each(["http://example.test/1", "ws://example.test/1", "not-a-url"])(
    "rejects an insecure or malformed DSN: %s",
    (dsn) => expect(() => resolveSecureBrowserSentryDsn(dsn)).toThrow(/HTTPS/),
  );
});

describe("browser telemetry redaction", () => {
  it("redacts identity, credentials, guesses, answers, and image payloads", () => {
    expect(
      redactBrowserTelemetry({
        userId: "player-123",
        nested: {
          answer: "secret",
          guess: "attempt",
          authorization: "Bearer abc.def.ghi",
          safe: "kept",
          imageDataUrl: "data:image/png;base64,AAAA",
        },
      }),
    ).toEqual({
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

  it("scrubs embedded credentials and handles arrays, depth limits, and cycles", () => {
    /** Provides token behavior. */
    const token = `${"a".repeat(16)}.${"b".repeat(16)}.${"c".repeat(16)}`;
    /** Provides value behavior. */
    const value: Record<string, unknown> = {
      values: [`request Bearer credential and ${token}`, null, true],
    };
    value.self = value;
    /** Provides deep behavior. */
    let deep: Record<string, unknown> = value;
    for (let index = 0; index < 9; index += 1) {
      /** Provides next behavior. */
      const next = {safe: true};
      deep.child = next;
      deep = next;
    }

    /** Provides redacted behavior. */
    const redacted = redactBrowserTelemetry(value) as Record<string, unknown>;
    expect(redacted.values).toEqual(["request Bearer [REDACTED] and [REDACTED_TOKEN]", null, true]);
    expect(redacted.self).toBe("[CIRCULAR]");
    expect(redacted.child).toBeDefined();
  });

  it("removes query strings and fragments from diagnostic URLs", () => {
    expect(
      redactBrowserTelemetry({
        message: "Request failed at https://game.example/play?token=secret&email=a%40b.test#player",
        endpoint: new URL("https://api.example/functions?uid=player-1"),
      }),
    ).toEqual({
      message: "Request failed at https://game.example/play",
      endpoint: "https://api.example/functions",
    });
  });

  it("removes free-form Sentry messages while retaining structured diagnostics", () => {
    expect(
      redactBrowserSentryEvent({
        message: "Player guessed secret",
        exception: {values: [{type: "Error", value: "Invalid answer secret", stacktrace: {frames: []}}]},
        logentry: {formatted: "Request contained player@example.test"},
        breadcrumbs: [{category: "console", message: "username was Craig"}],
        request: {data: {displayName: "Craig"}, headers: {"x-forwarded-for": "203.0.113.4"}},
        user: {username: "Craig", ip_address: "203.0.113.4"},
        contexts: {device: {name: "Craig's phone"}},
        tags: {operation: "submit_guess"},
      }),
    ).toEqual({
      message: "[REDACTED_MESSAGE]",
      exception: {values: [{type: "Error", value: "[REDACTED_MESSAGE]", stacktrace: {frames: []}}]},
      logentry: {formatted: "[REDACTED_MESSAGE]"},
      tags: {operation: "submit_guess"},
    });
  });
});
