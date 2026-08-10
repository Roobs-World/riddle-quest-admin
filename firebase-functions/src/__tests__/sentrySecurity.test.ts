import {redactSensitiveTelemetry, resolveSecureSentryDsn} from "../shared/sentry";

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

  it("handles cyclic telemetry without throwing", () => {
    const value: Record<string, unknown> = {safe: true};
    value.self = value;
    expect(redactSensitiveTelemetry(value)).toEqual({safe: true, self: "[CIRCULAR]"});
  });
});
