import type {LiveRaceCapability, RaceLocale} from "@riddle-quest/core/race";
import english from "../../../../src/locales/en/race.json";
import {tr} from "../../../../packages/web-game/src/play/i18n";
import {captureVictoryShareImage} from "../../../../packages/web-game/src/play/sharing/shareImages";
import type {FacebookContextCoordinator} from "./contexts";
import type {FacebookInstantSdk} from "./fbinstant";
import type {FacebookAgeCategory} from "./FacebookCapabilityPolicy";
import {runFacebookSdkDialog} from "./FacebookSdkDialogGate";

/** Native locale identifiers describe all of the game's supported translations. */
const locales: Record<RaceLocale, string> = {en: "en_US", es: "es_ES", pt: "pt_BR", fr: "fr_FR", de: "de_DE",
  ja: "ja_JP", ko: "ko_KR", hi: "hi_IN", ru: "ru_RU", tr: "tr_TR", ar: "ar_AR", id: "id_ID",
  it: "it_IT", nl: "nl_NL", pl: "pl_PL", vi: "vi_VN"};

/** Prepares private context play independently of global matching and ordinary friend-picker invitations. */
export function createFacebookContextChallenges({sdk, coordinator, live, join, template, enabled, ageCategory,
  isActive, getLocale, renderImage = captureVictoryShareImage, reportFailure = () => undefined}: {
  /** Started owning native SDK. */ sdk: FacebookInstantSdk;
  /** Native selection is reconciled with the existing game membership service. */
  coordinator: Pick<FacebookContextCoordinator, "chooseContext" | "ensureCurrent">;
  /** Ordinary transport retains public matching, rematches and safety operations. */ live: LiveRaceCapability;
  /** Original authenticated join accepts the captured context without selecting it again. */ join: LiveRaceCapability["join"];
  /** Template identifier must be declared in this artifact's fbapp-config.json. */ template: string | undefined;
  /** Authenticated multiplayer rollout gate. */ enabled: boolean;
  /** Verified build audience. */ ageCategory: FacebookAgeCategory;
  /** Account deletion or entry retirement excludes native delivery. */ isActive: () => boolean;
  /** Content language belongs to the active account entry. */ getLocale: () => RaceLocale;
  /** Locally rendered invitation card. */ renderImage?: typeof captureVictoryShareImage;
  /** Fixed diagnostic contains no native errors or context identifiers. */ reportFailure?: (error: Error) => void;
}): LiveRaceCapability["chooseChallenge"] {
  if (!enabled || ageCategory !== "13_plus" || !template || !/^[A-Za-z0-9_-]{1,128}$/u.test(template) ||
    !sdk.getSupportedAPIs().includes("updateAsync") || typeof sdk.updateAsync !== "function") return undefined;
  return async () => {
    if (!isActive()) return {status: "error"};
    /** The chooser and all later work retain the initiating content language. */
    const locale = getLocale();
    try {
      /** Dismissed native selection never creates a private server lobby. */
      const selected = await coordinator.chooseContext();
      if (selected.status === "cancelled") return {status: "cancelled"};
      if (selected.status !== "success" || !isActive() || getLocale() !== locale) return {status: "error"};
      /** Exact native selection is pinned for the entire private journey. */
      const context = {...selected.value};
      /** Completed joins alone authorize sending an opaque invitation from this transport. */
      const invitations = new Set<string>();
      /** Successful sends converge locally; unknown failures are never automatically retried. */
      const delivered = new Set<string>();
      /** Native state is read immediately before SDK dispatch without asynchronous retargeting. */
      const current = () => isActive() && getLocale() === locale &&
        sdk.context?.getID() === context.contextId && sdk.context?.getType() === context.contextType;
      /** Only this returned transport starts private play in the selected group. */
      const bound: LiveRaceCapability = {...live,
        join: async input => {
          if (input.locale !== locale || input.challengeId || input.rematchOfTicketId || !current())
            throw new Error("facebook-private-context-changed");
          /** Successful reconciliation must still belong to the immutable selected audience. */
          const synchronized = await coordinator.ensureCurrent();
          if (synchronized.status !== "success" || synchronized.value.contextId !== context.contextId ||
            synchronized.value.contextType !== context.contextType || !current()) throw new Error("facebook-private-context-changed");
          /** Server private-lobby semantics exclude the public queue and bot fallback. */
          const result = await join({...input, createChallenge: true, facebookContextId: context.contextId});
          if (result.challengeId && /^live_[a-f0-9]{64}$/u.test(result.challengeId)) {
            invitations.add(result.challengeId);
            if (invitations.size > 32) {
              /** Retired handles lose both authority and presentation deduplication. */
              const oldest = invitations.values().next().value!;
              invitations.delete(oldest); delivered.delete(oldest);
            }
          }
          return result;
        },
        shareChallenge: async ({challengeId}) => {
          if (!invitations.has(challengeId) || !current()) return "error";
          if (delivered.has(challengeId)) return "success";
          /** Context updates share the owning SDK's dialog exclusion with ads and native invitations. */
          const outcome = await runFacebookSdkDialog(sdk, async () => {
            try {
              if (!current()) return {status: "unavailable", message: "facebook-private-context-changed"};
              /** Existing translated copy and a local image disclose no player identity or answer. */
              const title = tr("RaceTo10.TITLE"), summary = tr("RaceTo10.CHALLENGE_FRIEND");
              /** Render synchronously, then recheck native state immediately before dispatch. */
              const image = renderImage({title, summary, emojiGrid: ""});
              if (!image || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(image) || image.length > 2_800_000)
                throw new Error("facebook-private-context-image-unavailable");
              if (!current()) return {status: "unavailable", message: "facebook-private-context-changed"};
              await sdk.updateAsync!({action: "CUSTOM", template, image,
                text: {default: `${english.RaceTo10.TITLE} · ${english.RaceTo10.CHALLENGE_FRIEND}`,
                  localizations: {[locales[locale]]: `${tr("RaceTo10.TITLE")} · ${summary}`}},
                data: {challengeId}, strategy: "IMMEDIATE", notification: "NO_PUSH"});
              delivered.add(challengeId);
              // SDK settlement never implies that anybody accepted the private server invitation.
              return {status: "success", value: undefined};
            } catch (error) {
              /** Native dismissal is expected; provider diagnostics remain private. */
              const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
              if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
              reportFailure(new Error("facebook-private-context-delivery-failed"));
              return {status: "retryable-failure", message: "facebook-private-context-delivery-failed"};
            }
          });
          return outcome.status === "success" ? "success" : outcome.status === "cancelled" ? "cancelled" : "error";
        },
      };
      return {status: "success", value: bound};
    } catch {
      reportFailure(new Error("facebook-private-context-selection-failed"));
      return {status: "error"};
    }
  };
}
