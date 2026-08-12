import {shouldEnableBrowserTelemetry} from "../telemetryRuntime";

describe("browser telemetry runtime policy", () => {
  it("allows only remote production pages outside a trusted harness", () => {
    expect(shouldEnableBrowserTelemetry({
      production: true,
      hostname: "019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com",
      trustedTestHarness: false,
    })).toBe(true);
    expect(shouldEnableBrowserTelemetry({
      production: false,
      hostname: "019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com",
      trustedTestHarness: false,
    })).toBe(false);
    expect(shouldEnableBrowserTelemetry({
      production: true,
      hostname: "019faa68-f3ec-755d-9ab5-c887fb426801.builds.jest.com",
      trustedTestHarness: true,
    })).toBe(false);
  });

  it.each([
    undefined,
    "",
    "localhost",
    "LOCALHOST.",
    "game.localhost",
    "0.0.0.0",
    "127.0.0.1",
    "127.10.20.30",
    "::1",
    "[::1]",
    "::ffff:127.0.0.1",
  ])("blocks local and loopback hostnames: %s", (hostname) => {
    expect(shouldEnableBrowserTelemetry({
      production: true,
      hostname,
      trustedTestHarness: false,
    })).toBe(false);
  });
});
