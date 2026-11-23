import {afterAll, beforeAll, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {createServer, type Server} from "node:http";
import {postRedditGateway} from "../RedditPlatformBootstrap";
import {createRedditHostServices} from "../RedditHostServices";

jest.mock("@devvit/payments/client", () => ({purchase: jest.fn()}));
jest.mock("@devvit/client", () => ({getWebViewMode: jest.fn(() => "expanded")}));

/** Captures native Fetch before installing the Node equivalent of a browser's base URL. */
const nativeFetch = globalThis.fetch;
/** Valid authority-shaped data ensures a followed redirect cannot fail only on schema parsing. */
const profile = {username: "Solver", coins: 300, level: 1, xp: 0, winStreak: 0,
  gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1};
/** Server response accepted by each public Reddit adapter seam. */
const validReply = JSON.stringify({ok: true, result: profile});
/** Production call sites covered by the native transport regression. */
const operations = [
  {name: "gateway", path: "/api/session", run: () => postRedditGateway("/api/session")},
  {name: "gameplay", path: "/api/game/profile.load", run: () => createRedditHostServices().loadProfile("reddit-account")},
  {name: "account deletion", path: "/api/account/delete", run: () => createRedditHostServices().deleteAccount("reddit-account")},
];

/** Binds a suite-owned loopback server to a kernel-selected port. */
async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {server.off("error", reject); resolve();});
  });
  /** Resolved socket address is the actual origin used by native Fetch. */
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("redirect-test-address-missing");
  return `http://127.0.0.1:${address.port}`;
}

/** Closes only suite-owned transport connections after the pending calls settle. */
async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

describe("Reddit native gateway redirect isolation", () => {
  /** Source server emulates the exact same-origin API route. */
  let source: Server;
  /** A second origin observes any prohibited redirect-follow request. */
  let destination: Server;
  /** Browser-relative paths resolve against this owned source origin. */
  let origin: string;
  /** Known target of the controlled cross-origin redirect. */
  let destinationOrigin: string;
  /** HTTP status selected by the current serial case. */
  let status = 307;
  /** Selects a redirect within the origin but outside the requested API route. */
  let sameOrigin = false;
  /** Counts initial API requests independently of redirect destinations. */
  let sourceCalls = 0;
  /** Captures only API paths to prove each public adapter uses its selected operation. */
  let sourcePaths: string[] = [];
  /** Counts prohibited destination requests without retaining headers or bodies. */
  let escapedCalls = 0;

  beforeAll(async () => {
    destination = createServer((request, response) => {
      escapedCalls += 1;
      request.resume();
      response.writeHead(200, {"content-type": "application/json"}).end(validReply);
    });
    destinationOrigin = await listen(destination);
    source = createServer((request, response) => {
      request.resume();
      if (!request.url?.startsWith("/api/")) {
        escapedCalls += 1;
        response.writeHead(200, {"content-type": "application/json"}).end(validReply);
      } else {
        sourceCalls += 1;
        sourcePaths.push(request.url);
        if (status === 200) response.writeHead(200, {"content-type": "application/json"}).end(validReply);
        else response.writeHead(status, {location: sameOrigin ? "/escaped" : `${destinationOrigin}/escaped`}).end();
      }
    });
    origin = await listen(source);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    sourceCalls = escapedCalls = 0;
    sourcePaths = [];
    status = 307;
    sameOrigin = false;
    jest.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (typeof input !== "string" || !input.startsWith("/api/")) throw new Error("unexpected-test-api-path");
      return nativeFetch(new URL(input, origin), init);
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await Promise.all([close(source), close(destination)]);
  });

  it.each(operations.flatMap(operation => [301, 302, 303, 307, 308].map(code => ({...operation, code}))))(
    "rejects $name HTTP $code before reaching another origin", async ({run, code, path}) => {
      status = code;
      /** Captures outcome while still asserting that no destination received a request. */
      const outcome = await run().then(() => "accepted", () => "rejected");
      expect(escapedCalls).toBe(0);
      expect(sourceCalls).toBe(1);
      expect(sourcePaths).toEqual([path]);
      expect(outcome).toBe("rejected");
    },
  );

  it.each(operations)("rejects $name redirects outside the selected same-origin API route", async ({run, path}) => {
    sameOrigin = true;
    /** Redirect rejection also prevents unexpected API/asset route replay on the same host. */
    const outcome = await run().then(() => "accepted", () => "rejected");
    expect(escapedCalls).toBe(0);
    expect(sourceCalls).toBe(1);
    expect(sourcePaths).toEqual([path]);
    expect(outcome).toBe("rejected");
  });

  it.each(operations)("preserves ordinary $name responses without an automatic retry", async ({run, path}) => {
    status = 200;
    await run();
    expect(sourceCalls).toBe(1);
    expect(sourcePaths).toEqual([path]);
    expect(escapedCalls).toBe(0);
  });
});
