import {palette} from "../theme";
import {AndroidReferralController} from "@riddle-quest/hosted/androidReferralController";
import type {AndroidReferralBackend} from "@riddle-quest/hosted/androidReferrals";
import {youtubeText, type YouTubeLocale} from "@riddle-quest/solo";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {Text} from "react-native";
import {shareAndroidInvite} from "../hosted/inviteShare";
import {ActionButton, Heading, Notice, Panel, Screen} from "../components/Primitives";
import {referralCopy} from "../i18n/referralCopy";
/** Account-bound native invitation view with explicit acceptance. */
export function HostedReferralScreen(props: {
  /** Stores locale. */
  locale: YouTubeLocale;
  /** Stores account uid. */
  accountUid: string;
  /** Stores backend. */
  backend?: AndroidReferralBackend;
  /** Stores token. */
  token?: string;
  /** Clears only this incoming preview after authoritative acceptance or ineligibility. */
  onEntryHandled?: () => void;
  /** Retains on back for this operation. */
  onBack(): void;
  /** Retains on google for this operation. */
  onGoogle(): void;
}) {
  return <ReferralJourney key={props.accountUid} {...props} />;
}
/** Retains referral journey for this operation. */
function ReferralJourney({locale, accountUid, backend, token, onBack, onGoogle, onEntryHandled}: Parameters<typeof HostedReferralScreen>[0]) {
  /** Retains copy for this operation. */
  const copy = referralCopy(locale);
  /** Retains controller for this operation. */
  const controller = useMemo(() => backend ? new AndroidReferralController(backend, url => shareAndroidInvite({title: copy.title, message: copy.title, url, locale}), accountUid) : null, [accountUid, backend, copy.title, locale]);
  if (!controller) return <Screen><Heading>{copy.title}</Heading><Notice error>{copy.failed}</Notice><ActionButton label={youtubeText(locale, "back")} onPress={onBack} /></Screen>;
  return <ReadyReferral locale={locale} controller={controller} token={token} onBack={onBack} onGoogle={onGoogle} onEntryHandled={onEntryHandled} />;
}
/** Retains ready referral for this operation. */
function ReadyReferral({locale, controller, token, onBack, onGoogle, onEntryHandled}: {
  /** Stores locale. */
  locale: YouTubeLocale;
  /** Stores controller. */
  controller: AndroidReferralController;
  /** Stores token. */
  token?: string;
  /** Clears only the current invitation after a confirmed terminal decision. */
  onEntryHandled?: () => void;
  /** Retains on back for this operation. */
  onBack(): void;
  /** Retains on google for this operation. */
  onGoogle(): void;
}) {
  /** Retains copy for this operation. */
  const copy = referralCopy(locale);
  /** Retains state for this operation. */
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {void controller.start(); return () => controller.dispose();}, [controller]);
  /** Retains status for this operation. */
  const status = state.status;
  useEffect(() => {
    if (token && status?.kind === "ready" && (status.bound || status.settled || !status.canBind)) onEntryHandled?.();
  }, [token, status, onEntryHandled]);
  return <Screen testID="screen-referrals"><Heading>{copy.title}</Heading>
    <Text style={{color: palette.text, fontSize: 16, lineHeight: 24}}>{copy.details.replace("{coins}", String(status?.kind === "ready" ? status.rewardCoins : 100))}</Text>
    {state.failed && <Notice error testID="referral-failed">{copy.failed}</Notice>}
    {!status && <Notice>{youtubeText(locale, "loading")}</Notice>}
    {status?.kind === "google-required" && <Panel><Text style={{color: palette.text, fontSize: 16, lineHeight: 24}}>{copy.googleRequired}</Text><ActionButton label={copy.google} onPress={onGoogle} testID="referral-google" /></Panel>}
    {status?.kind === "ready" && <Panel>
      {status.settled ? <Notice testID="referral-settled">{copy.settled}</Notice> : status.bound ? <Notice testID="referral-bound">{copy.bound}</Notice> : null}
      {token && !status.bound && !status.settled && (status.canBind ? <ActionButton label={copy.accept} disabled={state.busy} onPress={() => {void controller.accept(token);}} testID="referral-accept" /> : <Notice>{copy.ineligible}</Notice>)}
      <ActionButton tone="primary" label={copy.share} disabled={state.busy} onPress={() => {void controller.invite();}} testID="referral-share" />
    </Panel>}
    {state.failed && <ActionButton label={youtubeText(locale, "retry")} disabled={state.busy} onPress={() => {void controller.refresh();}} testID="referral-retry" />}
    <ActionButton label={youtubeText(locale, "back")} onPress={onBack} testID="referral-back" />
  </Screen>;
}
