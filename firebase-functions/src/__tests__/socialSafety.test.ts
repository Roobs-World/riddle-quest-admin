// Real operation leases and permission delivery are exercised by emulator suites.
jest.mock("../jest/jestAccountDeletion", () => ({
  ...jest.requireActual("../jest/jestAccountDeletion"),
  runWithJestAccountOperationLease: (_owner: string, _timeout: number, operation: () => Promise<unknown>) =>
    operation(),
}));

import type {Database} from "firebase-admin/database";
import {SOCIAL_REPORT_DAILY_LIMIT, blockKnownRival, reportKnownRival} from "../social/socialSafety";

/** Renders the reporter interface. */
const REPORTER = `facebook_${"a".repeat(40)}`;
/** Renders the target interface. */
const TARGET = `facebook_${"b".repeat(40)}`;
/** Renders the now interface. */
const NOW = Date.UTC(2026, 7, 19);

/** Provides fake db behavior. */
const fakeDb = (known = true) => {
  /** Provides values behavior. */
  const values = new Map<string, Record<string, unknown>>();
  if (known)
    values.set(`users/${REPORTER}/knownRivals/${TARGET}`, {
      targetUserId: TARGET,
      source: "completed_race",
      establishedAtMs: NOW,
    });
  /** Provides snapshot behavior. */
  const readTime = {seconds: 1, nanoseconds: 2, isEqual: () => true};
  /** Snapshot time is independent of caller-supplied reporting time. */
  const snapshot = (path: string) => ({exists: values.has(path), readTime, data: () => values.get(path)});
  /** Provides ref behavior. */
  const ref = (path: string) => ({path, get: async () => snapshot(path)});
  /** Provides transaction behavior. */
  const transaction = {
    getAll: async (
      ...references: Array<{
        /** Source document path. */
        path: string;
      }>
    ) => references.map(({path}) => snapshot(path)),
    get: jest.fn(
      async ({
        path,
      }: {
        /** Stores path. */ /** Stores path. */ /** Stores path. */
        /** Stores path. */
        path: string;
      }) => snapshot(path),
    ),
    set: jest.fn(
      (
        {
          path,
        }: {
          /** Stores path. */
          path: string;
        },
        value: Record<string, unknown>,
      ) => values.set(path, value),
    ),
    create: jest.fn(
      (
        {
          path,
        }: {
          /** Stores path. */
          path: string;
        },
        value: Record<string, unknown>,
      ) => {
        if (values.has(path)) throw new Error("already-exists");
        values.set(path, value);
      },
    ),
  };
  /** Provides db behavior. */
  const db = {
    doc: ref,
    collection: (name: string) => ({doc: (id: string) => ref(`${name}/${id}`)}),
    runTransaction: async <T>(callback: (value: typeof transaction) => Promise<T>) => callback(transaction),
  } as unknown as FirebaseFirestore.Firestore;
  /** Provides presence updates behavior. */
  const presenceUpdates: Record<string, unknown> = {};
  /** Provides database behavior. */
  const database = {
    ref: (path?: string) => ({
      update: jest.fn(async (value: Record<string, unknown>) => Object.assign(presenceUpdates, value)),
      transaction: async (operation: (value: unknown) => unknown) => {
        /** Applies the requested change to the independently stored fixture permission. */
        const next = operation(presenceUpdates[path!] ?? null);
        if (next !== undefined) presenceUpdates[path!] = next;
        return {
          snapshot: {child: (key: string) => ({val: () => (presenceUpdates[path!] as Record<string, unknown>)?.[key]})},
        };
      },
    }),
  } as unknown as Database;
  return {database, db, presenceUpdates, values};
};

describe("social safety service", () => {
  it("blocks only an established rival and stores no display identity", async () => {
    /** Provides {database, db, presence updates, values} behavior. */
    const {database, db, presenceUpdates, values} = fakeDb();
    await expect(blockKnownRival(REPORTER, TARGET, {database, db, nowMs: NOW})).resolves.toEqual({blocked: true});
    expect(values.get(`users/${REPORTER}/blockedRivals/${TARGET}`)).toEqual({targetUserId: TARGET, blockedAtMs: NOW});
    expect(presenceUpdates).toMatchObject({
      [`presenceVisibility/${REPORTER}/${TARGET}`]: expect.objectContaining({allowed: false}),
      [`presenceViewers/${TARGET}/${REPORTER}`]: true,
      [`presenceVisibility/${TARGET}/${REPORTER}`]: expect.objectContaining({allowed: false}),
      [`presenceViewers/${REPORTER}/${TARGET}`]: true,
    });
    /** Provides unknown behavior. */
    const unknown = fakeDb(false);
    await expect(
      blockKnownRival(REPORTER, TARGET, {database: unknown.database, db: unknown.db, nowMs: NOW}),
    ).rejects.toMatchObject({code: "permission-denied"});
  });

  it("queues categorized reports idempotently without free-form content", async () => {
    /** Provides {db, values} behavior. */
    const {db, values} = fakeDb();
    /** Provides input behavior. */
    const input = {targetUserId: TARGET, category: "cheating" as const, requestId: "request-0001"};
    /** Provides first behavior. */
    const first = await reportKnownRival(REPORTER, input, {db, nowMs: NOW});
    /** Provides second behavior. */
    const second = await reportKnownRival(REPORTER, input, {db, nowMs: NOW + 1});
    expect(second).toEqual(first);
    /** Provides report behavior. */
    const report = values.get(`socialModerationQueue/${first.reportId}`);
    expect(report).toMatchObject({reporterId: REPORTER, targetUserId: TARGET, category: "cheating", status: "queued"});
    expect(JSON.stringify(report)).not.toMatch(/message|chat|detail|name|photo/i);
    await expect(reportKnownRival(REPORTER, {...input, category: "spam"}, {db, nowMs: NOW + 2})).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("enforces five unique reports per UTC day", async () => {
    /** Provides {db} behavior. */
    const {db} = fakeDb();
    for (let index = 0; index < SOCIAL_REPORT_DAILY_LIMIT; index += 1) {
      await reportKnownRival(
        REPORTER,
        {
          targetUserId: TARGET,
          category: "spam",
          requestId: `request-${String(index).padStart(4, "0")}`,
        },
        {db, nowMs: NOW},
      );
    }
    await expect(
      reportKnownRival(
        REPORTER,
        {
          targetUserId: TARGET,
          category: "spam",
          requestId: "request-over-limit",
        },
        {db, nowMs: NOW},
      ),
    ).rejects.toMatchObject({code: "resource-exhausted"});
  });

  it("rejects self-targets, unknown categories, and short idempotency keys", async () => {
    /** Provides {db} behavior. */
    const {db} = fakeDb();
    await expect(
      reportKnownRival(
        REPORTER,
        {
          targetUserId: REPORTER,
          category: "spam",
          requestId: "request-0001",
        },
        {db, nowMs: NOW},
      ),
    ).rejects.toMatchObject({code: "invalid-argument"});
    await expect(
      reportKnownRival(
        REPORTER,
        {
          targetUserId: TARGET,
          category: "unsafe" as "spam",
          requestId: "request-0001",
        },
        {db, nowMs: NOW},
      ),
    ).rejects.toMatchObject({code: "invalid-argument"});
    await expect(
      reportKnownRival(
        REPORTER,
        {
          targetUserId: TARGET,
          category: "spam",
          requestId: "short",
        },
        {db, nowMs: NOW},
      ),
    ).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("rejects unsafe clocks and malformed rivalry or rate-limit state", async () => {
    /** Provides invalid known behavior. */
    const invalidKnown = fakeDb();
    invalidKnown.values.set(`users/${REPORTER}/knownRivals/${TARGET}`, {
      targetUserId: TARGET,
      source: "untrusted",
      establishedAtMs: NOW,
    });
    await expect(blockKnownRival(REPORTER, TARGET, {db: invalidKnown.db, nowMs: NOW})).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(
      reportKnownRival(
        REPORTER,
        {
          targetUserId: TARGET,
          category: "spam",
          requestId: "request-clock",
        },
        {db: invalidKnown.db, nowMs: Number.NaN},
      ),
    ).rejects.toMatchObject({code: "invalid-argument"});

    /** Provides corrupted limit behavior. */
    const corruptedLimit = fakeDb();
    await reportKnownRival(
      REPORTER,
      {
        targetUserId: TARGET,
        category: "spam",
        requestId: "request-first",
      },
      {db: corruptedLimit.db, nowMs: NOW},
    );
    /** Provides limit path behavior. */
    const limitPath = [...corruptedLimit.values.keys()].find((path) => path.startsWith("socialReportRateLimits/"));
    expect(limitPath).toBeDefined();
    corruptedLimit.values.set(limitPath!, {reporterId: REPORTER, day: "wrong", count: 0, updatedAtMs: NOW});
    await expect(
      reportKnownRival(
        REPORTER,
        {
          targetUserId: TARGET,
          category: "spam",
          requestId: "request-second",
        },
        {db: corruptedLimit.db, nowMs: NOW},
      ),
    ).rejects.toMatchObject({code: "data-loss"});
  });
});
