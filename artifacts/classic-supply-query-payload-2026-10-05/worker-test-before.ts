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
/** Provides db behavior. */
const db = {collection: jest.fn(() => ({doc: jest.fn(() => ref)})), runTransaction: jest.fn(async callback => callback(transaction))};
jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore: () => db}}));
jest.mock("../shared/sentryHandlers", () => ({onScheduleWithSentry: jest.fn()}));
jest.mock("../shared/sentry", () => ({captureException: capture}));
jest.mock("../riddles/riddleGeneration", () => ({generateLocalizedClassicRiddlesForLocale: generate}));
import {processClassicSupplyJob} from "../riddles/classicSupplyWorker";

describe("durable Classic supply worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clock = 1000000;
    jest.spyOn(Date, "now").mockImplementation(() => clock);
    job = {locale: "ar", highestClassicIndex: 20, nextAttemptAtMs: 0};
    generate.mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it("completes the durable request and excludes successful replay", async () => {
    expect(await processClassicSupplyJob("ar_20")).toBe("generated");
    expect(generate).toHaveBeenCalledWith("ar", 5, clock + 180000);
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
