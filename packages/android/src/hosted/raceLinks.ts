import {parseLiveRaceInvitationUrl} from "@riddle-quest/hosted/live/invitations";
import {useEffect} from "react";
import {Linking, Share} from "react-native";
import {liveRaceInvitationUrl} from "@riddle-quest/hosted/live/invitations";

/** Delivers cold-launch and foreground invitations through the same strict parser. */
export function useAndroidRaceLinks(onChallenge: (challengeId: string) => void): void {
  useEffect(() => {
    /** Rejects a cold-link promise after its listener lifetime ends. */
    let active = true;
    /** Routes only strictly validated native race invitations. */
    const receive = (url: string | null | undefined) => {
      /** Opaque server handle accepted by the shared URL parser. */
      const challengeId = url ? parseLiveRaceInvitationUrl(url) : null;
      if (active && challengeId) onChallenge(challengeId);
    };
    void Linking.getInitialURL().then(receive, () => undefined);
    /** Foreground link listener removed with this native adapter. */
    const subscription = Linking.addEventListener("url", event => receive(event.url));
    return () => {active = false; subscription.remove();};
  }, [onChallenge]);
}
/** Android's share sheet exposes only the existing private lobby, never another provider's link. */
export async function shareAndroidRaceChallenge(challengeId: string, title: string, message: string): Promise<"success" | "cancelled" | "error"> {
  try {
    /** Android share-sheet result remains distinct from server acceptance. */
    const result = await Share.share({title, message: `${message}\n${liveRaceInvitationUrl(challengeId)}`});
    return result.action === Share.sharedAction ? "success" : "cancelled";
  } catch {return "error";}
}
