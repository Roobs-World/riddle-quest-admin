/** Explicit player requests that a host can offer from Settings. */
export type PlayerSettingsAction = "create-shortcut" | "follow-community" | "join-community" | "privacy-policy" | "terms-of-use" | "quit";

export type PlayerSettingsActionOutcome = "success" | "cancelled" | "unavailable" | "error" | "unsaved";

/** A stable snapshot allows Settings to follow a provider operation across page changes. */
export type PlayerSettingsActionsSnapshot = Readonly<{
  actions: readonly PlayerSettingsAction[];
  pendingAction: PlayerSettingsAction | null;
}>;

/** Provider objects and SDK errors stay behind this optional UI boundary. */
export interface PlayerSettingsActionsCapability {
  getSnapshot(): PlayerSettingsActionsSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  run(action: PlayerSettingsAction, signal?: AbortSignal): Promise<PlayerSettingsActionOutcome>;
  retire(): void;
}
