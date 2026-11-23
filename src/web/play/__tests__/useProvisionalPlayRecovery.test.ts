import {beforeEach, expect, it, jest} from "@jest/globals";
import type {BridgeRiddle, GameToHostMessage} from "../../../core/bridge";
import type {GameSessionAction, GameSessionState, PendingGuessState} from "../../../hosted/play/gameSessionTypes";

/** Run the real recovery owner's mount effects against the real reducer. */
const mockEffects: Array<() => unknown> = [];
/** Commit ownership before exercising mount recovery effects. */
const mockLayoutEffects: Array<() => unknown> = [];
jest.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useLayoutEffect: (effect: () => unknown) => {mockLayoutEffects.push(effect);},
  useEffect: (effect: () => unknown) => {mockEffects.push(effect);},
  useRef: <T>(current: T) => ({current}),
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === "function" ? (initial as () => T)() : initial, jest.fn(),
  ],
}));
import {createInitialGameSession, gameSessionReducer} from "../../../hosted/play/gameSession";
import { pendingPlayScope, type PendingGuessJournal} from "../../../hosted/play/pendingGuessJournal";
import {createPendingPlayJournalStorage} from "../../../hosted/play/pendingPlayJournalDiagnostics";
import {useProvisionalPlayRecovery} from "../game/hooks/useProvisionalPlayRecovery";
import type {PendingPlayRecoveryAdapters} from "../../../hosted/play/pendingPlayAdapters";

beforeEach(() => {mockEffects.length = 0; mockLayoutEffects.length = 0;});

/** Immutable issued questions representing the hosted locale-return sequence. */
const predecessor: BridgeRiddle = {
  riddleId: "classic_11", sessionToken: "test-issued-session-hamster-11", text: "A small pet rodent",
  answerLength: 7, gameMode: "classic", index: 11, evaluation: {answer: "hamster", locale: "en"},
  attemptsUsed: 0, hasUsedContinue: false, awaitingContinue: false,
};
/** Issued next prompt that remains active across journal reconciliation. */
const successor: BridgeRiddle = {...predecessor, riddleId: "classic_12",
  sessionToken: "test-issued-session-coconut-12", text: "A hairy fruit", index: 12,
  evaluation: {answer: "coconut", locale: "en"}};

/** Persist only the gameplay fields captured by the production journal. */
function capture(state: GameSessionState): PendingGuessState {
  /** Gameplay-only fields captured by the pending guess journal. */
  const {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
    completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds} = state;
  return {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
    completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds};
}

it("blocks an exhausted purchase-reward submission and sends the sixth guess after Continue", () => {
  /** Full saved draft remains visible while a purchase award overlays the exhausted question. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: {
    ...predecessor, attemptsUsed: 5, hasUsedContinue: false, awaitingContinue: true,
  }});
  state = gameSessionReducer(state, {type: "showAuxiliaryFanfare", fanfare: {
    id: "purchase-exhausted", kind: "purchase", coinsAwarded: 250, totalCoins: 500, achievementIds: [],
  }});
  state = {...state, currentLetters: [..."HAMSTER"]};
  /** Bridge observer records a guess only when its paid attempt is available. */
  const post = jest.fn<(message: GameToHostMessage) => void>();
  /** Recovery hook uses its production submit policy beneath the nonblocking reward. */
  const exhausted = useProvisionalPlayRecovery({state, stateRef: {current: state}, postToHost: post,
    dispatch: jest.fn(), playFeedback: jest.fn()});
  expect(exhausted.canSubmit).toBe(false);
  exhausted.submitGuess();
  expect(post).not.toHaveBeenCalled();

  state = gameSessionReducer(state, {type: "continueGranted"});
  state = {...state, currentLetters: [..."HAMSTER"]};
  /** Granted Continue makes the retained answer eligible for the host's authoritative scoring. */
  const continued = useProvisionalPlayRecovery({state, stateRef: {current: state}, postToHost: post,
    dispatch: jest.fn(), playFeedback: jest.fn()});
  expect(continued.canSubmit).toBe(true);
  continued.submitGuess();
  expect(post).toHaveBeenCalledWith(expect.objectContaining({type: "game:submitGuess", payload: expect.objectContaining({
    riddleId: "classic_11", sessionToken: "test-issued-session-hamster-11", gameMode: "classic", guess: "HAMSTER",
  })}));
});

it.each(["win", "loss"] satisfies Array<NonNullable<GameSessionState["lastOutcome"]>["kind"]>)(
  "continues a completed Daily %s in Classic without replaying its session",
  kind => {
    /** Issued Daily question whose acknowledged completion should lead to Classic play. */
    const riddle: BridgeRiddle = {...predecessor, gameMode: "challenge", riddleId: "daily_2026-10-18"};
    /** Reducer state with the Daily question installed before recording its completion. */
    const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
    /** Acknowledged Daily outcome and confirmed Classic index used for continuation. */
    const state: GameSessionState = {...loaded,
      profile: {username: "Alice", coins: 600, level: 2, xp: 100, winStreak: 1,
        gamesPlayed: 2, wins: 1, achievements: [], classicIndex: 17},
      lastOutcome: {id: `${riddle.sessionToken}-${kind}-1`, kind, riddleId: riddle.riddleId,
        gameMode: "challenge", sessionToken: riddle.sessionToken, attempts: 1, isCorrect: kind === "win"},
      completionAcknowledged: true,
    };
    /** Host bridge observer for the continuation request. */
    const post = jest.fn<(message: GameToHostMessage) => void>();
    /** Committed session state that continuation must leave intact. */
    const stateRef = {current: state};
    /** Real recovery hook that chooses the next request from the acknowledged Daily state. */
    const recovery = useProvisionalPlayRecovery({state, stateRef, postToHost: post,
      dispatch: jest.fn(), playFeedback: jest.fn()});

    recovery.requestRiddle();

    expect(post).toHaveBeenCalledWith(expect.objectContaining({type: "game:loadRiddle", payload: {
      gameMode: "classic", locale: state.locale, classicIndex: 17, sessionToken: undefined, riddleId: undefined,
    }}));
    expect(stateRef.current).toBe(state);
    expect(stateRef.current.lastOutcome?.sessionToken).toBe(riddle.sessionToken);
  },
);

it.each([false, true])("retains the loaded Daily recovery session with an unrelated outcome=%s", staleOutcome => {
  /** Current Daily issuance that must retain its recovery identity. */
  const riddle: BridgeRiddle = {...predecessor, gameMode: "challenge", riddleId: "daily_2026-10-18"};
  /** Reducer state containing the still-active Daily question. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle});
  /** Active Daily state with either no outcome or an unrelated prior Daily outcome. */
  const state: GameSessionState = {...loaded, lastOutcome: staleOutcome ? {
    id: "previous-daily-win", kind: "win", riddleId: "daily_2026-10-17", gameMode: "challenge",
    sessionToken: "previous-daily-session-token", attempts: 1, isCorrect: true,
  } : null};
  /** Host bridge observer for resuming the current Daily issuance. */
  const post = jest.fn<(message: GameToHostMessage) => void>();
  /** Real recovery hook deciding whether the loaded Daily session is complete. */
  const recovery = useProvisionalPlayRecovery({state, stateRef: {current: state}, postToHost: post,
    dispatch: jest.fn(), playFeedback: jest.fn()});

  recovery.requestRiddle();

  expect(post).toHaveBeenCalledWith(expect.objectContaining({type: "game:loadRiddle", payload: {
    gameMode: "challenge", locale: state.locale, classicIndex: undefined,
    sessionToken: riddle.sessionToken, riddleId: riddle.riddleId,
  }}));
});

it("continues a Classic win at its successor index", () => {
  /** Reducer state containing the Classic predecessor question. */
  const loaded = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: predecessor});
  /** Completed Classic state whose continuation must request the successor index. */
  const state: GameSessionState = {...loaded, lastOutcome: {id: "classic-win", kind: "win",
    riddleId: predecessor.riddleId, gameMode: "classic", sessionToken: predecessor.sessionToken,
    attempts: 1, isCorrect: true}};
  /** Host bridge observer for the successor Classic request. */
  const post = jest.fn<(message: GameToHostMessage) => void>();
  /** Real recovery hook advancing from the completed Classic question. */
  const recovery = useProvisionalPlayRecovery({state, stateRef: {current: state}, postToHost: post,
    dispatch: jest.fn(), playFeedback: jest.fn()});

  recovery.requestRiddle();

  expect(post).toHaveBeenCalledWith(expect.objectContaining({type: "game:loadRiddle", payload: {
    gameMode: "classic", locale: state.locale, classicIndex: 12, sessionToken: undefined, riddleId: undefined,
  }}));
});

it.each([false, true])("keeps Settings open on locale return with journal recovery=%s", async (recover) => {
  /** Fresh mount occurs after returning to the original content locale. */
  let state = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: successor});
  state = {...state, user: {uid: "recovery-player", isAnonymous: true}};
  state = gameSessionReducer(state, {type: "openModal", modal: "settings"});
  /** Latest reducer state observed by asynchronous recovery operations. */
  const stateRef = {current: state};
  /** Journal identity tied to this account and original content locale. */
  const scope = pendingPlayScope(state.user!.uid, undefined, "en");
  /** Confirmed predecessor state captured before the queued win. */
  const before = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: predecessor});
  /** Successor draft retained before locale return. */
  const next = gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle: successor});
  /** Idempotency key for the predecessor winning guess. */
  const requestId = "guess-retained-hamster";
  /** Pending predecessor receipt and its already projected successor draft. */
  const journal: PendingGuessJournal = {version: 1, scope, confirmedClassicIndex: 11,
    riddle: predecessor, base: capture(before), draft: [],
    successors: [{riddle: successor, base: capture(next), draft: [...next.currentLetters], draftActiveSlotIndex: 0}],
    queue: [{message: {type: "game:submitGuess", requestId,
      payload: {riddleId: predecessor.riddleId, sessionToken: predecessor.sessionToken,
        gameMode: "classic", guess: "HAMSTER", requestId}},
      attempts: 1, isCorrect: true, gameOver: true, canContinue: false,
      feedback: Array.from({length: 7}, () => "green")}],
  };
  /** Isolated durable journal records for the mount recovery fixture. */
  const values = new Map<string, string>();
  /** Production journal adapter backed by the isolated test records. */
  const storage = createPendingPlayJournalStorage({getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {values.set(key, value);}, removeItem: key => {values.delete(key);}});
  if (recover) expect(storage.write(journal)).toBe(true);
  /** Controlled persistence and timers supplied to the real recovery hook. */
  const adapters: PendingPlayRecoveryAdapters = {journal: storage, clock: {
    now: () => 1_000, setTimeout: () => 1, clearTimeout: () => undefined,
    setInterval: () => 2, clearInterval: () => undefined,
  }};
  /** Reducer actions emitted during the recovery mount. */
  const actions: GameSessionAction[] = [];
  /** Host bridge spy recording retained operation replay. */
  const post = jest.fn();
  /** Original window descriptor restored after the native lifecycle fixture. */
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {configurable: true,
    value: {addEventListener: () => undefined, removeEventListener: () => undefined}});
  try {
    useProvisionalPlayRecovery({state, stateRef, adapters, postToHost: post, playFeedback: jest.fn(),
      dispatch: action => {
        actions.push(action);
        stateRef.current = gameSessionReducer(stateRef.current, action);
      }});
    for (const effect of mockLayoutEffects) effect();
    await new Promise<void>(resolve => setImmediate(resolve));
    // Writer readiness schedules a render; commit recovery without remounting its owner.
    for (const effect of mockLayoutEffects.slice(1)) effect();
    for (const effect of mockEffects) effect();
    if (recover) {
      expect(actions.map(action => action.type)).toContain("restoreQueuedGuesses");
      expect(post).toHaveBeenCalledWith(journal.queue[0]!.message);
    } else {
      expect(actions).toEqual([]);
      expect(post).not.toHaveBeenCalled();
    }
    expect(stateRef.current.riddle?.sessionToken).toBe(successor.sessionToken);
    expect(stateRef.current.currentLetters).toEqual(next.currentLetters);
    expect(stateRef.current.modal).toBe("settings");
  } finally {
    if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

it.each([true,false])('routes only the still-owned paid receipt after terminal journal retirement (ok=%s)',async ok=>{
 /** Charge remains pending after canonical history proves the completed question. */
 const before=gameSessionReducer({...createInitialGameSession(),user:{uid:'Alice',isAnonymous:true},
   profile:{username:'Alice',coins:600,level:2,xp:100,winStreak:1,gamesPlayed:2,wins:1,achievements:[],classicIndex:1}},
   {type:'loadRiddle',riddle:{...predecessor,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:true}});
 /** Exact original paid preview identity remains available after journal retirement. */
 const charged=gameSessionReducer(before,{type:'previewCoinSpend',requestId:'continue-retired-receipt',amount:50,reason:'continue'});
 /** Complete accepted fifth-attempt win belongs to the current account. */
 const terminal=gameSessionReducer(charged,{type:'loadRiddle',riddle:{...predecessor,attemptsUsed:5,hasUsedContinue:false,awaitingContinue:false,
   acceptedGuesses:Array.from({length:5},(_,index)=>({attempt:index+1,feedback:[...'HAMSTER'].map(letter=>({letter,status:index===4?'green' as const:'red' as const}))}))}});
 /** Empty storage represents the legitimately retired delivery journal. */
 const journal=createPendingPlayJournalStorage({getItem:()=>null,setItem:()=>{},removeItem:()=>{}});
 /** Controlled timers do not run during this admission-boundary test. */
 const adapters:PendingPlayRecoveryAdapters={journal,clock:{now:()=>1000,setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>2,clearInterval:()=>{}}};
 /** Committed account state used by the paid receipt admission guard. */
 const stateRef={current:terminal};
 /** Real hook receipt handler with a retired journal. */
 const recovery=useProvisionalPlayRecovery({state:terminal,stateRef,adapters,dispatch:jest.fn(),postToHost:jest.fn(),playFeedback:jest.fn()});
 /** The generic router must receive only the exact still-owned balance result. */
 /** Persisted paid operation whose delivery waits for readiness. */
 const message={type:'host:operationResult' as const,requestId:'continue-retired-receipt',payload:{operation:'spendCoins' as const,ok,...(ok?{data:{newCoins:600}}:{errorKind:'rejected' as const,error:'Fixture rejection'})}};
 expect(recovery.handleQueuedGuessResult(message)).toBe(false);
 expect(recovery.handleQueuedGuessResult({...message,requestId:'another-paid-receipt'})).toBe(true);
 /** New render ownership revokes the old committed account before passive cleanup. */
 const replacement=useProvisionalPlayRecovery({state:{...terminal,user:{uid:'Bob',isAnonymous:true}},stateRef,adapters,dispatch:jest.fn(),postToHost:jest.fn(),playFeedback:jest.fn()});
 expect(replacement.handleQueuedGuessResult(message)).toBe(true);
});


it.each(['delayed','retry','retired-resolution','retired-retry'] as const)('writer initialization owns %s',async scenario=>{
 /** Real persisted work must remain undelivered until the writer is admitted. */
 const state=gameSessionReducer({...createInitialGameSession(),user:{uid:'Alice',isAnonymous:true}},{type:'loadRiddle',riddle:predecessor});
 /** Account-scoped durable record and isolated storage bytes. */
 const scope=pendingPlayScope('Alice',undefined,'en'),values=new Map<string,string>();
 /** Concrete production journal adapter. */
 const storage=createPendingPlayJournalStorage({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}});
 /** Persisted paid operation whose delivery waits for readiness. */
 const message={type:'game:skipRiddle' as const,requestId:'skip-writer-readiness',payload:{gameMode:'classic' as const,riddleId:predecessor.riddleId,sessionToken:predecessor.sessionToken}};
 expect(storage.write({version:1,scope,riddle:predecessor,base:capture(state),confirmedClassicIndex:11,draft:[],queue:[],successors:[],coinAction:message})).toBe(true);
 /** A controlled first load resolves or rejects without bypassing the actual adapter. */
 let resolveLoad!:(writer:Awaited<ReturnType<typeof storage.writer>>)=>void;
 /** Rejects the controlled first module load. */
 let rejectLoad!:(reason:Error)=>void;
 /** Deferred first initialization result. */
 const pending=new Promise<Awaited<ReturnType<typeof storage.writer>>>((resolve,reject)=>{resolveLoad=resolve;rejectLoad=reject;});
 /** Retries delegate to the actual adapter after the controlled failure. */
 const writer=jest.fn<typeof storage.writer>().mockImplementationOnce(()=>pending).mockImplementation(storage.writer);
 /** Cancelled timers remain callable to exercise stale callbacks. */
 const timers:Array<()=>void>=[],cleared:number[]=[];
 /** Real hook clock and storage seams. */
 const adapters:PendingPlayRecoveryAdapters={journal:{...storage,writer},clock:{now:()=>1000,setTimeout:callback=>{timers.push(callback as ()=>void);return timers.length;},clearTimeout:id=>{if(id!==undefined)cleared.push(id);},setInterval:()=>10,clearInterval:()=>{}}};
 /** Delivery spy and committed reducer state. */
 const post=jest.fn(),stateRef={current:state},descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:()=>{},removeEventListener:()=>{}}});
 try{
  useProvisionalPlayRecovery({state,stateRef,adapters,postToHost:post,dispatch:jest.fn(),playFeedback:jest.fn()});
  /** Exact commit cleanup functions. */
  const cleanups=mockLayoutEffects.map(effect=>effect());
  for(const effect of mockEffects)effect();
  expect(post).not.toHaveBeenCalled();
  if(scenario.endsWith('retry')){
   rejectLoad(new Error('chunk unavailable'));await new Promise<void>(resolve=>setImmediate(resolve));expect(timers).toHaveLength(1);
   if(scenario==='retired-retry'){for(const cleanup of cleanups)if(typeof cleanup==='function')cleanup();expect(cleared).toContain(1);}
   timers[0]!();await new Promise<void>(resolve=>setImmediate(resolve));
  }else{
   if(scenario==='retired-resolution')for(const cleanup of cleanups)if(typeof cleanup==='function')cleanup();
   resolveLoad(await storage.writer('fixture',()=>1000,()=>true));await new Promise<void>(resolve=>setImmediate(resolve));
  }
  for(const effect of mockLayoutEffects.slice(1))effect();
  for(const effect of mockEffects)effect();
  if(scenario.startsWith('retired')){expect(post).not.toHaveBeenCalled();expect(writer).toHaveBeenCalledTimes(1);}
  else expect(post).toHaveBeenCalledWith(message);
 }finally{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else Reflect.deleteProperty(globalThis,'window');}
});
