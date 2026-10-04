import {afterEach, describe, expect, it} from "@jest/globals";
import {createPendingPlayJournalStorage, pendingPlayScope, isPendingPlayJournalSupersededByWin, reconcileConfirmedPendingPlay, createRejectedPlayDraft, type PendingGuessJournal} from "../pendingGuessJournal";
/** The values used by this regression scenario. */
const values = new Map<string, string>();
/** Provides storage behavior. */
const storage = createPendingPlayJournalStorage({
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
  removeItem: (key: string) => {
    values.delete(key);
  },
});
/** Provides {read: read pending guess journal, write: write pending guess journal, clear: clear pending guess journal,
  acquire: acquire pending play lease, release: release pending play lease} behavior. */
const {
  read: readPendingGuessJournal,
  write: writePendingGuessJournal,
  clear: clearPendingGuessJournal,
  acquire: acquirePendingPlayLease,
  release: releasePendingPlayLease,
} = storage;

afterEach(() => values.clear());
/** The scope used by this regression scenario. */
const scope = pendingPlayScope("player-1", 2, "en");
/** The journal used by this regression scenario. */
const journal = (): PendingGuessJournal => ({
  version: 1,
  scope,
  confirmedClassicIndex: 4,
  riddle: {
    riddleId: "classic-4",
    text: "Clue",
    answerLength: 5,
    sessionToken: "00000000-0000-4000-8000-000000000001",
    gameMode: "classic",
    attemptsUsed: 0,
    hasUsedContinue: false,
    awaitingContinue: false,
    evaluation: {answer: "piano", locale: "en"},
  },
  base: {
    currentLetters: ["P", "I", "A", "N", "O"],
    activeSlotIndex: 0,
    guesses: [],
    engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
    modal: null,
    lastOutcome: null,
    completionAcknowledged: false,
    letterStates: {},
  },
  successors: [],
  queue: [
    {
      message: {
        type: "game:submitGuess",
        requestId: "request-123",
        payload: {
          riddleId: "classic-4",
          gameMode: "classic",
          sessionToken: "00000000-0000-4000-8000-000000000001",
          guess: "PIANO",
          requestId: "request-123",
        },
      },
      attempts: 1,
      isCorrect: true,
      gameOver: true,
      canContinue: false,
      feedback: ["green", "green", "green", "green", "green"],
    },
  ],
  draft: [],
});

describe("pending guess journal", () => {
  it.each(["new-session", "new-riddle", "same-round", "other-mode", "queued", "paid", "successor", "preceding-win"])(
    "reconciles a cold draft without losing required or other-mode work (%s)", boundary => {
      /** Draft-only root belongs to an earlier issued session until the host confirms its identity. */
      const pending = journal();pending.queue = [];pending.draft = ["C", "L", "", "", ""];pending.draftActiveSlotIndex = 2;
      /** Current host question may replace the draft's session or leave it recoverable. */
      const current = {...pending.riddle};
      if (boundary !== "same-round" && boundary !== "new-riddle") current.sessionToken = "00000000-0000-4000-8000-000000000099";
      if (boundary === "new-riddle") current.riddleId += "-reissued";
      if (boundary === "other-mode") current.gameMode = "challenge";
      if (boundary === "queued") pending.queue = journal().queue;
      if (boundary === "paid") pending.coinAction = {type: "game:requestHint",requestId: "cold-required-hint",payload: {
        riddleId: pending.riddle.riddleId,sessionToken: pending.riddle.sessionToken,gameMode: pending.riddle.gameMode,
        requestId: "cold-required-hint",currentAttempt: pending.draft}};
      if (boundary === "successor") pending.successors = [{riddle: current,base: pending.base,draft: ["N", "E", "", "", ""],draftActiveSlotIndex: 2}];
      if (boundary === "preceding-win") {
        current.attemptsUsed = 1;
        current.acceptedGuesses = [{attempt: 1,feedback: [..."PIANO"].map(letter => ({letter,status: "green" as const}))}];
      }
      /** Retirement must neither mutate retained input nor change required receipt identities. */
      const original = JSON.stringify(pending);
      /** Exact host identity retires only an obsolete, delivery-free same-mode root draft. */
      const reconciled = reconcileConfirmedPendingPlay(pending,current);
      expect(reconciled).toBe(boundary === "new-session" || boundary === "new-riddle" ? null : pending);
      expect(JSON.stringify(pending)).toBe(original);
    },
  );

  it.each(["displayed", "prior-victory", "foreign-riddle", "foreign-mode"])("retains only the rejected question's unsubmitted draft while current ownership is %s", owner => {
    /** Root draft and all dependent mutations exist before a definitive rejection. */
    const pending = journal();pending.draft = ["C", "L", "", "", ""];pending.draftActiveSlotIndex = 2;
    pending.successors = [{riddle: {...pending.riddle,sessionToken: "later-issued-session-00000000001"},base: pending.base,draft: ["N", "O", "", "", ""]}];
    pending.coinAction = {type: "game:spendCoins",requestId: "dependent-continue",payload: {
      riddleId: pending.riddle.riddleId,sessionToken: pending.riddle.sessionToken,gameMode: "classic",reason: "continue"}};
    /** Latest displayed input can supersede the serialized draft only for the exact editable root. */
    const current = {riddle: {...pending.riddle},engineSnapshot: pending.base.engineSnapshot,
      currentLetters: ["C", "L", "O", "", ""],activeSlotIndex: 3};
    if (owner === "prior-victory") current.riddle.sessionToken = "completed-prior-session-00000001";
    if (owner === "foreign-riddle") current.riddle.riddleId += "other";
    if (owner === "foreign-mode") current.riddle.gameMode = "challenge";
    /** Original durable journal must remain immutable even as its dependent operations are discarded. */
    const original = JSON.stringify(pending);
    /** New durable record contains a draft, no mutation or unrelated successor. */
    const retained = createRejectedPlayDraft(pending,current);
    expect(retained?.draft).toEqual(owner === "displayed" ? ["C", "L", "O", "", ""] : ["C", "L", "", "", ""]);
    expect(retained?.draftActiveSlotIndex).toBe(owner === "displayed" ? 3 : 2);
    expect(retained?.queue).toEqual([]);expect(retained?.successors).toEqual([]);expect(retained?.coinAction).toBeUndefined();
    expect(JSON.stringify(pending)).toBe(original);
    expect(writePendingGuessJournal(retained!)).toBe(true);expect(readPendingGuessJournal(scope)?.queue).toEqual([]);
  });

  it.each(["empty", "wrong-width", "multiple-graphemes", "non-string", "oversized-cell", "oversized-answer"])("does not persist an invalid rejected draft (%s)", malformed => {
    /** Persisted root input is inspected while a different completed question remains displayed. */
    const pending = journal();pending.draft = ["C", "L", "", "", ""];
    if (malformed === "empty") pending.draft = Array(5).fill("");
    if (malformed === "wrong-width") pending.draft = ["C", "L"];
    if (malformed === "multiple-graphemes") pending.draft[0] = "CL";
    if (malformed === "non-string") Reflect.set(pending.draft,0,{invalid: true});
    if (malformed === "oversized-cell") pending.draft[0] = "C".repeat(33);
    if (malformed === "oversized-answer") pending.riddle.answerLength = 8;
    expect(createRejectedPlayDraft(pending,{riddle: null,engineSnapshot: null,currentLetters: [],activeSlotIndex: 0})).toBeNull();
  });

  it("retains Unicode draft cells and handles legacy selections without trusting a persisted locale", () => {
    /** Unicode letters preserve one visible grapheme, independent of untrusted persisted locale data. */
    const pending = journal();pending.draft = ["Я", "e\u0301", "", "", ""];pending.draftActiveSlotIndex = undefined;
    pending.riddle.evaluation = {answer: "piano",locale: "en"};Reflect.set(pending.riddle.evaluation,"locale","__invalid__");
    expect(createRejectedPlayDraft(pending,{riddle: null,engineSnapshot: null,currentLetters: [],activeSlotIndex: 0})).toMatchObject({draft: pending.draft,draftActiveSlotIndex: undefined});
  });

  it.each([false, true])("preserves the later draft and exact requests when retiring a completed buffered prefix (queued=%s)", queued => {
    /** Root and two consecutive issued successors exercise ordered delivery across question boundaries. */
    const pending = journal();pending.riddle.index = 4;
    pending.successors = [5, 6].map(index => ({riddle: {...pending.riddle, index, riddleId: `classic-${index}`,
      sessionToken: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`},base: {...pending.base},draft: ["P", "I", "", "", ""],draftActiveSlotIndex: 2}));
    /** Later deliveries retain their original receipt identifiers and ordering. */
    const later = pending.successors.map((segment, index) => ({...pending.queue[0]!, message: {...pending.queue[0]!.message,
      requestId: `later-request-${index}`, payload: {...pending.queue[0]!.message.payload, riddleId: segment.riddle.riddleId,
        sessionToken: segment.riddle.sessionToken,requestId: `later-request-${index}`}}}));
    if (queued) pending.queue.push(...later);
    /** Host proof is independent of the journal projection. */
    const won = {...pending.riddle, attemptsUsed: 1,acceptedGuesses: [{attempt: 1, feedback: [..."PIANO"].map(letter => ({letter,status: "green" as const}))}]};
    /** Snapshot proves reconciliation does not mutate the caller's durable record. */
    const original = JSON.stringify(pending);
    /** Reconciled record is persisted through the actual versioned storage seam. */
    const reconciled = reconcileConfirmedPendingPlay(pending, won);
    expect(reconciled).not.toBeNull();
    expect(reconciled?.riddle).toBe(pending.successors[0]!.riddle);
    expect(reconciled?.base).toBe(pending.successors[0]!.base);
    expect(reconciled?.queue).toEqual(queued ? later : []);
    expect(reconciled?.draft).toEqual(["P", "I", "", "", ""]);
    expect(reconciled?.draftActiveSlotIndex).toBe(2);
    expect(reconciled?.successors).toEqual([pending.successors[1]]);
    expect(reconciled?.confirmedClassicIndex).toBe(5);
    expect(JSON.stringify(pending)).toBe(original);
    expect(writePendingGuessJournal(reconciled!)).toBe(true);
    expect(readPendingGuessJournal(scope)).toMatchObject({riddle: {index: 5}, draftActiveSlotIndex: 2, successors: [{riddle: {index: 6}}]});
  });

  it.each(["predecessor", "successor"])("retires only a %s paid action owned by a completed buffered predecessor", owner => {
    /** One issued successor retains a draft while paid delivery is reconciled. */
    const pending = journal();pending.riddle.index = 4;
    pending.successors = [{riddle: {...pending.riddle,index: 5,riddleId: "classic-5",sessionToken: "00000000-0000-4000-8000-000000000005"},base: pending.base,draft: ["P", "I", "", "", ""]}];
    /** Paid receipt belongs either to the completed root or to the still-required successor. */
    const target = owner === "predecessor" ? pending.riddle : pending.successors[0]!.riddle;
    pending.coinAction = {type: "game:spendCoins",requestId: "continued-buffered-action",payload: {riddleId: target.riddleId,sessionToken: target.sessionToken,gameMode: "classic",reason: "continue"}};
    /** Valid host terminal history is the sole reason the predecessor may be retired. */
    const won = {...pending.riddle,attemptsUsed: 1,acceptedGuesses: [{attempt: 1,feedback: [..."PIANO"].map(letter => ({letter,status: "green" as const}))}]};
    expect(reconcileConfirmedPendingPlay(pending, won)?.coinAction).toEqual(owner === "predecessor" ? undefined : pending.coinAction);
    expect(reconcileConfirmedPendingPlay(pending, won)?.draftActiveSlotIndex).toBeUndefined();
  });

  it.each(["unknown-request", "reordered-request", "duplicate-session", "skipped-index", "foreign-mode", "unproved-win"])(
    "retains the original buffered journal when its boundary is %s", boundary => {
      /** Two issued rounds make ordering and identity mistakes observable without discarding requests. */
      const pending = journal();pending.riddle.index = 4;
      pending.successors = [{riddle: {...pending.riddle,index: 5,riddleId: "classic-5",sessionToken: "00000000-0000-4000-8000-000000000005"},base: pending.base,draft: ["P", "I", "", "", ""]}];
      /** Host history would otherwise permit retirement of the root question. */
      const won = {...pending.riddle,attemptsUsed: 1,acceptedGuesses: [{attempt: 1,feedback: [..."PIANO"].map(letter => ({letter,status: "green" as const}))}]};
      if (boundary === "unknown-request") pending.queue[0]!.message.payload.sessionToken += "foreign";
      if (boundary === "reordered-request") pending.queue.unshift({...pending.queue[0]!,message: {...pending.queue[0]!.message,payload: {...pending.queue[0]!.message.payload,riddleId: "classic-5",sessionToken: pending.successors[0]!.riddle.sessionToken}}});
      if (boundary === "duplicate-session") pending.successors[0]!.riddle.sessionToken = pending.riddle.sessionToken;
      if (boundary === "skipped-index") pending.successors[0]!.riddle.index = 6;
      if (boundary === "foreign-mode") pending.successors[0]!.riddle.gameMode = "challenge";
      if (boundary === "unproved-win") won.acceptedGuesses = [];
      expect(reconcileConfirmedPendingPlay(pending, won)).toBe(pending);
    });

  it.each([1, 5, 6])("retires deliveries from the host-confirmed attempt-%i winner without trusting its journal colours", attempts => {
    /** Persisted projection can be stale or disagree; only host history establishes terminal state. */
    const pending = journal();
    /** Complete host proof includes the final win and the actually granted sixth attempt. */
    const won = {...pending.riddle, attemptsUsed: attempts, hasUsedContinue: attempts === 6,
      acceptedGuesses: Array.from({length: attempts}, (_, index) => ({attempt: index + 1,
        feedback: [...(index === attempts - 1 ? "PIANO" : "QQQQQ")].map(letter => ({letter,
          status: index === attempts - 1 ? "green" as const : "red" as const}))}))};
    pending.queue[0]!.feedback = Array(5).fill("red");
    expect(isPendingPlayJournalSupersededByWin(pending, won)).toBe(true);
    expect(pending.queue).toHaveLength(1);
    expect(pending.riddle.attemptsUsed).toBe(0);
    pending.coinAction = {type: "game:spendCoins", requestId: "continue-request", payload: {
      riddleId: won.riddleId, sessionToken: won.sessionToken, gameMode: won.gameMode, reason: "continue"}};
    expect(isPendingPlayJournalSupersededByWin(pending, won)).toBe(true);
  });

  it.each(["missing-proof", "wrong-proof", "foreign-token", "foreign-riddle", "foreign-mode", "successor", "foreign-queued-guess", "foreign-paid-action"])(
    "keeps required deliveries when terminal authority or journal identity is %s", boundary => {
      /** Actual durable request fixture is retained unless the complete terminal round owns it. */
      const pending = journal();
      /** Trusted host win before altering one authority or delivery boundary. */
      const won = {...pending.riddle, attemptsUsed: 1, acceptedGuesses: [{attempt: 1,
        feedback: [..."PIANO"].map(letter => ({letter, status: "green" as "green" | "red"}))}]};
      if (boundary === "missing-proof") won.acceptedGuesses = [];
      if (boundary === "wrong-proof") won.acceptedGuesses[0]!.feedback[0]!.status = "red";
      if (boundary === "foreign-token") won.sessionToken += "other";
      if (boundary === "foreign-riddle") won.riddleId += "other";
      if (boundary === "foreign-mode") won.gameMode = "challenge";
      if (boundary === "successor") pending.successors.push({riddle: {...pending.riddle, sessionToken: "next-issued-question-00000001"}, base: pending.base, draft: ["P", "I", "", "", ""]});
      if (boundary === "foreign-queued-guess") pending.queue[0]!.message.payload.sessionToken += "other";
      if (boundary === "foreign-paid-action") pending.coinAction = {type: "game:spendCoins", requestId: "continue-request",
        payload: {riddleId: won.riddleId, sessionToken: "other-issued-question-000001", gameMode: won.gameMode, reason: "continue"}};
      expect(isPendingPlayJournalSupersededByWin(pending, won)).toBe(false);
      expect(pending.queue).toHaveLength(1);
    });

  it("retains a confirmed hint behind answers and after the answer queue drains", () => {
    /** Journal with a paid request whose identity must survive a reload. */
    const pending = journal();
    pending.coinAction = {
      type: "game:requestHint",
      requestId: "hint-request-123",
      payload: {
        riddleId: pending.riddle.riddleId,
        gameMode: "classic",
        sessionToken: pending.riddle.sessionToken,
        requestId: "hint-request-123",
        currentAttempt: ["", "", "", "", ""],
      },
    };
    expect(writePendingGuessJournal(pending)).toBe(true);
    expect(readPendingGuessJournal(scope)?.coinAction).toEqual(pending.coinAction);
    pending.queue = [];
    expect(writePendingGuessJournal(pending)).toBe(true);
    expect(readPendingGuessJournal(scope)?.coinAction?.requestId).toBe("hint-request-123");
    expect(readPendingGuessJournal(pendingPlayScope("player-1", 3, "en"))).toBeNull();
  });

  it("retains a continue choice behind the final unconfirmed answer", () => {
    /** Continue choice that must be delivered only after the earlier answer settles. */
    const pending = journal();
    pending.coinAction = {
      type: "game:spendCoins",
      requestId: "continue-request-123",
      payload: {
        reason: "continue",
        riddleId: pending.riddle.riddleId,
        gameMode: "classic",
        sessionToken: pending.riddle.sessionToken,
        amount: 100,
      },
    };
    expect(writePendingGuessJournal(pending)).toBe(true);
    expect(readPendingGuessJournal(scope)?.coinAction).toEqual(pending.coinAction);
  });

  it("rejects malformed persisted coin actions", () => {
    /** Corrupt action must not become a replayable paid request. */
    const pending = {...journal(), coinAction: {type: "game:requestHint", payload: {}}};
    values.set(`riddleQuest:pendingPlay:v1:${scope}`, JSON.stringify(pending));
    expect(readPendingGuessJournal(scope)).toBeNull();
  });

  it("restores exact requests only for the same identity generation and locale", () => {
    expect(writePendingGuessJournal(journal())).toBe(true);
    expect(readPendingGuessJournal(scope)?.queue[0].message.payload.requestId).toBe("request-123");
    expect(readPendingGuessJournal(pendingPlayScope("player-1", 3, "en"))).toBeNull();
    expect(readPendingGuessJournal(pendingPlayScope("player-1", 2, "fr"))).toBeNull();
    clearPendingGuessJournal(scope);
    expect(readPendingGuessJournal(scope)).toBeNull();
  });

  it("serializes delivery across tabs and permits recovery after lease expiry", () => {
    expect(acquirePendingPlayLease(scope, "tab-a", 1_000)).toBe(true);
    expect(acquirePendingPlayLease(scope, "tab-b", 2_000)).toBe(false);
    expect(acquirePendingPlayLease(scope, "tab-b", 16_001)).toBe(true);
    releasePendingPlayLease(scope, "tab-a");
    expect(acquirePendingPlayLease(scope, "tab-a", 16_002)).toBe(false);
    releasePendingPlayLease(scope, "tab-b");
    expect(acquirePendingPlayLease(scope, "tab-a", 16_003)).toBe(true);
  });
});

it("retains draft selections in the current and successor checkpoints", () => {
  /** In-flight operation remains observable until its controlled settlement. */
  const pending = journal();
  pending.draft = ["P", "I", "", "", ""];
  pending.draftActiveSlotIndex = 2;
  pending.successors = [{riddle: pending.riddle, base: pending.base, draft: pending.draft, draftActiveSlotIndex: 1}];
  expect(writePendingGuessJournal(pending)).toBe(true);
  expect(readPendingGuessJournal(scope)).toMatchObject({draftActiveSlotIndex: 2, successors: [{draftActiveSlotIndex: 1}]});
});

it.each([-1, 5, 1.5, "2"])("rejects malformed persisted draft selection %p", (slot) => {
  /** In-flight operation remains observable until its controlled settlement. */
  const pending = journal();
  values.set(`riddleQuest:pendingPlay:v1:${scope}`, JSON.stringify({...pending, draftActiveSlotIndex: slot}));
  expect(readPendingGuessJournal(scope)).toBeNull();
  values.set(`riddleQuest:pendingPlay:v1:${scope}`, JSON.stringify({...pending,
    successors: [{riddle: pending.riddle, base: pending.base, draft: [], draftActiveSlotIndex: slot}]}));
  expect(readPendingGuessJournal(scope)).toBeNull();
});
