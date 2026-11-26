import type {GameSessionState} from "../../gameplay/session/gameSessionTypes";
import {safeBrowserStorageGet, safeBrowserStorageSet} from "../../settings/browser/playerPreferences";

/** Remounts retain consumed presentations when the browser cannot persist their markers. */
const shownAchievements = new Set<string>();

/** Account recreation and offline targets have independent achievement presentations. */
export function getAchievementFanfareOwnerKey(user: GameSessionState["user"]): string {
  return user
    ? JSON.stringify(["account", user.uid, user.accountGeneration ?? null])
    : JSON.stringify(["offline", "hosted"]);
}

/** Tracks presentation only; markers never grant or change achievement progress. */
export class AchievementFanfareSeen {
  /** Stable account ownership is captured for the mounted receipt. */
  private readonly ownerKey: string;

  /** Creates a view of the current account's consumed achievement presentations. */
  constructor(user: GameSessionState["user"]) {
    this.ownerKey = getAchievementFanfareOwnerKey(user);
  }

  /** Checks persisted and in-page markers shared by every receipt presentation. */
  hasSeen(achievementId: string): boolean {
    const key = this.storageKey(achievementId);
    return shownAchievements.has(key) || safeBrowserStorageGet("local", key) === "seen";
  }

  /** Consumes an achievement when its tab becomes visible, before another receipt can show it. */
  claim(achievementId: string): boolean {
    if (this.hasSeen(achievementId)) return false;
    const key = this.storageKey(achievementId);
    shownAchievements.add(key);
    safeBrowserStorageSet("local", key, "seen");
    return true;
  }

  /** Encodes account and achievement boundaries without delimiter collisions. */
  private storageKey(achievementId: string): string {
    return `riddleQuest:achievementFanfare:${JSON.stringify([this.ownerKey, achievementId])}`;
  }
}
