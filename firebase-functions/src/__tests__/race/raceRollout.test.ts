import {RACE_SUPPORTED_LOCALES} from "@riddle-quest/core/race";
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

  /** Reads the canonical native profile separately from the actual rollout document. */
  const createAndroidDb = (profile: unknown, rollout: unknown = {enabled: true, percentage: 100, allowlistHashes: []}) => ({
    doc: jest.fn((path: string) => ({
      get: jest.fn(async () => ({
        exists: path.startsWith("users/") ? profile !== undefined : rollout !== null,
        data: () => path.startsWith("users/") ? profile : rollout,
      })),
    })),
  });

  it.each(RACE_SUPPORTED_LOCALES)("applies canonical Android identity and actual rollout policy in %s", async locale => {
    /** Native Firebase uid has no provider prefix, so profile authority must select Android. */
    const uid = "a".repeat(28);
    for (const androidProvider of ["anonymous", "google.com"]) {
      /** Both native sign-in modes remain gated by the current server rollout. */
      const enabled = createAndroidDb({androidProvider});
      await expect(getRaceAccessForUser(uid, locale, enabled as never)).resolves.toEqual({enabled: true, locale, reason: "enabled"});
      expect(enabled.doc.mock.calls.map(([path]) => path)).toEqual([`users/${uid}`, "raceConfig/rollout"]);
    }
    /** A canonical Android account does not bypass an emergency rollout disable. */
    const disabled = createAndroidDb({androidProvider: "anonymous"}, {enabled: false, percentage: 100, allowlistHashes: []});
    await expect(getRaceAccessForUser(uid, locale, disabled as never)).resolves.toEqual({enabled: false, locale, reason: "rollout_disabled"});
    /** Zero-percent enrollment still rejects an otherwise valid native identity. */
    const outsideCohort = createAndroidDb({androidProvider: "google.com"}, {enabled: true, percentage: 0, allowlistHashes: []});
    await expect(getRaceAccessForUser(uid, locale, outsideCohort as never)).resolves.toEqual({enabled: false, locale, reason: "not_in_cohort"});
    /** The normal hashed cohort override works without storing a raw Android uid in config. */
    const allowlisted = createAndroidDb({androidProvider: "google.com"}, {enabled: true, percentage: 0, allowlistHashes: [hashRaceCohortUser(uid)]});
    await expect(getRaceAccessForUser(uid, locale, allowlisted as never)).resolves.toEqual({enabled: true, locale, reason: "enabled"});
  });

  it.each([
    {name: "missing account", profile: undefined},
    {name: "missing provider marker", profile: {}},
    {name: "null provider marker", profile: {androidProvider: null}},
    {name: "another provider marker", profile: {androidProvider: "jest"}},
    {name: "malformed provider marker", profile: {androidProvider: true}},
  ])("refuses Android rollout before config access for $name", async ({profile}) => {
    /** A Firebase-shaped uid alone must never authorize native multiplayer. */
    const uid = "b".repeat(28);
    for (const locale of RACE_SUPPORTED_LOCALES) {
      /** Invalid canonical profiles must fail even when the configured rollout is open. */
      const db = createAndroidDb(profile);
      await expect(getRaceAccessForUser(uid, locale, db as never)).rejects.toMatchObject({code: "permission-denied"});
      expect(db.doc.mock.calls.map(([path]) => path)).toEqual([`users/${uid}`]);
    }
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
    /** Worker marker restored after exercising the production cache default. */
    const originalWorkerId = process.env.JEST_WORKER_ID;
    /** Emulator marker restored after exercising the production cache default. */
    const originalEmulator = process.env.FUNCTIONS_EMULATOR;
    /** System clock controlled at the cache expiry boundary. */
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    delete process.env.JEST_WORKER_ID;
    delete process.env.FUNCTIONS_EMULATOR;
    try {
      /** Fresh rollout module initialized without test or emulator markers. */
      let productionRollout!: typeof import("../../race/raceRollout");
      jest.isolateModules(() => {
        productionRollout = require("../../race/raceRollout");
      });
      /** Rollout reads switch from enabled to disabled after the cache expires. */
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
    /** System clock controlled at the cache expiry boundary. */
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    try {
      configureRaceRolloutCache({ttlMs: 5_000});
      /** Rollout reads switch from enabled to disabled after the cache expires. */
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
    /** Newer rollout read disables access while an older read remains pending. */
    const {db, get} = createCountingDb([{enabled: false, percentage: 0, allowlistHashes: []}]);
    /** Rejects the superseded pending read after the newer value is cached. */
    let rejectRead!: (reason: Error) => void;
    get.mockImplementationOnce(() => new Promise((_, reject) => {rejectRead = reject;}));
    /** Initial rollout read retained past its cache window. */
    const expiredRead = getRaceAccessForUser("a", "en", db);
    now = 15_000;
    await expect(getRaceAccessForUser("a", "en", db)).resolves.toMatchObject({enabled: false});
    expect(get).toHaveBeenCalledTimes(2);

    /** Transient failure delivered only to the superseded read. */
    const failure = new Error("expired rollout read unavailable");
    /** Rejection assertion attached before rejecting the pending provider read. */
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
