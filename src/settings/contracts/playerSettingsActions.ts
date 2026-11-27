/** A host owns the meaning and translated label of each explicit Settings request. */
export type PlayerSettingsAction = Readonly<{id: string; labelKey: string}>;

export type PlayerSettingsActionOutcome = "success" | "cancelled" | "unavailable" | "error" | "unsaved";

/** A stable snapshot allows Settings to follow a provider operation across page changes. */
export type PlayerSettingsActionsSnapshot = Readonly<{
  actions: readonly PlayerSettingsAction[];
  pendingAction: string | null;
}>;

/** Provider objects and SDK errors stay behind this optional UI boundary. */
export interface PlayerSettingsActionsCapability {
  getSnapshot(): PlayerSettingsActionsSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  run(actionId: string, signal?: AbortSignal): Promise<PlayerSettingsActionOutcome>;
  retire(): void;
}
