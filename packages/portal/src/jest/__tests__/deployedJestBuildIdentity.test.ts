import {describe, expect, it} from "@jest/globals";

import {assertExactDeployedJestBuildUrl} from "./deployedJestBuildIdentity";

/** Provides game id behavior. */
const gameId = "019faa68-f3ec-755d-9ab5-c887fb426801";
/** Builds version. */
const buildVersion = "1.0.0-dev.20260823084020.3c32ac3a619f.a5c4ff30";

describe("deployed Jest build identity", () => {
  it("accepts the exact canonical HTTPS build URL with Jest context parameters", () => {
    /** Provides deployed behavior. */
    const deployed = assertExactDeployedJestBuildUrl({
      buildVersion,
      gameId,
      url: `https://${gameId}.builds.jest.com/${gameId}/${buildVersion}/index.html?sid=context-1&tce=1`,
    });

    expect(deployed.hostname).toBe(`${gameId}.builds.jest.com`);
    expect(deployed.pathname).toBe(`/${gameId}/${buildVersion}/index.html`);
  });

  it.each([
    `http://${gameId}.builds.jest.com/${gameId}/${buildVersion}/index.html`,
    `https://${gameId}.builds.jest.com:444/${gameId}/${buildVersion}/index.html`,
    `https://user:password@${gameId}.builds.jest.com/${gameId}/${buildVersion}/index.html`,
    `https://${gameId}.builds.jest.com/${gameId}/1.0.0-older/index.html`,
    `https://${gameId}.builds.jest.com/${buildVersion}/index.html`,
    `https://${gameId}.builds.jest.com/00000000-0000-4000-8000-000000000000/${buildVersion}/index.html`,
    `https://${gameId}.builds.jest.com/${gameId}/older/${buildVersion}/index.html`,
    `https://example.com/${gameId}/${buildVersion}/index.html`,
    `https://${gameId}.builds.jest.com/${gameId}/index.html?version=${buildVersion}`,
  ])("rejects a different hosted artifact: %s", (url) => {
    expect(() => assertExactDeployedJestBuildUrl({buildVersion, gameId, url})).toThrow();
  });
});
