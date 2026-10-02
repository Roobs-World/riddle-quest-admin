/** Contains no live Firestore access; the authority helper is replaced only in this scheduler unit test. */
const mockPurge = jest.fn();
/** Captures aggregate logs, never provider identities. */
const mockInfo = jest.fn();
/** Captures the actual scheduler deployment boundary. */
let mockRegistration: unknown[] = [];

jest.mock("../race/facebookContextRetention", () => ({purgeExpiredFacebookContextPage: (...args: unknown[]) => mockPurge(...args)}));
jest.mock("firebase-functions", () => ({logger: {info: (...args: unknown[]) => mockInfo(...args)}}));
jest.mock("../shared/sentryHandlers", () => ({onScheduleWithSentry: (...args: unknown[]) => {mockRegistration = args; return {};}}));
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: () => ({})}}));

import {facebookContextRetentionHandler} from "../race/facebookContextRetentionScheduler";

/** Default complete empty-page result. */
const emptyPage = {scanned: 0, ready: 0, missing: 0, active: 0, invalid: 0, entries: 0, complete: true};
beforeEach(() => {mockPurge.mockReset(); mockInfo.mockReset(); mockPurge.mockResolvedValue(emptyPage);});

it("registers a bounded Facebook-only hourly server schedule without provider secrets", () => {
  expect(mockRegistration).toEqual(["facebookContextRetentionScheduler",
    {schedule: "17 * * * *", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
      memory: "256MiB", maxInstances: 1, concurrency: 1, retryCount: 2}, facebookContextRetentionHandler]);
});

it("applies one page using the current server clock and logs only the helper's aggregate result", async () => {
  jest.spyOn(Date, "now").mockReturnValueOnce(1_700_000_000_000);
  await facebookContextRetentionHandler();
  expect(mockPurge).toHaveBeenCalledWith(expect.anything(), 1_700_000_000_000, true);
  expect(mockInfo).toHaveBeenCalledWith("Facebook context retention page finished.", emptyPage);
});

it("retries when the page contains invalid state without forwarding private provider diagnostics", async () => {
  mockPurge.mockResolvedValue({...emptyPage, scanned: 1, invalid: 1, complete: false});
  await expect(facebookContextRetentionHandler()).rejects.toThrow("inspect aggregate page evidence");
  mockPurge.mockRejectedValue(new Error("private-member-and-provider-diagnostics"));
  await expect(facebookContextRetentionHandler()).rejects.toThrow("inspect aggregate page evidence");
  expect(mockPurge).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(mockInfo.mock.calls)).not.toContain("private-member");
});
