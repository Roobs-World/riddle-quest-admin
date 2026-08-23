import {describe, expect, it} from "@jest/globals";

import {assertExactDeployedJestBuildUrl} from "./deployedJestBuildIdentity";

const gameId = "019faa68-f3ec-755d-9ab5-c887fb426801";
const buildVersion = "1.0.0-dev.20260823084020.3c32ac3a619f.a5c4ff30";

describe("deployed Jest build identity", () => {
  it("accepts only the exact version segment on the fixed Jest build host", () => {
    const deployed = assertExactDeployedJestBuildUrl({
      buildVersion,
      gameId,
      url: `https://${gameId}.builds.jest.com/${gameId}/${buildVersion}/index.html`,
    });

    expect(deployed.hostname).toBe(`${gameId}.builds.jest.com`);
  });

  it.each([
    `https://${gameId}.builds.jest.com/${gameId}/1.0.0-older/index.html`,
    `https://example.com/${gameId}/${buildVersion}/index.html`,
    `https://${gameId}.builds.jest.com/${gameId}/index.html?version=${buildVersion}`,
  ])("rejects a different hosted artifact: %s", (url) => {
    expect(() => assertExactDeployedJestBuildUrl({buildVersion, gameId, url})).toThrow();
  });
});
