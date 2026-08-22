import {admin} from "../../shared/firebaseAdmin";
import type {RaceRunRecord} from "../../race/raceEngine";
import {
  PRIVATE_RACE_PLAYER_NAME,
  raceRunPrivacyWrite,
  resolveRaceOpponentPrivacy,
  scrubRaceOpponent,
} from "../../race/raceOpponentPrivacy";
import {
  hydrateRaceReceiptResponse,
  minimizeRaceReceiptResponse,
  raceReceiptExpiresAt,
} from "../../race/raceReceiptPrivacy";

const run = (overrides: Partial<RaceRunRecord> = {}): RaceRunRecord => ({
  runId: "run-1",
  userId: "player-1",
  role: "challenger",
  status: "active",
  categoryId: "history",
  locale: "en",
  rulesVersion: "race10_v1",
  deckId: "deck-1",
  riddles: [],
  currentPosition: 0,
  correctCount: 0,
  guessesUsed: 0,
  hintUsed: false,
  revealedLetters: [],
  startedAtMs: 1_000,
  hintPenaltyMs: 0,
  skipPenaltyMs: 0,
  events: [],
  ...overrides,
});

const opponent = (overrides: Partial<NonNullable<RaceRunRecord["opponent"]>> = {}) => ({
  subjectUserId: "creator-1",
  displayName: "Ada",
  avatarUrl: "https://example.test/ada.png",
  adjustedFinishMs: 12_000,
  events: [],
  ...overrides,
});

describe("race receipt privacy", () => {
  it("stores only a neutral opponent projection without mutating the response", () => {
    const response = {
      accepted: true,
      run: {opponent: {...opponent()}, status: "completed"},
    };

    expect(minimizeRaceReceiptResponse(response)).toEqual({
      accepted: true,
      run: {
        opponent: {
          subjectUserId: "creator-1",
          displayName: "Riddle Quest player",
          adjustedFinishMs: 12_000,
          events: [],
        },
        status: "completed",
      },
    });
    expect(response.run.opponent).toMatchObject({displayName: "Ada", avatarUrl: "https://example.test/ada.png"});
  });

  it.each([
    null,
    "response",
    {},
    {run: null},
    {run: {}},
    {run: {opponent: null}},
  ])("leaves responses without an opponent projection unchanged", (response) => {
    expect(minimizeRaceReceiptResponse(response)).toBe(response);
  });

  it("hydrates a replay from the current linked opponent identity", () => {
    const receipt = {
      run: {opponent: {displayName: "Stale", avatarUrl: "https://example.test/stale.png", adjustedFinishMs: 9_000}},
    };
    const currentRun = run({opponent: opponent({displayName: "Current", avatarUrl: "https://example.test/current.png"})});

    expect(hydrateRaceReceiptResponse(receipt, currentRun)).toEqual({
      run: {
        opponent: {
          displayName: "Current",
          avatarUrl: "https://example.test/current.png",
          adjustedFinishMs: 9_000,
        },
      },
    });
    expect(receipt.run.opponent.displayName).toBe("Stale");
  });

  it("removes a stale avatar when the linked opponent no longer has one", () => {
    const receipt = {run: {opponent: {displayName: "Stale", avatarUrl: "https://example.test/stale.png"}}};
    const currentRun = run({opponent: opponent({displayName: "Current", avatarUrl: null})});

    expect(hydrateRaceReceiptResponse(receipt, currentRun)).toEqual({
      run: {opponent: {displayName: "Current"}},
    });
  });

  it("keeps a replay neutral when no privacy-safe subject remains", () => {
    const receipt = {run: {opponent: {displayName: "Stale", avatarUrl: "https://example.test/stale.png"}}};
    const scrubbedRun = run({opponent: opponent({subjectUserId: undefined})});

    expect(hydrateRaceReceiptResponse(receipt, scrubbedRun)).toEqual({
      run: {opponent: {displayName: "Riddle Quest player"}},
    });
  });

  it("caps receipt retention to the earlier valid parent expiry", () => {
    expect(raceReceiptExpiresAt({toMillis: () => 800}, 1_000).toMillis()).toBe(800);
    expect(raceReceiptExpiresAt({toMillis: () => 1_200}, 1_000).toMillis()).toBe(1_000);
  });

  it.each([
    null,
    {},
    {toMillis: 1},
    {toMillis: () => Number.NaN},
    {toMillis: () => "100"},
  ])("uses the bounded fallback for an invalid parent expiry", (parentExpiresAt) => {
    expect(raceReceiptExpiresAt(parentExpiresAt, 1_000).toMillis()).toBe(1_000);
  });
});

describe("race opponent privacy", () => {
  it("leaves solo runs intact and scrubs identity from opponent ghost data", () => {
    const solo = run();
    expect(scrubRaceOpponent(solo)).toBe(solo);

    const linked = run({opponent: opponent()});
    expect(scrubRaceOpponent(linked)).toEqual(run({
      opponent: {
        displayName: PRIVATE_RACE_PLAYER_NAME,
        adjustedFinishMs: 12_000,
        events: [],
        avatarUrl: undefined,
        subjectUserId: undefined,
      },
    }));
    expect(linked.opponent?.displayName).toBe("Ada");
  });

  it("does not read deletion authority for solo or already-unlinked opponents", async () => {
    const transaction = {get: jest.fn()};
    const db = {collection: jest.fn()} as unknown as FirebaseFirestore.Firestore;

    await expect(resolveRaceOpponentPrivacy(transaction as never, db, run()))
      .resolves.toEqual({run: run(), scrubbed: false});
    await expect(resolveRaceOpponentPrivacy(
      transaction as never,
      db,
      run({opponent: opponent({subjectUserId: ""})}),
    )).resolves.toMatchObject({run: {opponent: {displayName: PRIVATE_RACE_PLAYER_NAME}}, scrubbed: true});
    expect(transaction.get).not.toHaveBeenCalled();
  });

  it.each([false, true])("resolves linked identity against the deletion tombstone (exists=%s)", async (deleted) => {
    const deletionRef = {path: "jestAccountDeletionTombstones/creator-1"};
    const transaction = {get: jest.fn(async () => ({exists: deleted}))};
    const db = {
      collection: jest.fn(() => ({doc: jest.fn(() => deletionRef)})),
    } as unknown as FirebaseFirestore.Firestore;
    const linked = run({opponent: opponent()});

    const result = await resolveRaceOpponentPrivacy(transaction as never, db, linked);

    expect(transaction.get).toHaveBeenCalledWith(deletionRef);
    expect(result.scrubbed).toBe(deleted);
    expect(result.run.opponent?.displayName).toBe(deleted ? PRIVATE_RACE_PLAYER_NAME : "Ada");
  });

  it("uses field deletes only for a scrubbed opponent merge", () => {
    const linked = run({opponent: opponent(), achievementProgressRecordedAtMs: undefined});
    expect(raceRunPrivacyWrite(linked, false)).toEqual(linked);
    expect(raceRunPrivacyWrite(run(), true)).toEqual(run());

    const write = raceRunPrivacyWrite(scrubRaceOpponent(linked), true);
    expect(write).toMatchObject({opponent: {displayName: PRIVATE_RACE_PLAYER_NAME}});
    expect(write.opponent.avatarUrl).toEqual(admin.firestore.FieldValue.delete());
    expect(write.opponent.subjectUserId).toEqual(admin.firestore.FieldValue.delete());
    expect(write).not.toHaveProperty("achievementProgressRecordedAtMs");
  });
});
