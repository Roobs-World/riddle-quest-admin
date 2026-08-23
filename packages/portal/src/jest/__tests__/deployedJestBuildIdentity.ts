const buildVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/u;
const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/** Verifies that a hosted Jest iframe URL identifies the exact expected uploaded build. */
export function assertExactDeployedJestBuildUrl({
  buildVersion,
  gameId,
  url,
}: {
  buildVersion: string;
  gameId: string;
  url: string;
}): URL {
  if (!buildVersionPattern.test(buildVersion)) {
    throw new Error("The expected Jest build version is invalid");
  }
  if (!gameIdPattern.test(gameId)) {
    throw new Error("The expected Jest game ID is invalid");
  }
  const canonicalGameId = gameId.toLowerCase();
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    throw new Error("The deployed Jest build URL must use canonical credential-free HTTPS");
  }
  if (parsed.hostname !== `${canonicalGameId}.builds.jest.com`) {
    throw new Error(`Expected the Riddle Quest Jest build host; received ${parsed.hostname}`);
  }
  const expectedPathname = `/${canonicalGameId}/${buildVersion}/index.html`;
  if (parsed.pathname !== expectedPathname) {
    throw new Error(`Expected active Jest build ${buildVersion}; received ${parsed.pathname}`);
  }
  return parsed;
}
