import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {computeFeedback, lowerCaseGraphemes, splitGraphemes} from "@riddle-quest/core/game";
import {z} from "zod";
import {HttpsError} from "firebase-functions/v2/https";
import {AbandonRaceRunResponseSchema, SubmitRaceGuessResponseSchema, RequestRaceHintResponseSchema, SkipRaceRiddleResponseSchema,
  type AbandonRaceRunRequest, type SubmitRaceGuessRequest, type RequestRaceHintRequest, type SkipRaceRiddleRequest,
  type StartRaceRunRequest, type PublishRaceChallengeRequest, type ReserveRaceInviteRequest, type CancelRaceInviteRequest,
  type RaceRunView} from "@riddle-quest/core/race";
import {raceRules, type RaceRunRecord} from "./raceEngine";
import {raceTimelineAgrees} from "./raceStoredTimeline";

/** Operation-specific request payload represented once for all receipt-backed commands. */
type ReceiptIntent<Kind extends string, Input> = {
  /** Operation discriminator preserved in the versioned digest. */
  kind: Kind;
  /** Complete original typed intent, excluding server-side adapters and clocks. */
  input: Input;
};
/** One owned scoring mutation, including its complete typed request intent. */
export type RaceMutationCommand = ReceiptIntent<"guess", SubmitRaceGuessRequest> | ReceiptIntent<"hint", RequestRaceHintRequest>
  | ReceiptIntent<"skip", SkipRaceRiddleRequest> | ReceiptIntent<"abandon", AbandonRaceRunRequest>;
/** Every receipt-backed lifecycle command shares one versioned intent contract. */
export type RaceReceiptCommand = RaceMutationCommand | ReceiptIntent<"start", StartRaceRunRequest>
  | ReceiptIntent<"publish", PublishRaceChallengeRequest> | ReceiptIntent<"reserve", ReserveRaceInviteRequest>
  | ReceiptIntent<"cancel", CancelRaceInviteRequest>;
/** Storage validates the digest rather than persisting guesses or other raw request inputs. */
const Binding = z.object({version: z.literal(1), kind: z.enum(["guess", "hint", "skip", "abandon", "start", "publish", "reserve", "cancel"]),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/)}).strict();
/** Versioned digest written in the same transaction as the accepted command. */
export type RaceRequestBinding = z.infer<typeof Binding>;

/** Canonical field tuples ignore object order, request IDs and equivalent omitted boolean defaults. */
export function bindRaceRequest(command: RaceReceiptCommand): RaceRequestBinding {
  /** Only operation-relevant fields contribute to the fixed-order digest. */
  let fields: unknown[];
  switch (command.kind) {
    case "guess": fields = [command.input.runId, command.input.riddleId, command.input.guess.trim().normalize("NFC"), command.input.includeEvaluation ?? false]; break;
    case "hint": case "skip": fields = [command.input.runId, command.input.riddleId, command.input.includeEvaluation ?? false]; break;
    case "abandon": fields = [command.input.runId]; break;
    case "publish": fields = [command.input.runId, command.input.reservedChallengeId ?? null]; break;
    case "reserve": fields = [command.input.locale]; break;
    case "cancel": fields = [command.input.challengeId, command.input.locale]; break;
    case "start": fields = [command.input.locale, command.input.categoryId ?? null, command.input.challengeId ?? null,
      command.input.rivalryChallengeId ?? null, command.input.offerId ?? null, command.input.fallbackOfferId ?? null, command.input.prepare ?? false]; break;
  }
  return {version: 1, kind: command.kind, fingerprint: createHash("sha256").update(JSON.stringify([1, command.kind, ...fields])).digest("hex")};
}

/** Rejects altered intent with a bounded diagnostic that never contains guesses or request identities. */
export function rejectRaceRequestReuse(): never {
  throw new HttpsError("invalid-argument", "Race request was reused for different input.");
}

/** Validates owner and versioned intent; false delegates supported unbound history to its canonical reader. */
export function assertRaceRequestReplay(receipt: FirebaseFirestore.DocumentData | undefined, userId: string,
  binding: RaceRequestBinding): boolean {
  if (!receipt || receipt.userId !== userId) throw new HttpsError("data-loss", "Stored race request is invalid.");
  if (receipt.commandBinding === undefined) return false;
  /** Unsupported or partly damaged bindings must never degrade into legacy replay. */
  const parsed = Binding.safeParse(receipt.commandBinding);
  if (!parsed.success) throw new HttpsError("data-loss", "Stored race request is invalid.");
  if (parsed.data.kind !== binding.kind || parsed.data.fingerprint !== binding.fingerprint) rejectRaceRequestReuse();
  return true;
}

/** Historical progress may lag today's run, but immutable gameplay facts must still belong to its owned source. */
function assertReceiptProjection(view: RaceRunView, run: RaceRunRecord): void {
  /** Legacy receipts can retain the former one-hint rule when no immutable snapshot was recorded. */
  const rules = !run.recordVersion && !run.rulesSnapshot ? {...raceRules(run), maxHintsPerRiddle: view.rules.maxHintsPerRiddle} : raceRules(run);
  /** Every supplied content field is checked without inventing optional historical preload hints. */
  const promptAgrees = (prompt: NonNullable<RaceRunView["currentRiddle"]> | NonNullable<RaceRunView["preloadedRiddles"]>[number]): boolean => {
    /** Resolve the historical question by its immutable position, never today's active question. */
    const source = run.riddles[prompt.position];
    if (!source) return false;
    /** Shared grapheme semantics match server scoring and hint selection. */
    const letters = splitGraphemes(source.answer, run.locale);
    return prompt.riddleId === source.riddleId && prompt.text === source.text.trim() && prompt.answerLength === letters.length &&
      (!prompt.evaluation || run.evaluationPolicy !== "server-only" && prompt.evaluation.answer === source.answer && prompt.evaluation.locale === run.locale) &&
      (!("hint" in prompt) || !prompt.hint || prompt.hint.index === 0 && prompt.hint.letter === letters[0]) &&
      (!("revealedLetters" in prompt) || new Set(prompt.revealedLetters.map(letter => letter.index)).size === prompt.revealedLetters.length &&
        prompt.revealedLetters.every(letter => letters[letter.index] === letter.letter) &&
        prompt.guessesRemaining === rules.maxGuessesPerRiddle - prompt.guessesUsed &&
        prompt.hintAvailable === (prompt.revealedLetters.length < Math.min(rules.maxHintsPerRiddle, letters.length)));
  };
  if (view.challengeId !== run.challengeId || view.rivalryChallengeId !== run.rivalryChallengeId || !isDeepStrictEqual(view.rules, rules) ||
    view.startsAtMs !== undefined && view.startsAtMs !== run.startedAtMs ||
    view.preparationExpiresAtMs !== undefined && view.preparationExpiresAtMs !== run.preparationExpiresAtMs ||
    Boolean(view.opponent) !== Boolean(run.opponent) || view.opponent &&
      (view.opponent.adjustedFinishMs !== run.opponent?.adjustedFinishMs || !isDeepStrictEqual(view.opponent.events, run.opponent.events)) ||
    view.currentRiddle && !promptAgrees(view.currentRiddle) || view.preloadedRiddles &&
      (view.preloadedRiddles.length !== run.riddles.length || view.preloadedRiddles.some((prompt, position) => prompt.position !== position || !promptAgrees(prompt))))
    throw new HttpsError("data-loss", "Stored race request is invalid.");
}

/** A historical checkpoint can lag accepted progress, but cannot precede its own events or invent future authority. */
function assertReceiptProgress(view: RaceRunView, run: RaceRunRecord, command: RaceMutationCommand): void {
  /** Editable questions are exposed only by active scoring replies; abandonment never exposes one. */
  const active = view.status === "active";
  /** Known later accepted action/receipt clocks bound copied historical sampling metadata. */
  const latestAcceptedAtMs = Math.max(run.lastActionAtMs ?? 0, run.settledAtMs ?? 0, run.achievementOutcomePresentedAtMs ?? 0);
  /** Immutable authored hint limits also constrain copied event history. */
  const hintLimits = run.riddles.map(riddle => Math.min(view.rules.maxHintsPerRiddle, splitGraphemes(riddle.answer, run.locale).length));
  /** Terminal checkpoint clocks are immutable; active historical replies may correctly lag today's finish. */
  const terminal = ["completed", "timed_out", "abandoned"].includes(view.status);
  if (![view.wallElapsedMs, view.totalPenaltyMs, view.adjustedElapsedMs, ...(view.serverNowMs === undefined ? [] : [view.serverNowMs])].every(Number.isSafeInteger) ||
    view.adjustedElapsedMs !== view.wallElapsedMs + view.totalPenaltyMs || view.correctCount > run.correctCount ||
    view.totalPenaltyMs > run.hintPenaltyMs + run.skipPenaltyMs || Boolean(view.currentRiddle) !== active ||
    (command.kind === "abandon" ? view.status !== "abandoned" : !["active", "completed", "timed_out"].includes(view.status)) ||
    view.serverNowMs !== undefined && latestAcceptedAtMs > 0 && view.serverNowMs > latestAcceptedAtMs ||
    active && view.serverNowMs !== undefined && (view.serverNowMs < run.startedAtMs || view.wallElapsedMs !== view.serverNowMs - run.startedAtMs) ||
    view.currentRiddle && (view.correctCount >= view.rules.targetCorrect || view.correctCount > view.currentRiddle.position ||
      run.recordVersion === 1 && view.correctCount !== view.currentRiddle.position || view.currentRiddle.position > run.currentPosition) ||
    terminal && (view.status !== run.status || view.correctCount !== run.correctCount || view.wallElapsedMs !== run.wallFinishMs ||
      view.totalPenaltyMs !== run.hintPenaltyMs + run.skipPenaltyMs) ||
    !raceTimelineAgrees(view.events, {deckSize: run.riddles.length, correctCount: view.correctCount, hintLimits,
      totalPenaltyMs: view.totalPenaltyMs, currentPosition: view.currentRiddle?.position, live: active,
      acceptedWallMs: active ? view.wallElapsedMs : undefined}) ||
    view.events.some((event, index) => run.events[index] !== undefined && !isDeepStrictEqual(event, run.events[index])))
    throw new HttpsError("data-loss", "Stored race request is invalid.");
}

/** Validates accepted/cached authority and proves recoverable original intent without reapplying historical mutations. */
export function assertRaceMutationReceipt(response: unknown, command: RaceMutationCommand, run: RaceRunRecord, bound: boolean): void {
  /** A matching digest makes response disagreement corruption; unbound history may be a different requested operation. */
  const reject = (): never => {
    if (bound) throw new HttpsError("data-loss", "Stored race request is invalid.");
    return rejectRaceRequestReuse();
  };
  /** Distinct strict response shapes prevent a different action from reusing another action's receipt. */
  const parsed = (command.kind === "guess" ? SubmitRaceGuessResponseSchema : command.kind === "hint" ? RequestRaceHintResponseSchema :
    command.kind === "skip" ? SkipRaceRiddleResponseSchema : AbandonRaceRunResponseSchema).safeParse(response);
  if (!parsed.success) return reject();
  /** Historical authority is bound to the owned physical run and its immutable language/category. */
  const view = parsed.data.run;
  if (view.runId !== run.runId || view.locale !== run.locale || view.categoryId !== run.categoryId || view.role !== run.role)
    throw new HttpsError("data-loss", "Stored race request is invalid.");
  assertReceiptProjection(view, run);
  assertReceiptProgress(view, run, command);
  if (command.kind === "abandon") return;
  /** Correct, hint and skip events retain the original question even when the response advanced or ended. */
  const event = view.events.at(-1);
  /** A wrong guess retains its current prompt and the submitted letters in positional feedback. */
  const wrongGuess = command.kind === "guess" && "isCorrect" in parsed.data && !parsed.data.isCorrect && !parsed.data.autoSkipped;
  if (!wrongGuess && (!event || event.totalPenaltyMs !== view.totalPenaltyMs ||
    command.kind === "skip" && event.type !== "skip" || command.kind === "guess" && "isCorrect" in parsed.data &&
      (parsed.data.isCorrect && parsed.data.autoSkipped || event.type !== (parsed.data.isCorrect ? "correct" : "skip"))))
    throw new HttpsError("data-loss", "Stored race request is invalid.");
  /** Resolve the original immutable question rather than comparing against today's active question. */
  const riddleId = wrongGuess ? view.currentRiddle?.riddleId : event ? run.riddles[event.riddlePosition]?.riddleId : undefined;
  if (riddleId !== command.input.riddleId) reject();
  if (command.kind === "guess" && "feedback" in parsed.data && parsed.data.feedback.map(letter => letter.letter).join("") !== command.input.guess.trim().normalize("NFC"))
    reject();
  if (command.kind === "guess" && "feedback" in parsed.data) {
    /** Feedback and correctness derive from the original owned question, not today's successor. */
    const source = run.riddles.find(riddle => riddle.riddleId === command.input.riddleId)!;
    /** Locale-aware normalized graphemes mirror the accepted engine comparison. */
    const guess = command.input.guess.trim();
    /** Shared positional evaluator preserves duplicate-letter accounting and grapheme boundaries. */
    const statuses = computeFeedback(guess, source.answer, run.locale);
    /** Expected public letters preserve submitted casing while status comparison uses the owned locale. */
    const expected = splitGraphemes(guess, run.locale).map((letter, index) => ({letter, status: statuses[index]}));
    /** A non-clearing wrong guess cannot reset the attempt or remain active after the fifth failure. */
    const correct = lowerCaseGraphemes(guess, run.locale).join("") === lowerCaseGraphemes(source.answer.trim(), run.locale).join("");
    if (!isDeepStrictEqual(parsed.data.feedback, expected) || parsed.data.isCorrect !== correct || wrongGuess &&
      (view.status !== "active" || !view.currentRiddle || view.currentRiddle.guessesUsed < 1 || view.currentRiddle.guessesUsed >= view.rules.maxGuessesPerRiddle))
      throw new HttpsError("data-loss", "Stored race request is invalid.");
  }
  if (command.kind === "hint" && "revealedLetter" in parsed.data) {
    /** A selected hint must be a real authored letter and, while active, part of the accepted reveal set. */
    const hint = parsed.data;
    if (!event || event.type !== "hint" || splitGraphemes(run.riddles[event.riddlePosition].answer, run.locale)[hint.index] !== hint.revealedLetter ||
      view.currentRiddle && !view.currentRiddle.revealedLetters.some(letter => letter.index === hint.index && letter.letter === hint.revealedLetter))
      throw new HttpsError("data-loss", "Stored race request is invalid.");
  }
  if (run.evaluationPolicy !== "server-only" && Boolean(view.preloadedRiddles) !== Boolean(command.input.includeEvaluation)) reject();
}

/** Historical start receipts can prove their retained run context, never missing original presentation intent. */
export function assertLegacyRaceStart(input: StartRaceRunRequest, run: RaceRunRecord): void {
  if (input.locale !== run.locale || input.challengeId !== run.challengeId || input.rivalryChallengeId !== run.rivalryChallengeId ||
    input.fallbackOfferId !== run.fallbackOfferId || input.offerId !== run.matchOfferId ||
    input.categoryId !== undefined && input.categoryId !== "mixed" && input.categoryId !== run.categoryId ||
    input.fallbackOfferId === undefined && Boolean(input.prepare) !== (run.preparationExpiresAtMs !== undefined)) rejectRaceRequestReuse();
}
