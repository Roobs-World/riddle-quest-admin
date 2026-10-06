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
import {processClassicSupplyJob, processClassicSupplyJobs} from "../riddles/classicSupplyWorker";

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
    expect(transaction.getAll).toHaveBeenNthCalledWith(1, ref, {fieldMask: ["nextAttemptAtMs", "completed", "locale"]});
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
