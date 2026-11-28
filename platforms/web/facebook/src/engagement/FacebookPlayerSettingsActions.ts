import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {
  PlayerSettingsAction, PlayerSettingsActionOutcome, PlayerSettingsActionsCapability, PlayerSettingsActionsSnapshot,
} from "../../../../../src/settings/contracts/playerSettingsActions";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";
import type {FacebookInstantSdk} from "../fbinstant";
import {createFacebookMessengerBotConsent} from "../notifications/FacebookMessengerBotConsent";

/** Meta permits only one shortcut prompt attempt per game session, including dismissal. */
const shortcutAttempted = new WeakSet<FacebookInstantSdk>();
const QUIT_PREPARATION_TIMEOUT_MS = 15_000;

const ACTION_LABELS = {
  "create-shortcut": "Settings.ADD_SHORTCUT_BUTTON",
  "follow-community": "Settings.FOLLOW_COMMUNITY_BUTTON",
  "join-community": "Settings.JOIN_COMMUNITY_BUTTON",
  "subscribe-messenger-bot": "Settings.MESSENGER_UPDATES_BUTTON",
  "privacy-policy": "Settings.PRIVACY_BUTTON",
  "terms-of-use": "Settings.TERMS_BUTTON",
  quit: "Settings.QUIT_GAME_BUTTON",
};
type FacebookPlayerSettingsAction = keyof typeof ACTION_LABELS;

type NativeAction = {
  id: FacebookPlayerSettingsAction;
  canRun?: (signal?: AbortSignal) => Promise<boolean>;
  repeatable?: boolean;
  invoke: (signal?: AbortSignal) => Promise<void>;
  isComplete?: () => boolean;
};

export type FacebookPlayerSettingsActionsOptions = {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
  messengerBotEnabled?: boolean;
  /** Rejects when current progress cannot be durably saved; quitting must then stop. */
  flushBeforeQuit: () => Promise<void>;
  reportFailure?: (failure: {action: FacebookPlayerSettingsAction; error: unknown}) => void;
};

/** Exposes only advertised, callable native actions; eligibility is checked before each prompt. */
export function createFacebookPlayerSettingsActions({
  sdk, isActive, flushBeforeQuit, reportFailure, messengerBotEnabled = false,
}: FacebookPlayerSettingsActionsOptions): PlayerSettingsActionsCapability | undefined {
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const nativeActions: NativeAction[] = [];
  const botConsent = createFacebookMessengerBotConsent({sdk, enabled: messengerBotEnabled, isActive});
  if (botConsent) nativeActions.push({id: "subscribe-messenger-bot", canRun: botConsent.eligible,
    invoke: botConsent.request, isComplete: botConsent.isSubscribed});
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
  const actionLifetime = new AbortController();
  let quitPreparation: Promise<void> | undefined;
  let revision = 0;
  const current = () => !retired && isActive();
  const report = (action: FacebookPlayerSettingsAction, error: unknown) => {
    if (!current()) return;
    try {reportFailure?.({action, error});} catch { /* Diagnostics cannot change a player action's outcome. */ }
  };
  const available = new Set(nativeActions.filter(action => !action.canRun).map(action => action.id));
  const unsupported = new Set<FacebookPlayerSettingsAction>();
  const listeners = new Set<() => void>();
  const describeAction = ({id}: NativeAction): PlayerSettingsAction => ({id, labelKey: ACTION_LABELS[id]});
  let snapshot: PlayerSettingsActionsSnapshot = {actions: nativeActions.filter(action => available.has(action.id)).map(describeAction), pendingAction: null};
  const publish = (pendingAction: FacebookPlayerSettingsAction | null) => {
    if (!current()) return;
    snapshot = {actions: nativeActions.filter(action => available.has(action.id) || action.id === pendingAction).map(describeAction), pendingAction};
    listeners.forEach(listener => listener());
  };
  const eligible = async (action: NativeAction, signal?: AbortSignal): Promise<boolean> => {
    if (!current() || signal?.aborted || unsupported.has(action.id)) return false;
    const canRun = action.canRun;
    if (!canRun) return true;
    return new Promise<boolean>(resolve => {
      let settled = false;
      const deadline = Date.now() + 8_000;
      let timeout: ReturnType<typeof setTimeout>;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener("abort", cancel);
        actionLifetime.signal.removeEventListener("abort", cancel);
        resolve(value && Date.now() < deadline && current() && !signal?.aborted);
      };
      const cancel = () => settle(false);
      timeout = setTimeout(cancel, 8_000);
      signal?.addEventListener("abort", cancel, {once: true});
      actionLifetime.signal.addEventListener("abort", cancel, {once: true});
      if (signal?.aborted || actionLifetime.signal.aborted) {cancel(); return;}
      try {Promise.resolve(canRun(signal)).then(value => settle(value === true), cancel);} catch {cancel();}
    });
  };
  const prepareForQuit = (signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    let settled = false;
    const deadline = Date.now() + QUIT_PREPARATION_TIMEOUT_MS;
    let timeout: ReturnType<typeof setTimeout>;
    const expired = () => Date.now() >= deadline;
    const inactive = () => !current() || signal?.aborted || actionLifetime.signal.aborted;
    const timeoutError = () => new Error("facebook-quit-preparation-timeout");
    const settle = (result: {saved: true} | {saved: false; error: unknown}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
      actionLifetime.signal.removeEventListener("abort", cancel);
      if (inactive()) reject(new Error("facebook-quit-preparation-cancelled"));
      else if (expired()) reject(timeoutError());
      else if (result.saved) resolve();
      else reject(result.error);
    };
    const cancel = () => settle({saved: false, error: new Error("facebook-quit-preparation-cancelled")});
    const startFreshPreparation = () => {
      if (settled) return;
      if (inactive() || expired()) {settle({saved: false, error: timeoutError()}); return;}
      const preparation = Promise.resolve().then(() => {
        if (settled || inactive() || expired()) throw timeoutError();
        return flushBeforeQuit();
      });
      quitPreparation = preparation;
      const clearPreparation = () => {
        if (quitPreparation === preparation) quitPreparation = undefined;
      };
      preparation.then(clearPreparation, clearPreparation);
      preparation.then(() => settle({saved: true}), error => settle({saved: false, error}));
    };
    timeout = setTimeout(() => settle({saved: false, error: timeoutError()}), QUIT_PREPARATION_TIMEOUT_MS);
    signal?.addEventListener("abort", cancel, {once: true});
    actionLifetime.signal.addEventListener("abort", cancel, {once: true});
    if (inactive()) {cancel(); return;}
    // Keep the actual save alive; a retry must flush newer progress after it settles.
    if (quitPreparation) quitPreparation.then(startFreshPreparation, startFreshPreparation);
    else startFreshPreparation();
  });

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {listeners.add(listener); return () => {listeners.delete(listener);};},
    refresh: async () => {
      if (!current() || snapshot.pendingAction) return;
      const request = ++revision;
      const eligibility = await Promise.all(nativeActions.map(action => eligible(action)));
      if (!current() || request !== revision || snapshot.pendingAction) return;
      nativeActions.forEach((action, index) => {if (eligibility[index]) available.add(action.id); else available.delete(action.id);});
      publish(null);
    },
    run: async (requestedId, signal) => {
      if (signal?.aborted) return "cancelled";
      const action = nativeActions.find(candidate => candidate.id === requestedId);
      if (!current() || snapshot.pendingAction || !action || !available.has(action.id)) return "unavailable";
      const id = action.id;
      ++revision;
      publish(id);
      let unsaved = false;
      try {
        const result = await runFacebookSdkDialog(sdk, async (): Promise<PlatformResult<void>> => {
          if (signal?.aborted || !current()) return {status: "cancelled"};
          const mayRun = await eligible(action, signal);
          if (signal?.aborted || !current()) return {status: "cancelled"};
          if (!mayRun) {
            available.delete(id);
            return {status: "unavailable", message: "facebook-settings-action-ineligible"};
          }
          if (id === "quit") {
            try {await prepareForQuit(signal);} catch (error) {
              if (!current() || signal?.aborted) return {status: "cancelled"};
              unsaved = true;
              report(id, error);
              return {status: "retryable-failure", message: "player-progress-unsaved"};
            }
          }
          if (!current() || signal?.aborted) return {status: "cancelled"};
          try {
            await action.invoke(signal);
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
        if (action.isComplete?.()) available.delete(id);
        publish(null);
      }
    },
    retire: () => {
      retired = true;
      actionLifetime.abort();
      botConsent?.retire();
      ++revision;
      snapshot = {actions: [], pendingAction: null};
      listeners.forEach(listener => listener());
      listeners.clear();
    },
  };
}
