/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {beforeEach, afterEach, describe, expect, it, jest} from "@jest/globals";
/** Provides generate behavior. */
const generate = jest.fn();
/** Provides capture behavior. */
const capture = jest.fn();
/** Provides job behavior. */
let job: Record<string, unknown>;
/** Provides clock behavior. */
let clock: number;
/** Provides ref behavior. */
const ref = {};
/** Provides transaction behavior. */
const transaction = {get: jest.fn(async () => ({data: () => ({...job})})), update: jest.fn((_, values) => Object.assign(job, values))};
/** Masked reads retain the same canonical snapshot/error injector for each transaction attempt. */
transaction.getAll = jest.fn(async (reference, _options) => [await transaction.get(reference)]);
/** Indexed discovery returns only candidates; the transaction owns current eligibility and locale. */
const dueQuery = {where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), select: jest.fn(), get: jest.fn()};
/** Provides db behavior. */
const db = {collection: jest.fn(() => ({...dueQuery, doc: jest.fn(() => ref)})), runTransaction: jest.fn(async callback => callback(transaction))};
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: () => db}}));
jest.mock("../shared/sentryHandlers", () => ({onScheduleWithSentry: jest.fn()}));
jest.mock("../shared/sentry", () => ({captureException: capture}));
jest.mock("../riddles/riddleGeneration", () => ({generateLocalizedClassicRiddlesForLocale: generate}));
/** Provides warn behavior. */
const warn = jest.fn();
jest.mock("firebase-functions", () => ({logger: {warn}}));
import {isTransientProviderError, processClassicSupplyJob, processClassicSupplyJobs, TRANSIENT_REPORT_THRESHOLD} from "../riddles/classicSupplyWorker";
/** Builds a provider SDK error carrying an HTTP status. */
const providerError = (status: number) => Object.assign(new Error("provider"), {status});

describe("durable Classic supply worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clock = 1000000;
    jest.spyOn(Date, "now").mockImplementation(() => clock);
    job = {locale: "ar", highestClassicIndex: 20, nextAttemptAtMs: 0};
    generate.mockResolvedValue(undefined);
    for (const method of [dueQuery.where, dueQuery.orderBy, dueQuery.limit, dueQuery.select]) method.mockReturnValue(dueQuery);
    dueQuery.get.mockResolvedValue({docs: [{id: "ar_20", data: () => ({locale: "fr", nextAttemptAtMs: 0})}]});
  });
  afterEach(() => jest.restoreAllMocks());
  it("discovers document IDs without loading copied job fields and rechecks canonical locale", async () => {
    await processClassicSupplyJobs();
    expect(dueQuery.select).toHaveBeenCalledWith();
    expect(dueQuery.where).toHaveBeenCalledWith("nextAttemptAtMs", "<=", clock);
    expect(dueQuery.orderBy).toHaveBeenCalledWith("nextAttemptAtMs");
    expect(dueQuery.limit).toHaveBeenCalledWith(3);
    expect(generate).toHaveBeenCalledWith("ar", 5, clock + 180000);
  });
  it("does not treat discovery eligibility as a current transaction grant", async () => {
    job.nextAttemptAtMs = clock + 600000;
    await processClassicSupplyJobs();
    expect(generate).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });
  it("propagates failed discovery without starting generation", async () => {
    dueQuery.get.mockRejectedValueOnce(new Error("discovery unavailable"));
    await expect(processClassicSupplyJobs()).rejects.toThrow("discovery unavailable");
    expect(generate).not.toHaveBeenCalled();
  });
  it("completes the durable request and excludes successful replay", async () => {
    expect(await processClassicSupplyJob("ar_20")).toBe("generated");
    expect(generate).toHaveBeenCalledWith("ar", 5, clock + 180000);
    expect(transaction.getAll).toHaveBeenNthCalledWith(1, ref, {fieldMask: ["nextAttemptAtMs", "completed", "locale", "transientFailures"]});
    expect(transaction.getAll).toHaveBeenNthCalledWith(2, ref, {fieldMask: ["leaseId"]});
    expect(job.completed).toBe(true);
    expect(await processClassicSupplyJob("ar_20")).toBe("skipped");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("excludes another worker while generation is pending", async () => {
    /** Provides release behavior. */
    let release: () => void;
    generate.mockReturnValue(new Promise<void>(resolve => {release = resolve;}));
    /** Provides pending behavior. */
    const pending = processClassicSupplyJob("ar_20");
    await new Promise(resolve => setImmediate(resolve));
    expect(await processClassicSupplyJob("ar_20")).toBe("skipped");
    release!();
    expect(await pending).toBe("generated");
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("backs off provider failures and permits a later retry", async () => {
    generate.mockRejectedValueOnce(new Error("provider failure"));
    expect(await processClassicSupplyJob("ar_20")).toBe("retry");
    expect(job.nextAttemptAtMs).toBe(clock + 300000);
    expect(await processClassicSupplyJob("ar_20")).toBe("skipped");
    clock += 300000;
    expect(await processClassicSupplyJob("ar_20")).toBe("generated");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenCalledTimes(1);
  });
  it("classifies rate limits, provider outages and dropped connections as transient", () => {
    for (const status of [408, 409, 429, 500, 503]) expect(isTransientProviderError(providerError(status))).toBe(true);
    for (const status of [400, 401, 403, 404, 422]) expect(isTransientProviderError(providerError(status))).toBe(false);
    for (const name of ["APIConnectionError", "APIConnectionTimeoutError", "AbortError", "TimeoutError"]) {
      expect(isTransientProviderError(Object.assign(new Error("network"), {name}))).toBe(true);
    }
    expect(isTransientProviderError(new Error("invalid model output"))).toBe(false);
    expect(isTransientProviderError(undefined)).toBe(false);
  });
  it("retries transient provider failures quietly until they persist", async () => {
    generate.mockRejectedValue(providerError(429));
    for (let attempt = 1; attempt < TRANSIENT_REPORT_THRESHOLD; attempt++) {
      expect(await processClassicSupplyJob("ar_20")).toBe("retry");
      expect(job.transientFailures).toBe(attempt);
      clock += 300000;
    }
    expect(capture).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(TRANSIENT_REPORT_THRESHOLD - 1);
    expect(await processClassicSupplyJob("ar_20")).toBe("retry");
    expect(capture).toHaveBeenCalledTimes(1);
    clock += 300000;
    generate.mockResolvedValue(undefined);
    expect(await processClassicSupplyJob("ar_20")).toBe("generated");
    expect(job.transientFailures).toBe(0);
  });
  it("reports non-transient failures immediately and resets the transient streak", async () => {
    job.transientFailures = 2;
    generate.mockRejectedValueOnce(providerError(400));
    expect(await processClassicSupplyJob("ar_20")).toBe("retry");
    expect(capture).toHaveBeenCalledTimes(1);
    expect(job.transientFailures).toBe(0);
  });
  it("recovers an invocation that died with an unexpired lease", async () => {
    job = {...job, leaseId: "dead-worker", nextAttemptAtMs: clock + 600000};
    expect(await processClassicSupplyJob("ar_20")).toBe("skipped");
    clock += 600000;
    expect(await processClassicSupplyJob("ar_20")).toBe("generated");
    expect(job.leaseId).not.toBe("dead-worker");
  });
  it("does not let a superseded worker commit its completion", async () => {
    generate.mockImplementation(async () => {job.leaseId = "new-owner";});
    await processClassicSupplyJob("ar_20");
    expect(job.completed).toBeUndefined();
  });
});
