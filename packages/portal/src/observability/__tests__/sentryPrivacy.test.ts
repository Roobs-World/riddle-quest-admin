import {redactBrowserTelemetry, resolveSecureBrowserSentryDsn} from "../sentryPrivacy";

describe("browser telemetry transport security", () => {
  it("accepts only encrypted HTTPS DSNs", () => {
    expect(resolveSecureBrowserSentryDsn(" https://public@example.ingest.sentry.io/1 "))
      .toBe("https://public@example.ingest.sentry.io/1");
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
    expect(redactBrowserTelemetry({
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

  it("scrubs embedded credentials and handles arrays, depth limits, and cycles", () => {
    const token = `${"a".repeat(16)}.${"b".repeat(16)}.${"c".repeat(16)}`;
    const value: Record<string, unknown> = {
      values: [`request Bearer credential and ${token}`, null, true],
    };
    value.self = value;
    let deep: Record<string, unknown> = value;
    for (let index = 0; index < 9; index += 1) {
      const next = {safe: true};
      deep.child = next;
      deep = next;
    }

    const redacted = redactBrowserTelemetry(value) as Record<string, unknown>;
    expect(redacted.values).toEqual(["request Bearer [REDACTED] and [REDACTED_TOKEN]", null, true]);
    expect(redacted.self).toBe("[CIRCULAR]");
    expect(redacted.child).toBeDefined();
  });
});
