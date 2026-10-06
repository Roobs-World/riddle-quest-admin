import {createServer, type Server} from "node:http";
import type {AddressInfo} from "node:net";
import type {HttpsFunction} from "firebase-functions/v2/https";

jest.mock("../shared/sentry", () => ({captureException: jest.fn(), flushSentry: jest.fn()}));

import {onCallWithSentry} from "../shared/sentryHandlers";

/** Real Firebase callable served over HTTP. */
const callable = onCallWithSentry("preflightProbe", {cors: true}, () => "ok");
/** Local server hosting the callable. */
let server: Server;
/** Base URL of the local server. */
let baseUrl: string;

beforeAll(async () => {
  server = createServer((request, response) =>
    void (callable as unknown as HttpsFunction)(request as never, response as never));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

it("lets browsers cache a callable preflight for an hour", async () => {
  /** Preflight a browser sends before an authenticated callable POST. */
  const response = await fetch(baseUrl, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.test",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type,x-firebase-appcheck",
    },
  });

  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe("https://example.test");
  expect(response.headers.get("access-control-max-age")).toBe("3600");
});

it("keeps Firebase deployment metadata on the wrapped callable", () => {
  expect(callable.__endpoint.callableTrigger).toEqual({});
  expect(typeof callable.run).toBe("function");
});
