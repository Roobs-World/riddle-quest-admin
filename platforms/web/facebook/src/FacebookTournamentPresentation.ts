import type {ListFacebookTournamentResponse, RaceLocale, RecordFacebookTournamentRunResponse} from "../../../../src/races/contracts/index";
import type {PlatformResult} from "../../../../src/platform/contracts/capabilities";
import {tr} from "../../../../src/localization/browser/i18n";
import {captureVictoryShareImage} from "../../../../src/sharing/browser/shareImages";
import type {FacebookAgeCategory} from "./FacebookCapabilityPolicy";
import type {FacebookInstantSdk, FacebookInstantTournament} from "./fbinstant";
import {parseFacebookTournamentResponse, parseFacebookTournamentRecordResponse} from "./facebookCallableResponses";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";
import {parseFacebookTournamentPayload} from "./social/facebookTournamentPayload";

/** Native score/sharing projection of server-owned daily tournaments; no economy authority. */
export function createFacebookTournamentPresentation({sdk, enabled, ageCategory, isActive, getLocale, list,
  now = Date.now, renderImage = captureVictoryShareImage, reportFailure = () => undefined}: {
  /** Started Meta SDK instance. */
  sdk: FacebookInstantSdk;
  /** Authenticated tournament switch. */
  enabled: boolean;
  /** Verified audience configuration. */
  ageCategory: FacebookAgeCategory;
  /** Rejects work after teardown or account deletion. */
  isActive: () => boolean;
  /** Selected content locale, rechecked after asynchronous work. */
  getLocale: () => RaceLocale;
  /** Fresh authenticated official standings; caller inputs cannot nominate a score. */
  list: (locale: RaceLocale) => Promise<ListFacebookTournamentResponse>;
  /** Local clock used only to reject expired presentation, never to grant/rank. */
  now?: () => number;
  /** Identity-free PNG renderer. */
  renderImage?: typeof captureVictoryShareImage;
  /** Receives only fixed diagnostic errors, not raw SDK payloads. */
  reportFailure?: (error: Error) => void;
}) {
  const supported = new Set(sdk.getSupportedAPIs());
  const canCreate = supported.has("tournament.createAsync") && typeof sdk.tournament?.createAsync === "function";
  const canShare = supported.has("tournament.shareAsync") && typeof sdk.tournament?.shareAsync === "function";
  const canProject = supported.has("tournament.postScoreAsync") && typeof sdk.tournament?.postScoreAsync === "function";
  if (!enabled || ageCategory !== "13_plus" || !supported.has("getTournamentAsync") ||
    typeof sdk.getTournamentAsync !== "function" || typeof sdk.context?.getID !== "function" ||
    (!canCreate && !canShare && !canProject)) return undefined;

  /** Hints associate native presentation with one exact official locale/day; they grant nothing. */
  const envelope = (board: ListFacebookTournamentResponse) => ({kind: "rq-race10-tournament-v1", locale: board.locale,
    tournamentId: board.tournamentId, startsAtMs: board.startsAtMs, endsAtMs: board.endsAtMs});
  /** Account and selected content locale must still agree after every asynchronous boundary. */
  const active = (locale: RaceLocale) => isActive() && getLocale() === locale;
  /** Requires the current account/locale and a safe clock strictly inside the official window. */
  const live = (board: ListFacebookTournamentResponse, locale: RaceLocale) => {
    /** Local expiration guard is rechecked after awaited SDK/server work. */
    const clock = now();
    return active(locale) && board.locale === locale && Number.isSafeInteger(clock) &&
      clock >= board.startsAtMs && clock < board.endsAtMs;
  };
  /** Native contexts are untrusted and cannot supply a run, rank, score or reward. */
  const matches = (native: FacebookInstantTournament, board: ListFacebookTournamentResponse) => {
    /** Compare an exact small envelope without accepting extra payload fields. */
    const payload = parseFacebookTournamentPayload(native.getPayload());
    /** Compare against the exact authoritative daily/locale envelope. */
    const expected = envelope(board);
    return typeof native.getID() === "string" && /^[A-Za-z0-9._:-]{1,256}$/.test(native.getID()) &&
      native.getContextID() === sdk.context!.getID() && native.getEndTime() === board.endsAtMs / 1000 &&
      payload !== null && typeof payload === "object" && !Array.isArray(payload) &&
      Object.keys(payload).length === Object.keys(expected).length &&
      Object.entries(expected).every(([key, value]) => (payload as Record<string, unknown>)[key] === value);
  };
  /** Meta returns a missing-current-tournament error when entered outside a native tournament. */
  const current = async () => {
    try { return await sdk.getTournamentAsync!(); } catch (error) {
      /** Only explicit absence allows creation; transport/permission errors must not create duplicates. */
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === "TOURNAMENT_NOT_FOUND") return undefined;
      throw error;
    }
  };
  /** Bounds read-only projection lookup while retaining observers on the original SDK promise. */
  const projectionCurrent = async () => {
    /** Only an admitted metadata query owns this deadline; score posts retain their original ordering. */
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([current(), new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("facebook-tournament-projection-lookup-timeout")), 8000);
      })]);
    } finally {if (timeout !== undefined) clearTimeout(timeout);}
  };
  /** Serialize native updates so an older board cannot overwrite a newer best. */
  let projectionTail = Promise.resolve();
  /** One still-pending native lookup retains the best validated snapshot in its exact scope. */
  type PendingProjection = {
    /** Fresh official best received before native score admission. */ board: ListFacebookTournamentResponse;
    /** Admitted score posts preserve their original promise and serialization. */ posting: boolean;
    /** Concurrent recovery callers observe the same local completion. */ operation: Promise<void>;
  };
  /** Entries are removed after settlement without deleting a newer queued improvement. */
  const pending = new Map<string, PendingProjection>();
  /** Successful presentation is deduplicated per exact native and official context. */
  const posted = new Map<string, number>();
  /** Only fixed diagnostics leave the optional provider boundary. */
  const projectionFailure = () => {
    try {reportFailure(new Error("facebook-tournament-score-projection-failed"));} catch {
      // Optional telemetry cannot reject an already-authoritative game operation.
    }
  };
  /** Recovered server standings authorize presentation without any client score receipt. */
  const projectBoard = (value: ListFacebookTournamentResponse): Promise<void> => {
    if (!canProject) return Promise.resolve();
    /** Validated official standings for the exact player locale and UTC window. */
    let board: ListFacebookTournamentResponse;
    try {board = parseFacebookTournamentResponse(value);} catch {projectionFailure(); return Promise.resolve();}
    /** Native context changes must not inherit pending work from another context. */
    let contextId: string | null;
    try {
      if (!live(board, board.locale) || !board.currentPlayer) return Promise.resolve();
      contextId = sdk.context!.getID();
    } catch {projectionFailure(); return Promise.resolve();}
    /** Official locale/day and native context own one pending projection. */
    const scope = JSON.stringify([contextId, board.locale, board.tournamentId]);
    /** Work still waiting for native lookup can adopt an improved server best. */
    const existing = pending.get(scope);
    if (existing && (!existing.posting || board.currentPlayer.adjustedTimeMs >= existing.board.currentPlayer!.adjustedTimeMs)) {
      if (!existing.posting && board.currentPlayer.adjustedTimeMs < existing.board.currentPlayer!.adjustedTimeMs)
        existing.board = board;
      return existing.operation;
    }
    /** This entry is initialized before its deferred operation can be admitted. */
    let entry: PendingProjection;
    /** Serialized native update preserves ordering between recovered score snapshots. */
    const operation = projectionTail.then(async () => {
      if (!live(entry.board, entry.board.locale) || sdk.context!.getID() !== contextId) return;
      /** Current Meta tournament must match the authoritative board and live context. */
      const native = await projectionCurrent();
      /** More official reads may have improved the best while native lookup was pending. */
      const selected = entry.board;
      if (!live(selected, selected.locale) || sdk.context!.getID() !== contextId || !native || !matches(native, selected)) return;
      /** Exact native/official scope owns its successful-post cache. */
      const key = JSON.stringify([native.getID(), native.getContextID(), selected.tournamentId]);
      /** Only the current official best supplies a native score. */
      const score = selected.currentPlayer!.adjustedTimeMs, previous = posted.get(key);
      if (previous !== undefined && previous <= score) return;
      entry.posting = true;
      await sdk.tournament!.postScoreAsync(score);
      posted.set(key, score);
      if (posted.size > 8) posted.delete(posted.keys().next().value!);
    }).catch(projectionFailure).finally(() => {if (pending.get(scope) === entry) pending.delete(scope);});
    entry = {board, posting: false, operation};
    pending.set(scope, entry);
    projectionTail = operation;
    return operation;
  };
  const share =
    /** Opens one explicitly requested native share/create dialog using a fresh official best score. */
    async (locale: RaceLocale, signal?: AbortSignal): Promise<PlatformResult<void>> => {
      return runFacebookSdkDialog(sdk, async () => {
        try {
          if (!active(locale)) return {status: "unavailable", message: "facebook-tournament-inactive"};
          if (signal?.aborted) return {status: "cancelled"};
          /** Presentation retirement cannot admit native UI from a late original read. */
          const retired = Object.assign(new Error("facebook-tournament-share-retired"), {code: "USER_CANCELLED"});
          /** Preparation may expire locally without changing either original read promise. */
          let expired = false;
          /** One shared budget covers standings and metadata, ending before native dialog admission. */
          let timeout: ReturnType<typeof setTimeout> | undefined;
          /** A timer boundary cannot admit the next SDK read from an already fulfilled race. */
          const assertPreparing = () => {
            if (signal?.aborted) throw retired;
            if (expired) throw new Error("facebook-tournament-share-preparation-timeout");
          };
          /** One registered listener is removed before native dialog admission. */
          let cancelPreparation: (() => void) | undefined;
          /** Both original read promises retain rejection observers after local expiry or retirement. */
          const deadline = new Promise<never>((_resolve, reject) => {
            cancelPreparation = () => reject(retired);
            signal?.addEventListener("abort", cancelPreparation, {once: true});
            timeout = setTimeout(() => {expired = true; reject(new Error("facebook-tournament-share-preparation-timeout"));}, 8000);
          });
          /** Exact-schema official standings authorize only the current best. */
          let board: ListFacebookTournamentResponse;
          /** Current native metadata is untrusted and receives the remaining preparation budget. */
          let native: FacebookInstantTournament | undefined;
          try {
            /** A retired read cannot continue into metadata admission or parsing. */
            const response = await Promise.race([list(locale), deadline]);
            assertPreparing();
            board = parseFacebookTournamentResponse(response);
            if (!live(board, locale) || !board.currentPlayer) {
              return {status: "unavailable", message: "facebook-tournament-score-unavailable"};
            }
            native = await Promise.race([current(), deadline]);
            assertPreparing();
          } finally {
            if (timeout !== undefined) clearTimeout(timeout);
            if (cancelPreparation) signal?.removeEventListener("abort", cancelPreparation);
          }
          assertPreparing();
          if (!live(board, locale) || !board.currentPlayer) {
            return {status: "unavailable", message: "facebook-tournament-inactive"};
          }
          /** Existing native tournaments for another day/locale are never overwritten or silently switched. */
          if (native) {
            /** A native invitation in another supported content locale receives existing localized guidance. */
            const payload = parseFacebookTournamentPayload(native.getPayload());
            if (payload !== null && typeof payload === "object" && "locale" in payload && payload.locale !== locale) {
              return {status: "unavailable", message: "RaceTo10.ERROR_LOCALE_MISMATCH"};
            }
            if (!matches(native, board)) return {status: "unavailable", message: "facebook-tournament-context-mismatch"};
            if (!canShare) return {status: "unavailable", message: "facebook-tournament-sharing-unavailable"};
            assertPreparing();
            await sdk.tournament!.shareAsync({score: board.currentPlayer.adjustedTimeMs, data: envelope(board)});
          } else {
            if (!canCreate) return {status: "unavailable", message: "facebook-tournament-creation-unavailable"};
            /** Native creation is itself the explicit provider dialog; do not open a second share dialog. */
            const image = renderImage({title: tr("RaceTo10.HUB_TOURNAMENTS"),
              summary: tr("RaceTo10.TIME_TO_BEAT", {time: `${(board.currentPlayer.adjustedTimeMs / 1000).toFixed(2)}s`}), emojiGrid: ""});
            if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length > 2_800_000) {
              throw new Error("facebook-tournament-image-unavailable");
            }
            assertPreparing();
            await sdk.tournament!.createAsync({initialScore: board.currentPlayer.adjustedTimeMs,
              config: {title: tr("RaceTo10.HUB_TOURNAMENTS"), image, sortOrder: "LOWER_IS_BETTER",
                scoreFormat: "NUMERIC", endTime: board.endsAtMs / 1000}, data: envelope(board)});
          }
          return {status: "success", value: undefined};
        } catch (error) {
          /** Cancellation is ordinary user input, with no provider diagnostics exposed. */
          const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
          if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
          try {reportFailure(new Error("facebook-tournament-share-failed"));} catch {
            // Optional diagnostics cannot replace the contained provider outcome.
          }
          return {status: "retryable-failure", message: "facebook-tournament-share-failed"};
        }
      });
    };
  return {
    ...((canCreate || canShare) ? {share} : {}),
    /** Projects a fresh official board when a completed activity is recovered or reopened. */
    projectBoard,
    /** Idempotent official receipts can recover a native projection after a lost browser reply. */
    async projectRecord(value: RecordFacebookTournamentRunResponse): Promise<void> {
      if (!canProject) return;
      try {
        /** Validated official receipt may represent an idempotent server replay. */
        const record = parseFacebookTournamentRecordResponse(value);
        if (!active(record.locale)) return;
        /** Validated official standings for the exact player locale and UTC window. */
        const board = parseFacebookTournamentResponse(await list(record.locale));
        if (!live(board, record.locale) || board.tournamentId !== record.tournamentId || !board.currentPlayer ||
          board.currentPlayer.adjustedTimeMs > record.adjustedTimeMs) return;
        await projectBoard(board);
      } catch {projectionFailure();}
    },
  };
}
