import {
  assertRaceAccess,
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
    const create = jest.fn();
    /** Provides analytics reference behavior. */
    const analyticsReference = {path: "raceAnalytics/event"};
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
      expect.anything(),
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

    expect(create).not.toHaveBeenCalled();
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

    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({createdAtMs: expect.any(Number)}));
    firestore.mockRestore();
  });
});
