/** Optional feedback settings supplied by the active target. */
export type HapticFeedbackSnapshot = Readonly<{
  available: boolean;
  enabled: boolean;
}>;

export interface HapticFeedbackCapability {
  getSnapshot(): HapticFeedbackSnapshot;
  subscribe(listener: () => void): () => void;
  setEnabled(enabled: boolean): void;
}
