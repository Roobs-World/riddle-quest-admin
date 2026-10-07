import {
  assertRaceAccess,
  configureRaceRolloutCache,
  evaluateRaceRollout,
  getRaceAccessForUser,
  hashRaceCohortUser,
  recordRaceAnalyticsForUser,
} from "../../race/raceRollout";
import {admin} from "../../shared/firebaseAdmin";

describe("Race rollout cohort evaluation", () => {
  it("defaults off for missing or malformed configuration", () => {
    expect(evaluateRaceRollout(undefined, "player-1")).toEqual({
      enabled: false,
      locale: "en",
      reason: "rollout_disabled",
    });
    expect(evaluateRaceRollout({enabled: "yes"}, "player-1").enabled).toBe(false);
  });

  it("supports a deterministic percentage cohort", () => {
    expect(evaluateRaceRollout({enabled: true, percentage: 100, allowlistHashes: []}, "player-1").enabled).toBe(true);
    expect(evaluateRaceRollout({enabled: true, percentage: 0, allowlistHashes: []}, "player-1")).toMatchObject({
      enabled: false,
      reason: "not_in_cohort",
    });
  });

  it("allows a hashed player override without storing the raw ID", () => {
    /** Provides hash behavior. */
    const hash = hashRaceCohortUser("player-1");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(evaluateRaceRollout({enabled: true, percentage: 0, allowlistHashes: [hash]}, "player-1").enabled).toBe(true);
  });

  /** Creates db. */
  const createDb = ({rollout = {enabled: true, percentage: 100, allowlistHashes: []}, duplicate = false} = {}) => {
    /** Provides create behavior. */
    const create = jest.fn(async () => {
      if (duplicate) throw Object.assign(new Error("already exists"), {code: 6});
    });
    /** Provides analytics reference behavior. */
    const analyticsReference = {path: "raceAnalytics/event", create};
    /** Provides transaction behavior. */
    const transaction = {
      get: jest.fn(async () => ({exists: duplicate})),
      create,
    };
    /** Provides db behavior. */
    const db = {
      doc: jest.fn(() => ({get: jest.fn(async () => ({exists: rollout !== null, data: () => rollout}))})),
      collection: jest.fn(() => ({doc: jest.fn(() => analyticsReference)})),
      runTransaction: jest.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
    };
    return {db, create, transaction};
  };

  it("persists analytics without a receipt-read transaction", async () => {
    /** Atomic creation enforces uniqueness without reading the receipt first. */
    const {db} = createDb();
    await recordRaceAnalyticsForUser("player-1", {
      eventId: "event-budget", eventName: "race_mode_viewed", params: {},
    }, {db: db as never});
    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("keeps non-English race disabled for Jest identities", async () => {
    /** Provides {db} behavior. */
    const {db} = createDb();
    await expect(getRaceAccessForUser("player-1", "fr", db as never)).resolves.toMatchObject({enabled: false});
    expect(db.doc).not.toHaveBeenCalled();
  });

  it("allows rollout-gated non-English race for Facebook and Reddit identities", async () => {
    /** Provides {db} behavior. */
    const {db} = createDb();
    /** Provides facebook uid behavior. */
    const facebookUid = `facebook_${"a".repeat(40)}`;
    await expect(getRaceAccessForUser(facebookUid, "fr", db as never)).resolves.toEqual({
      enabled: true,
      locale: "fr",
      reason: "enabled",
    });
    /** Provides reddit uid behavior. */
    const redditUid = `reddit_${"b".repeat(40)}`;
    await expect(getRaceAccessForUser(redditUid, "ar", db as never)).resolves.toEqual({
      enabled: true,
      locale: "ar",
      reason: "enabled",
    });
    expect(db.doc).toHaveBeenCalledWith("raceConfig/rollout");
  });

  it("loads existing and missing authoritative rollout documents", async () => {
    /** Provides enabled behavior. */
    const enabled = createDb();
    await expect(getRaceAccessForUser("player-1", "en", enabled.db as never)).resolves.toMatchObject({enabled: true});

    /** Provides missing behavior. */
    const missing = createDb({rollout: null as never});
    await expect(getRaceAccessForUser("player-1", "en", missing.db as never)).resolves.toMatchObject({enabled: false});
  });

  it("asserts cohort access", async () => {
    await expect(assertRaceAccess("player-1", "en", createDb().db as never)).resolves.toBeUndefined();
    await expect(
      assertRaceAccess(
        "player-1",
        "en",
        createDb({rollout: {enabled: false, percentage: 0, allowlistHashes: []}}).db as never,
      ),
    ).rejects.toMatchObject({code: "permission-denied"});
  });

  it("records allowlisted analytics fields once", async () => {
    /** Provides {db, create} behavior. */
    const {db, create} = createDb();

    await expect(
      recordRaceAnalyticsForUser(
        "player-1",
        {
          eventId: "event-1",
          eventName: "race_category_selected",
          params: {categoryId: "history", secret: "discarded"},
        },
        {db: db as never, nowMs: 1000},
      ),
    ).resolves.toEqual({accepted: true});

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "race_category_selected",
        params: {categoryId: "history"},
        createdAtMs: 1000,
      }),
    );
  });

  it("treats repeated analytics event IDs as idempotent", async () => {
    /** Provides {db, create} behavior. */
    const {db, create} = createDb({duplicate: true});

    await expect(
      recordRaceAnalyticsForUser(
        "player-1",
        {
          eventId: "event-1",
          eventName: "race_mode_viewed",
          params: {},
        },
        {db: db as never},
      ),
    ).resolves.toEqual({accepted: true});

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("propagates non-duplicate persistence failures", async () => {
    /** Storage failures must not acknowledge events that were never persisted. */
    const {db, create} = createDb();
    /** Representative unavailable RPC retains its original failure. */
    const failure = Object.assign(new Error("unavailable"), {code: 14});
    create.mockRejectedValueOnce(failure);
    await expect(recordRaceAnalyticsForUser("player-1", {
      eventId: "event-failure", eventName: "race_mode_viewed", params: {},
    }, {db: db as never})).rejects.toBe(failure);
  });

  it("uses Firebase and clock defaults when adapters are omitted", async () => {
    /** Provides {db, create} behavior. */
    const {db, create} = createDb();
    /** Provides firestore behavior. */
    const firestore = jest.spyOn(admin, "firestore").mockReturnValue(db as never);
    Object.assign(admin.firestore, {Timestamp: {fromMillis: (value: number) => ({value})}});

    await expect(getRaceAccessForUser("player-1", "en")).resolves.toMatchObject({enabled: true});
    await expect(assertRaceAccess("player-1")).resolves.toBeUndefined();
    await expect(
      recordRaceAnalyticsForUser("player-1", {
        eventId: "event-defaults",
        eventName: "race_mode_viewed",
        params: {},
      }),
    ).resolves.toEqual({accepted: true});

    expect(create).toHaveBeenCalledWith(expect.objectContaining({createdAtMs: expect.any(Number)}));
    firestore.mockRestore();
  });
});

describe("Race rollout configuration cache", () => {
  /** Mutable fake clock. */
  let now = 0;
  /** Database whose rollout reads are counted. */
  const createCountingDb = (results: Array<unknown | Error>) => {
    /** Counts document reads. */
    const get = jest.fn(async () => {
      /** Next queued result. */
      const next = results.length > 1 ? results.shift() : results[0];
      if (next instanceof Error) throw next;
      return {exists: true, data: () => next};
    });
    return {db: {doc: jest.fn(() => ({get}))} as unknown as FirebaseFirestore.Firestore, get};
  };

  beforeEach(() => {
    now = 0;
    configureRaceRolloutCache({ttlMs: 15_000, now: () => now});
  });

  afterAll(() => configureRaceRolloutCache({ttlMs: 0}));

  it("reuses one read for concurrent and repeated checks within the window", async () => {
    /** Enabled rollout database. */
    const {db, get} = createCountingDb([{enabled: true, percentage: 100, allowlistHashes: []}]);
    await Promise.all([assertRaceAccess("a", "en", db), assertRaceAccess("b", "en", db)]);
    now = 14_999;
    await expect(getRaceAccessForUser("c", "en", db)).resolves.toMatchObject({enabled: true});
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("observes a disabled rollout after the window expires", async () => {
    /** Rollout enabled, then disabled. */
    const {db, get} = createCountingDb([
      {enabled: true, percentage: 100, allowlistHashes: []},
      {enabled: false, percentage: 100, allowlistHashes: []},
    ]);
    await expect(assertRaceAccess("a", "en", db)).resolves.toBeUndefined();
    now = 15_000;
    await expect(assertRaceAccess("a", "en", db)).rejects.toMatchObject({code: "permission-denied"});
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does not retain a failed read", async () => {
    /** First read fails transiently. */
    const {db, get} = createCountingDb([new Error("unavailable"), {enabled: true, percentage: 100, allowlistHashes: []}]);
    await expect(assertRaceAccess("a", "en", db)).rejects.toThrow("unavailable");
    await expect(assertRaceAccess("a", "en", db)).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("uses the default production clock and expires cached access after 15 seconds", async () => {
    const originalWorkerId = process.env.JEST_WORKER_ID;
    const originalEmulator = process.env.FUNCTIONS_EMULATOR;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    delete process.env.JEST_WORKER_ID;
    delete process.env.FUNCTIONS_EMULATOR;
    try {
      let productionRollout!: typeof import("../../race/raceRollout");
      jest.isolateModules(() => {
        productionRollout = require("../../race/raceRollout");
      });
      const {db, get} = createCountingDb([
        {enabled: true, percentage: 100, allowlistHashes: []},
        {enabled: false, percentage: 0, allowlistHashes: []},
      ]);
      await expect(productionRollout.getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: true});
      now = 14_999;
      await expect(productionRollout.getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: true});
      expect(get).toHaveBeenCalledTimes(1);
      now = 15_000;
      await expect(productionRollout.getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: false});
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      clock.mockRestore();
      if (originalWorkerId === undefined) delete process.env.JEST_WORKER_ID;
      else process.env.JEST_WORKER_ID = originalWorkerId;
      if (originalEmulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = originalEmulator;
    }
  });

  it("uses the system clock when a configured TTL omits a custom clock", async () => {
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    try {
      configureRaceRolloutCache({ttlMs: 5_000});
      const {db, get} = createCountingDb([
        {enabled: true, percentage: 100, allowlistHashes: []},
        {enabled: false, percentage: 0, allowlistHashes: []},
      ]);
      await expect(getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: true});
      now = 4_999;
      await expect(getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: true});
      expect(get).toHaveBeenCalledTimes(1);
      now = 5_000;
      await expect(getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: false});
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      clock.mockRestore();
    }
  });

  it("retains a newer disabled rollout when an expired pending read fails", async () => {
    const {db, get} = createCountingDb([{enabled: false, percentage: 0, allowlistHashes: []}]);
    let rejectRead!: (reason: Error) => void;
    get.mockImplementationOnce(() => new Promise((_, reject) => {rejectRead = reject;}));
    const expiredRead = getRaceAccessForUser("a", "en", db);
    now = 15_000;
    await expect(getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: false});
    expect(get).toHaveBeenCalledTimes(2);

    const failure = new Error("expired rollout read unavailable");
    const rejectedRead = expect(expiredRead).rejects.toBe(failure);
    rejectRead(failure);
    await rejectedRead;
    now = 15_001;
    await expect(getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: false});
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("reads through when disabled", async () => {
    configureRaceRolloutCache({ttlMs: 0});
    /** Enabled rollout database. */
    const {db, get} = createCountingDb([{enabled: true, percentage: 100, allowlistHashes: []}]);
    await assertRaceAccess("a", "en", db);
    await assertRaceAccess("a", "en", db);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
