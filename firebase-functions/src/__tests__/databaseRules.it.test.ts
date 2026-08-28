import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {get, onValue, ref, set} from "firebase/database";

/** Defines the project id value. */
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "riddle-quest-ec2b2";
/** Defines the jest user value. */
const JEST_USER = `jest_${"a".repeat(40)}`;
/** Defines the facebook user value. */
const FACEBOOK_USER = `facebook_${"b".repeat(40)}`;
/** Provides environment behavior. */
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {rules: readFileSync(join(__dirname, "../../database.rules.json"), "utf8")},
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), "presenceStatus/player-2"), {state: "racing", updatedAt: 1});
    await set(ref(context.database(), "presenceVisibility/player-1/player-2"), true);
    await set(ref(context.database(), "presenceOptIn/player-2"), true);
    await set(ref(context.database(), "presenceViewers/player-2/player-1"), true);
    await set(ref(context.database(), `presenceConsent/${JEST_USER}`), true);
    await set(ref(context.database(), `presenceConsent/${FACEBOOK_USER}`), true);
    await set(ref(context.database(), "featureGates/facebookPresence"), true);
  });
});

afterAll(async () => environment.cleanup());

describe("Realtime Database presence rules", () => {
  it("permits only validated own-session writes and no connection reads", async () => {
    /** Provides own behavior. */
    const own = environment.authenticatedContext(JEST_USER, {jestPlayerId: "jest-player"}).database();
    /** Provides facebook behavior. */
    const facebook = environment.authenticatedContext(FACEBOOK_USER, {provider: "facebook"}).database();
    /** Provides other behavior. */
    const other = environment.authenticatedContext("player-2").database();
    /** Provides path behavior. */
    const path = `presenceConnections/${JEST_USER}/session-1`;
    await assertSucceeds(set(ref(own, path), {platform: "jest", state: "online", updatedAt: 1}));
    await assertFails(get(ref(own, path)));
    await assertFails(set(ref(other, path), {platform: "facebook", state: "racing", updatedAt: 2}));
    await assertFails(set(ref(own, path), {platform: "jest", state: "forged", updatedAt: 2}));
    await assertFails(set(ref(own, path), {platform: "facebook", state: "online", updatedAt: 2}));
    await assertSucceeds(
      set(ref(facebook, `presenceConnections/${FACEBOOK_USER}/session-2`), {
        platform: "facebook",
        state: "racing",
        updatedAt: 2,
      }),
    );
    await assertFails(
      set(ref(facebook, `presenceConnections/${FACEBOOK_USER}/session-2`), {
        platform: "jest",
        state: "racing",
        updatedAt: 2,
      }),
    );
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), `presenceConsent/${FACEBOOK_USER}`), false);
    });
    await assertFails(
      set(ref(facebook, `presenceConnections/${FACEBOOK_USER}/stale-tab`), {
        platform: "facebook",
        state: "online",
        updatedAt: 3,
      }),
    );
    await assertFails(set(ref(facebook, `presenceConsent/${FACEBOOK_USER}`), true));
    await assertSucceeds(set(ref(facebook, `presenceConnections/${FACEBOOK_USER}/session-2`), null));
    await assertFails(set(ref(own, path), {platform: "jest", state: "online", updatedAt: -1}));
    await assertFails(
      set(ref(own, path), {
        platform: "jest",
        state: "online",
        updatedAt: Date.now() + 120_000,
      }),
    );
    await assertSucceeds(set(ref(own, path), null));
  });

  it("reveals aggregate status only to self or an explicit known-rival viewer", async () => {
    /** Provides viewer behavior. */
    const viewer = environment.authenticatedContext("player-1").database();
    /** Provides self behavior. */
    const self = environment.authenticatedContext("player-2").database();
    /** Provides stranger behavior. */
    const stranger = environment.authenticatedContext("player-3").database();
    /** Provides anonymous behavior. */
    const anonymous = environment.unauthenticatedContext().database();
    /** Provides path behavior. */
    const path = "presenceStatus/player-2";
    await assertSucceeds(get(ref(viewer, path)));
    await assertSucceeds(get(ref(self, path)));
    await assertFails(get(ref(stranger, path)));
    await assertFails(get(ref(anonymous, path)));
    await assertFails(set(ref(viewer, "presenceVisibility/player-1/player-3"), true));
    await assertFails(get(ref(viewer, "presenceViewers/player-2/player-1")));
    await assertFails(set(ref(viewer, "presenceViewers/player-2/player-1"), true));
    await assertFails(set(ref(self, path), {state: "online", updatedAt: 2}));
  });

  it("fails Facebook presence closed at the server gate without affecting Jest", async () => {
    /** Provides facebook behavior. */
    const facebook = environment.authenticatedContext(FACEBOOK_USER, {provider: "facebook"}).database();
    /** Provides jest player behavior. */
    const jestPlayer = environment.authenticatedContext(JEST_USER, {jestPlayerId: "jest-player"}).database();
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), `presenceStatus/${FACEBOOK_USER}`), {state: "online", updatedAt: 1});
      await set(ref(context.database(), `presenceStatus/${JEST_USER}`), {state: "online", updatedAt: 1});
      await set(ref(context.database(), `presenceOptIn/${FACEBOOK_USER}`), true);
      await set(ref(context.database(), `presenceVisibility/${JEST_USER}/${FACEBOOK_USER}`), true);
    });
    /** Resolves initial. */
    let resolveInitial!: () => void;
    /** Resolves revoked. */
    let resolveRevoked!: () => void;
    /** Provides initial behavior. */
    const initial = new Promise<void>((resolve) => {
      resolveInitial = resolve;
    });
    /** Provides revoked behavior. */
    const revoked = new Promise<void>((resolve) => {
      resolveRevoked = resolve;
    });
    /** Provides unsubscribe behavior. */
    const unsubscribe = onValue(
      ref(jestPlayer, `presenceStatus/${FACEBOOK_USER}`),
      (snapshot) => {
        if (snapshot.exists()) resolveInitial();
      },
      (error) => {
        if (error.code === "PERMISSION_DENIED") resolveRevoked();
      },
    );
    await initial;
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), "featureGates/facebookPresence"), false);
    });
    await revoked;
    unsubscribe();
    await assertFails(get(ref(facebook, `presenceStatus/${FACEBOOK_USER}`)));
    await assertFails(
      set(ref(facebook, `presenceConnections/${FACEBOOK_USER}/disabled`), {
        platform: "facebook",
        state: "online",
        updatedAt: 2,
      }),
    );
    await assertSucceeds(get(ref(jestPlayer, `presenceStatus/${JEST_USER}`)));
    await assertSucceeds(
      set(ref(jestPlayer, `presenceConnections/${JEST_USER}/enabled`), {
        platform: "jest",
        state: "online",
        updatedAt: 2,
      }),
    );
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), "featureGates/facebookPresence"), true);
    });
  });

  it("revokes a rival read when the target has no opted-in connection", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), "presenceOptIn/player-2"), false);
    });
    /** Provides viewer behavior. */
    const viewer = environment.authenticatedContext("player-1").database();
    /** Provides self behavior. */
    const self = environment.authenticatedContext("player-2").database();
    await assertFails(get(ref(viewer, "presenceStatus/player-2")));
    await assertSucceeds(get(ref(self, "presenceStatus/player-2")));
  });
});
