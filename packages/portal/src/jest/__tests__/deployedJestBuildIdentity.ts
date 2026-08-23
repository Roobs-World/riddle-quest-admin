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
  const parsed = new URL(url);
  if (parsed.hostname !== `${gameId.toLowerCase()}.builds.jest.com`) {
    throw new Error(`Expected the Riddle Quest Jest build host; received ${parsed.hostname}`);
  }
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  if (!pathSegments.includes(buildVersion)) {
    throw new Error(`Expected active Jest build ${buildVersion}; received ${parsed.pathname}`);
  }
  return parsed;
}
