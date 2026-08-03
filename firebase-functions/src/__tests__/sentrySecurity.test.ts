import {redactSensitiveTelemetry} from "../shared/sentry";

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
