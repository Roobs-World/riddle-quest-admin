import type {ListFacebookTournamentResponse, RaceLocale, RecordFacebookTournamentRunResponse} from "@qwordly/core/race";
import type {PlatformResult} from "../platform/types";
import {tr} from "../play/i18n";
import {captureVictoryShareImage} from "../play/sharing/shareImages";
import type {FacebookAgeCategory} from "./FacebookCapabilityPolicy";
import type {FacebookInstantSdk, FacebookInstantTournament} from "./fbinstant";
import {parseFacebookTournamentResponse, parseFacebookTournamentRecordResponse} from "./facebookCallableResponses";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";

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
  /** All native APIs must be advertised and callable independently of the server board. */
  const required = ["getTournamentAsync", "tournament.createAsync", "tournament.shareAsync", "tournament.postScoreAsync"];
  if (!enabled || ageCategory !== "13_plus" || required.some(api => !sdk.getSupportedAPIs().includes(api)) ||
    typeof sdk.getTournamentAsync !== "function" || typeof sdk.context?.getID !== "function" ||
    typeof sdk.tournament?.createAsync !== "function" || typeof sdk.tournament.shareAsync !== "function" ||
    typeof sdk.tournament.postScoreAsync !== "function") return undefined;

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
    const payload = native.getPayload();
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
  return {
    /** Opens one explicitly requested native share/create dialog using a fresh official best score. */
    async share(locale: RaceLocale): Promise<PlatformResult<void>> {
      return runFacebookSdkDialog(sdk, async () => {
        try {
          if (!active(locale)) return {status: "unavailable", message: "facebook-tournament-inactive"};
          /** Re-parse even injected dependencies, including full UTC/standing invariants. */
          const board = parseFacebookTournamentResponse(await list(locale));
          if (!live(board, locale) || !board.currentPlayer) {
            return {status: "unavailable", message: "facebook-tournament-score-unavailable"};
          }
          /** Read current native state without treating its score or payload as authority. */
          const native = await current();
          if (!live(board, locale)) return {status: "unavailable", message: "facebook-tournament-inactive"};
          /** Existing native tournaments for another day/locale are never overwritten or silently switched. */
          if (native) {
            /** A native invitation in another supported content locale receives existing localized guidance. */
            const payload = native.getPayload();
            if (payload !== null && typeof payload === "object" && "locale" in payload && payload.locale !== locale) {
              return {status: "unavailable", message: "RaceTo10.ERROR_LOCALE_MISMATCH"};
            }
            if (!matches(native, board)) return {status: "unavailable", message: "facebook-tournament-context-mismatch"};
            await sdk.tournament!.shareAsync({score: board.currentPlayer.adjustedTimeMs, data: envelope(board)});
          } else {
            /** Native creation is itself the explicit provider dialog; do not open a second share dialog. */
            const image = renderImage({title: tr("RaceTo10.HUB_TOURNAMENTS"),
              summary: tr("RaceTo10.TIME_TO_BEAT", {time: `${(board.currentPlayer.adjustedTimeMs / 1000).toFixed(2)}s`}), emojiGrid: ""});
            if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length > 2_800_000) {
              throw new Error("facebook-tournament-image-unavailable");
            }
            await sdk.tournament!.createAsync({initialScore: board.currentPlayer.adjustedTimeMs,
              config: {title: tr("RaceTo10.HUB_TOURNAMENTS"), image, sortOrder: "LOWER_IS_BETTER",
                scoreFormat: "NUMERIC", endTime: board.endsAtMs / 1000}, data: envelope(board)});
          }
          return {status: "success", value: undefined};
        } catch (error) {
          /** Cancellation is ordinary user input, with no provider diagnostics exposed. */
          const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
          if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
          reportFailure(new Error("facebook-tournament-share-failed"));
          return {status: "retryable-failure", message: "facebook-tournament-share-failed"};
        }
      });
    },
    /** Projects an authoritative recorded run into the matching current native context only. */
    async projectRecord(value: RecordFacebookTournamentRunResponse): Promise<void> {
      try {
        /** This server receipt cannot be replaced by native entry data. */
        const record = parseFacebookTournamentRecordResponse(value);
        if (!active(record.locale) || !record.improved) return;
        /** A newer concurrent run may already have improved the official best. */
        const board = parseFacebookTournamentResponse(await list(record.locale));
        if (!live(board, record.locale) || board.tournamentId !== record.tournamentId || !board.currentPlayer ||
          board.currentPlayer.adjustedTimeMs > record.adjustedTimeMs) return;
        /** Native context scope is revalidated after the provider lookup completes. */
        const native = await current();
        if (!live(board, record.locale) || !native || !matches(native, board)) return;
        await sdk.tournament!.postScoreAsync(board.currentPlayer.adjustedTimeMs);
      } catch {
        /** Provider failure cannot undo or fail an already-authoritative game submission. */
        try {reportFailure(new Error("facebook-tournament-score-projection-failed"));} catch {
          // Optional diagnostics cannot reject the detached presentation promise.
        }
      }
    },
  };
}
