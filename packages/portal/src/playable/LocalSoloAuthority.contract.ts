import type {LocalSoloAuthority} from "./LocalSoloAuthority";
import type {YouTubeResult, YouTubeRiddle, YouTubeSaveV1} from "./types";
/** Error raised when a local YouTube authority transition is not allowed. */
export class YouTubeAuthorityError extends Error {
  /** Stable error code consumed by the YouTube UI. */
  readonly code: string;
  /** Creates an authority error with a stable UI-facing code. */
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "YouTubeAuthorityError";
  }
}
/** Carries the exact blocked recovery revision so startup can retry it verbatim. */
export class YouTubeAuthorityRestoreSaveError extends Error {
  /** Authority holding the staged recovery save. */
  readonly authority: LocalSoloAuthority;
  /** Creates an error for a recovery save that still needs to be committed. */
  constructor(authority: LocalSoloAuthority, cause: unknown) {
    super("youtube-restore-save-retry-required", {cause});
    this.name = "YouTubeAuthorityRestoreSaveError";
    this.authority = authority;
  }
}
/** Immutable UI projection of the local YouTube authority state. */
export type YouTubeAuthoritySnapshot = Readonly<{
  /** Stores save. */
  save: YouTubeSaveV1;
  /** Stores active riddle. */
  activeRiddle: YouTubeRiddle | null;
  /** Hint letters come from bundled content and are never serialized. */
  displayLetters: readonly string[] | null;
  /** Stores active slot index. */
  activeSlotIndex: number;
  /** Stores paused. */
  paused: boolean;
  /** Stores busy. */
  busy: boolean;
  /** Stores save blocked. */
  saveBlocked: boolean;
  /** Stores pending save revision. */
  pendingSaveRevision: number | null;
  /** Stores recovery notice. */
  recoveryNotice: boolean;
  /** Stores last result. */
  lastResult: YouTubeResult | null;
}>;
