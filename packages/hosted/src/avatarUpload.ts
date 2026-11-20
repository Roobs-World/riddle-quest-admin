/** Observable avatar selection and server confirmation for one account visit. */
export type AvatarUploadStatus = "idle" | "picking" | "uploading" | "updated" | "selectionFailed" | "uploadFailed";
/** Device selection is separate from the server-authoritative profile mutation. */
export function createAvatarUploadController(options: {
  /** Returns a prepared data URL, or null when the player cancels. */ pick: () => Promise<string | null>;
  /** Existing hosted service validates and persists the avatar. */ upload: (imageDataUrl: string) => Promise<unknown>;
}) {
  /** Only the current entered account visit may continue an asynchronous selection. */
  let generation = 0;
  /** Construction during rendering never starts work. */
  let active = false;
  /** Stable primitive snapshots work with every rendering target. */
  let status: AvatarUploadStatus = "idle";
  /** Target-owned views observe complete state transitions. */
  const listeners = new Set<() => void>();
  /** Publish state before notifying a potentially reentrant rendering adapter. */
  const setStatus = (next: AvatarUploadStatus) => {status = next; for (const listener of listeners) listener();};
  /** Duplicate taps share one picker and upload lifetime. */
  const select = async (): Promise<void> => {
    if (!active || status === "picking" || status === "uploading") return;
    /** Retirement and account changes invalidate every continuation of this selection. */
    const expected = ++generation;
    /** Optional target callbacks cannot revive a retired visit. */
    const current = () => active && expected === generation;
    setStatus("picking");
    if (!current()) return;
    /** Selection failures and server failures have different translated feedback. */
    let stage: "selection" | "upload" = "selection";
    try {
      /** The device owns file access, image decoding and permission-free selection. */
      const imageDataUrl = await options.pick();
      if (!current()) return;
      if (imageDataUrl === null) {setStatus("idle"); return;}
      stage = "upload";
      setStatus("uploading");
      if (!current()) return;
      await options.upload(imageDataUrl);
      if (current()) setStatus("updated");
    } catch {
      if (current()) setStatus(stage === "selection" ? "selectionFailed" : "uploadFailed");
    }
  };
  return {
    /** Rendering reads a stable status until the next notification. */
    getSnapshot: (): AvatarUploadStatus => status,
    /** Each screen lifetime owns its own subscription. */
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    /** Effect entry also supports a development setup/cleanup/setup cycle. */
    enter() {active = true; generation++; setStatus("idle");},
    /** A selection returned after leaving never uploads to a replacement account. */
    dispose() {active = false; generation++;},
    select,
  };
}
