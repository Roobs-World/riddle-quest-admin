import {completionPresentationKey} from "../../../../src/gameplay/session/completion/completionPresentation";
import type {CompletionResult} from "../../../../src/platform/contracts/hostServices";
import type {HostCompletionInput} from "../../../../src/progression/browser/hostCompletionEffects";

/** Requests one result-screen opportunity after every three confirmed solo wins in this account visit. */
export function createFacebookLevelInterstitial({show, isActive}: {
  /** The ad adapter rechecks this result's ownership after loading and before display. */
  show: (isCurrent: () => boolean) => Promise<void>;
  /** Rejects work after the originating account or platform session retires. */
  isActive: () => boolean;
}) {
  const consumed = new Set<string>();
  const dismissed = new Set<string>();
  let completedSinceOpportunity = 0;
  let currentCompletion: string | null = null;
  let retired = false;

  return {
    /** Consumes authoritative receipt identity before any optional asynchronous ad work. */
    async complete(input: HostCompletionInput, result: CompletionResult): Promise<void> {
      if (retired || !isActive()) return;
      const presentationKey = completionPresentationKey(input);
      const identity = JSON.stringify([input.gameMode, presentationKey]);
      if (consumed.has(identity)) return;
      consumed.add(identity);
      currentCompletion = identity;
      if (!result.isCorrect) return;
      completedSinceOpportunity = (completedSinceOpportunity + 1) % 3;
      if (completedSinceOpportunity !== 0) return;

      const isCurrent = () => !retired && isActive() && currentCompletion === identity &&
        !dismissed.has(presentationKey);
      if (isCurrent()) await show(isCurrent);
    },
    /** Dismissals can precede delayed authority receipts and permanently retire that result. */
    dismiss(presentationKey: string): void {
      if (!retired) dismissed.add(presentationKey);
    },
    /** Revokes pending SDK work and releases receipt history for the finished account visit. */
    retire(): void {
      retired = true;
      currentCompletion = null;
      consumed.clear();
      dismissed.clear();
    },
  };
}
