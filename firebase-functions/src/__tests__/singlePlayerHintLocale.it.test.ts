import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {
  ensureAuthoritativeSession, getIssuedAuthoritativeSession, purchaseAuthoritativeHint,
  type SinglePlayerSessionState,
} from "../gameplay/sessions/singlePlayerSession";
import {getSinglePlayerContentKey, getSinglePlayerCompletionKey} from "../gameplay/sessions/singlePlayerAnswerPolicy";
import {projectPublicSinglePlayerSession} from "../gameplay/sessions/singlePlayerPublicSession";
import {HINT_COST_COINS} from "../shared/constants";

/** Canonical writes must remain in the allocated private demo emulator. */
const PROJECT = process.env.GCLOUD_PROJECT ?? "";
/** This account alone owns every session, receipt and cleanup in the fixture. */
const OWNER = `jest_${"0123456789".repeat(4)}`;
/** Real SDK transactions retain production read, conflict and retry behavior. */
let db: FirebaseFirestore.Firestore;
/** Opaque reference construction matches the authority's stored receipt identity. */
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
/** Every case obtains its token through normal server-owned session issuance. */
const issue = (locale: string, answer: string) => ensureAuthoritativeSession(OWNER, "classic", "classic-1", locale,
  getSinglePlayerContentKey({riddleId: "classic-1", text: "Fixture clue", answer}, "classic", locale),
  getSinglePlayerCompletionKey("classic", 1), answer, {classicIndex: 1});
/** Only this fixture account and its descendant documents are removed. */
const clear = async () => db.recursiveDelete(db.doc(`users/${OWNER}`));
beforeAll(() => {
  if (!PROJECT.startsWith("demo-") || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ""))
    throw new Error("Private demo Firestore emulator required");
  if (!getApps().length) initializeApp({projectId: PROJECT});
  db = getFirestore();
});
beforeEach(async () => {
  await clear();
  await db.doc(`users/${OWNER}`).set({userId: OWNER, coins: 550, hasPurchasedApp: true,
    progress: {classicIndex: 1}, stats: {gamesPlayed: 0, totalHintsUsed: 1},
    unlockedAchievements: [{achievementId: "hint_user", unlockedAt: 1}, {achievementId: "first_purchase", unlockedAt: 1}]});
});
afterAll(clear);

it.each([
  {locale: "en", answer: "piano", letter: "P"},
  {locale: "tr", answer: "izmir", letter: "İ"},
  {locale: "tr", answer: "IRMAK", letter: "I"},
])("commits and replays a usable $locale/$answer hint with one charge", async ({locale, answer, letter}) => {
  /** Blank input requests the first canonical letter in the immutable content locale. */
  const sessionToken = await issue(locale, answer);
  /** Exact retry identity belongs to this issued session and submitted attempt. */
  const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken,
    requestId: "hint-locale-receipt-0001", currentAttempt: Array(5).fill("") as string[]};
  /** Concurrent transport retries must converge on one stored transaction result. */
  const [first, concurrent] = await Promise.all([
    purchaseAuthoritativeHint(OWNER, request), purchaseAuthoritativeHint(OWNER, request),
  ]);
  expect(first).toMatchObject({index: 0, revealedLetter: letter, coinsCost: HINT_COST_COINS,
    newCoins: 550 - HINT_COST_COINS});
  expect(concurrent).toEqual(first);
  expect(await purchaseAuthoritativeHint(OWNER, request)).toEqual(first);
  expect(await purchaseAuthoritativeHint(OWNER, {...request, requestId: "hint-locale-semantic-0002"})).toEqual(first);
  await expect(purchaseAuthoritativeHint(OWNER, {...request, currentAttempt: ["x", "", "", "", ""]}))
    .rejects.toMatchObject({code: "already-exists"});
  /** Canonical recovery and durable profile values verify both glyph shape and idempotence. */
  const state = await getIssuedAuthoritativeSession(OWNER, sessionToken, "classic", "classic-1");
  expect(projectPublicSinglePlayerSession(state).revealedHints).toEqual([{index: 0, letter}]);
  expect(state.hintRevealedIndices).toEqual([0]);
  expect(state.attempts).toBe(0);
  expect((await db.doc(`users/${OWNER}`).get()).data()).toMatchObject({coins: 550 - HINT_COST_COINS,
    stats: {totalHintsUsed: 2}});
});

it("replays historical receipt bytes while recovering the canonical Turkish hint", async () => {
  /** Current issuance and first purchase provide a real canonical session and receipt shape. */
  const sessionToken = await issue("tr", "izmir");
  /** The legacy receipt retains its original transport identity and charge. */
  const request = {riddleId: "classic-1", gameMode: "classic" as const, sessionToken,
    requestId: "legacy-hint-receipt-0001", currentAttempt: Array(5).fill("") as string[]};
  /** Fresh code emits the dotted glyph before the fixture models a pre-fix cached response. */
  const first = await purchaseAuthoritativeHint(OWNER, request);
  expect(first?.revealedLetter).toBe("İ");
  /** Only this private session is adjusted to represent the old default-cased receipt. */
  const ref = db.doc(`users/${OWNER}/singlePlayerSessions/${hash(sessionToken)}`);
  /** Original canonical fields remain unchanged outside the modeled receipt glyph. */
  const stored = (await ref.get()).data() as SinglePlayerSessionState;
  /** A historical response must retain its exact immutable payload on retry. */
  const legacy = {...first!, revealedLetter: "I"};
  await ref.update({hintReceipts: {...stored.hintReceipts,
    [hash(request.requestId)]: {...stored.hintReceipts![hash(request.requestId)], result: legacy}}, lastHintResult: legacy});
  expect(await purchaseAuthoritativeHint(OWNER, request)).toEqual(legacy);
  expect(await purchaseAuthoritativeHint(OWNER, {...request, requestId: "legacy-hint-semantic-0002"})).toEqual(legacy);
  /** Answer-free recovery independently derives the correct display glyph from immutable content. */
  const recovered = await getIssuedAuthoritativeSession(OWNER, sessionToken, "classic", "classic-1");
  expect(recovered.hintReceipts![hash(request.requestId)].result).toEqual(legacy);
  expect(projectPublicSinglePlayerSession(recovered).revealedHints).toEqual([{index: 0, letter: "İ"}]);
  expect((await db.doc(`users/${OWNER}`).get()).data()).toMatchObject({coins: 550 - HINT_COST_COINS,
    stats: {totalHintsUsed: 2}});
});
