import {androidInviteStoreUrl} from "../entries/androidEntryInbox";
import type {YouTubeLocale} from "../../../../../src/solo";
import {Share} from "react-native";
import {androidInviteGuidance} from "../i18n/inviteCopy";

/** Uses Android's share sheet with both installed-app and first-install entry paths. */
export function shareAndroidInvite({url, title, message, locale}: {
  /** Exact validated opaque app entry; the store helper rejects arbitrary destinations. */
  url: string;
  /** Existing translated share title. */
  title: string;
  /** Existing translated invitation description. */
  message: string;
  /** Recipient-facing installation guidance follows the sharer's device language. */
  locale: YouTubeLocale;
}) {
  return Share.share({title, message: `${message}\n\n${androidInviteGuidance(locale)}\n${url}\n${androidInviteStoreUrl(url)}`});
}
