import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {
  PlayerSettingsAction, PlayerSettingsActionOutcome, PlayerSettingsActionsCapability, PlayerSettingsActionsSnapshot,
} from "../../../../../src/settings/contracts/playerSettingsActions";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";
import type {FacebookInstantSdk} from "../fbinstant";

/** Meta permits only one shortcut prompt attempt per game session, including dismissal. */
const shortcutAttempted = new WeakSet<FacebookInstantSdk>();

type NativeAction = {
  id: PlayerSettingsAction;
  canRun?: () => Promise<boolean>;
  repeatable?: boolean;
  invoke: () => Promise<void>;
};

export type FacebookPlayerSettingsActionsOptions = {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
  /** Rejects when current progress cannot be durably saved; quitting must then stop. */
  flushBeforeQuit: () => Promise<void>;
  reportFailure?: (failure: {action: PlayerSettingsAction; error: unknown}) => void;
};

/** Exposes only advertised, callable native actions; eligibility is checked before each prompt. */
export function createFacebookPlayerSettingsActions({
  sdk, isActive, flushBeforeQuit, reportFailure,
}: FacebookPlayerSettingsActionsOptions): PlayerSettingsActionsCapability | undefined {
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const nativeActions: NativeAction[] = [];
  const canCreateShortcut = typeof sdk.canCreateShortcutAsync === "function" ? sdk.canCreateShortcutAsync.bind(sdk) : undefined;
  const createShortcut = typeof sdk.createShortcutAsync === "function" ? sdk.createShortcutAsync.bind(sdk) : undefined;
  if (supported.has("canCreateShortcutAsync") && supported.has("createShortcutAsync") && canCreateShortcut && createShortcut) {
    nativeActions.push({id: "create-shortcut", canRun: async () => !shortcutAttempted.has(sdk) && await canCreateShortcut(),
      invoke: async () => {shortcutAttempted.add(sdk); await createShortcut();}});
  }
  const community = sdk.community;
  const canFollow = typeof community?.canFollowOfficialPageAsync === "function" ? community.canFollowOfficialPageAsync.bind(community) : undefined;
  const follow = typeof community?.followOfficialPageAsync === "function" ? community.followOfficialPageAsync.bind(community) : undefined;
  if (supported.has("community.canFollowOfficialPageAsync") && supported.has("community.followOfficialPageAsync") && canFollow && follow) {
    nativeActions.push({id: "follow-community", canRun: canFollow, invoke: follow});
  }
  const canJoin = typeof community?.canJoinOfficialGroupAsync === "function" ? community.canJoinOfficialGroupAsync.bind(community) : undefined;
  const join = typeof community?.joinOfficialGroupAsync === "function" ? community.joinOfficialGroupAsync.bind(community) : undefined;
  if (supported.has("community.canJoinOfficialGroupAsync") && supported.has("community.joinOfficialGroupAsync") && canJoin && join) {
    nativeActions.push({id: "join-community", canRun: canJoin, invoke: join});
  }
  const quit = typeof sdk.quit === "function" ? sdk.quit.bind(sdk) : undefined;
  const openExternalLink = typeof sdk.openExternalLinkAsync === "function" ? sdk.openExternalLinkAsync.bind(sdk) : undefined;
  if (supported.has("openExternalLinkAsync") && openExternalLink) {
    nativeActions.push(
      {id: "privacy-policy", repeatable: true, invoke: () => openExternalLink("https://roobsworld.com/riddle-quest/privacy")},
      {id: "terms-of-use", repeatable: true, invoke: () => openExternalLink("https://roobsworld.com/riddle-quest/terms")},
    );
  }
  if (supported.has("quit") && quit) nativeActions.push({id: "quit", invoke: async () => {quit();}});
  if (nativeActions.length === 0) return undefined;

  let retired = false;
  let revision = 0;
  const current = () => !retired && isActive();
  const report = (action: PlayerSettingsAction, error: unknown) => {
    if (!current()) return;
    try {reportFailure?.({action, error});} catch { /* Diagnostics cannot change a player action's outcome. */ }
  };
  const available = new Set(nativeActions.filter(action => !action.canRun).map(action => action.id));
  const unsupported = new Set<PlayerSettingsAction>();
  const listeners = new Set<() => void>();
  let snapshot: PlayerSettingsActionsSnapshot = {actions: nativeActions.filter(action => available.has(action.id)).map(action => action.id), pendingAction: null};
  const publish = (pendingAction: PlayerSettingsAction | null) => {
    if (!current()) return;
    snapshot = {actions: nativeActions.filter(action => available.has(action.id) || action.id === pendingAction).map(action => action.id), pendingAction};
    listeners.forEach(listener => listener());
  };
  const eligible = async (action: NativeAction): Promise<boolean> => {
    try {return current() && !unsupported.has(action.id) && (!action.canRun || await action.canRun() === true) && current();} catch {return false;}
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {listeners.add(listener); return () => {listeners.delete(listener);};},
    refresh: async () => {
      if (!current() || snapshot.pendingAction) return;
      const request = ++revision;
      const eligibility = await Promise.all(nativeActions.map(eligible));
      if (!current() || request !== revision || snapshot.pendingAction) return;
      nativeActions.forEach((action, index) => {if (eligibility[index]) available.add(action.id); else available.delete(action.id);});
      publish(null);
    },
    run: async (id, signal) => {
      if (signal?.aborted) return "cancelled";
      if (!current() || snapshot.pendingAction || !available.has(id)) return "unavailable";
      const action = nativeActions.find(candidate => candidate.id === id);
      if (!action) return "unavailable";
      ++revision;
      publish(id);
      let unsaved = false;
      try {
        const result = await runFacebookSdkDialog(sdk, async (): Promise<PlatformResult<void>> => {
          if (signal?.aborted || !current()) return {status: "cancelled"};
          const mayRun = await eligible(action);
          if (signal?.aborted || !current()) return {status: "cancelled"};
          if (!mayRun) {
            available.delete(id);
            return {status: "unavailable", message: "facebook-settings-action-ineligible"};
          }
          if (id === "quit") {
            try {await flushBeforeQuit();} catch (error) {
              unsaved = true;
              report(id, error);
              return {status: "retryable-failure", message: "player-progress-unsaved"};
            }
          }
          if (!current() || signal?.aborted) return {status: "cancelled"};
          try {
            await action.invoke();
            if (!current()) return {status: "cancelled"};
            if (id !== "quit" && !action.repeatable) available.delete(id);
            return signal?.aborted ? {status: "cancelled"} : {status: "success", value: undefined};
          } catch (error) {
            if (!current()) return {status: "cancelled"};
            const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
            if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
            if (code === "CLIENT_UNSUPPORTED_OPERATION" || code === "PAGE_NOT_LINKED" || code === "GROUP_NOT_LINKED") {
              unsupported.add(id);
              available.delete(id);
              return {status: "unavailable", message: "facebook-settings-action-unavailable"};
            }
            report(id, error);
            return {status: "retryable-failure", message: "facebook-settings-action-failed"};
          }
        });
        if (!current() || signal?.aborted) return "cancelled";
        const outcome: PlayerSettingsActionOutcome = result.status === "success" || result.status === "cancelled" || result.status === "unavailable"
          ? result.status : unsaved ? "unsaved" : "error";
        return outcome;
      } finally {
        if (shortcutAttempted.has(sdk)) available.delete("create-shortcut");
        publish(null);
      }
    },
    retire: () => {
      retired = true;
      ++revision;
      snapshot = {actions: [], pendingAction: null};
      listeners.forEach(listener => listener());
      listeners.clear();
    },
  };
}
