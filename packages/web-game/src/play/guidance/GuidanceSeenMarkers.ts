import {safeBrowserStorageGet, safeBrowserStorageSet, type BrowserStorageArea} from "../playerPreferences";

/** Tracks completed presentation guidance for one mounted player's view. */
export class GuidanceSeenMarkers {
  /** Presentation completion remains local to this view when its browser marker cannot be saved. */
  private readonly completed = new Set<string>();
  /** Checks the existing browser marker without treating it as authoritative player progress. */
  hasSeen(area: BrowserStorageArea, key: string): boolean {
    return this.completed.has(`${area}:${key}`) || safeBrowserStorageGet(area, key) === "seen";
  }

  /** Persists a completed presentation marker when the browser allows it. */
  markSeen(area: BrowserStorageArea, key: string): void {
    this.completed.add(`${area}:${key}`);
    safeBrowserStorageSet(area, key, "seen");
  }
}
