/** Scheduler tests replace storage only at the maintenance boundary. */
const mockPurge = jest.fn();
/** Only aggregate retention evidence may reach operational logs. */
const mockInfo = jest.fn();
/** Captures the deployable schedule and its resource bounds. */
let mockRegistration: unknown[] = [];
jest.mock("../reddit/redditProfileRetention", () => ({purgeExpiredRedditProfilePage: (...args: unknown[]) => mockPurge(...args)}));
jest.mock("firebase-functions", () => ({logger: {info: (...args: unknown[]) => mockInfo(...args)}}));
jest.mock("../shared/sentryHandlers", () => ({onScheduleWithSentry: (...args: unknown[]) => {mockRegistration = args; return {};}}));
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: () => ({})}}));
import {redditProfileRetentionHandler} from "../reddit/redditProfileRetentionScheduler";

/** Empty-page aggregate evidence contains no provider information. */
const empty = {scanned: 0, ready: 0, missing: 0, absent: 0, active: 0, foreign: 0, invalid: 0, complete: true};
beforeEach(() => {jest.restoreAllMocks(); mockPurge.mockReset(); mockInfo.mockReset(); mockPurge.mockResolvedValue(empty);});
afterEach(() => jest.restoreAllMocks());

it("registers bounded hourly cleanup without player notification or provider secrets", () => {
  expect(mockRegistration).toEqual(["redditProfileRetentionScheduler",
    {schedule: "29 * * * *", timeZone: "UTC", region: "us-central1", timeoutSeconds: 120,
      memory: "256MiB", maxInstances: 1, concurrency: 1, retryCount: 2}, redditProfileRetentionHandler]);
});
it("applies one current-time page and logs only its aggregate result", async () => {
  jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  await redditProfileRetentionHandler();
  expect(mockPurge).toHaveBeenCalledWith(expect.anything(), 1_700_000_000_000, true);
  expect(mockInfo).toHaveBeenCalledWith("Reddit profile retention page finished.", empty);
});
it("retains incomplete evidence and sanitizes storage failures before the reporting wrapper", async () => {
  mockPurge.mockResolvedValue({...empty, scanned: 1, invalid: 1, complete: false});
  await expect(redditProfileRetentionHandler()).rejects.toThrow("inspect aggregate page evidence");
  mockPurge.mockRejectedValue(new Error("private-reddit-name-and-provider-id"));
  await expect(redditProfileRetentionHandler()).rejects.toThrow("inspect aggregate page evidence");
  expect(JSON.stringify(mockInfo.mock.calls)).not.toContain("private-reddit");
});
