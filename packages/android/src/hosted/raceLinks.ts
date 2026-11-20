import type {YouTubeLocale} from "@riddle-quest/solo";
import {Share} from "react-native";
import {liveRaceInvitationUrl} from "@riddle-quest/hosted/live/invitations";
import {shareAndroidInvite} from "./inviteShare";

/** Android's share sheet exposes only the existing private lobby, never another provider's link. */
export async function shareAndroidRaceChallenge(challengeId: string, title: string, message: string, locale: YouTubeLocale): Promise<"success" | "cancelled" | "error"> {
  try {
    /** Android share-sheet result remains distinct from server acceptance. */
    const result = await shareAndroidInvite({title, message, url: liveRaceInvitationUrl(challengeId), locale});
    return result.action === Share.sharedAction ? "success" : "cancelled";
  } catch {return "error";}
}
