import {palette} from "../theme";
import {AndroidReferralController} from "@riddle-quest/hosted/androidReferralController";
import type {AndroidReferralBackend} from "@riddle-quest/hosted/androidReferrals";
import {youtubeText, type YouTubeLocale} from "@riddle-quest/solo";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {Share, Text} from "react-native";
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
  /** Retains on back for this operation. */
  onBack(): void;
  /** Retains on google for this operation. */
  onGoogle(): void;
}) {
  return <ReferralJourney key={props.accountUid} {...props} />;
}
/** Retains referral journey for this operation. */
function ReferralJourney({locale, accountUid, backend, token, onBack, onGoogle}: Parameters<typeof HostedReferralScreen>[0]) {
  /** Retains copy for this operation. */
  const copy = referralCopy(locale);
  /** Retains controller for this operation. */
  const controller = useMemo(() => backend ? new AndroidReferralController(backend, url => Share.share({title: copy.title, message: `${copy.title}\n${url}`}), accountUid) : null, [accountUid, backend, copy.title]);
  if (!controller) return <Screen><Heading>{copy.title}</Heading><Notice error>{copy.failed}</Notice><ActionButton label={youtubeText(locale, "back")} onPress={onBack} /></Screen>;
  return <ReadyReferral locale={locale} controller={controller} token={token} onBack={onBack} onGoogle={onGoogle} />;
}
/** Retains ready referral for this operation. */
function ReadyReferral({locale, controller, token, onBack, onGoogle}: {
  /** Stores locale. */
  locale: YouTubeLocale;
  /** Stores controller. */
  controller: AndroidReferralController;
  /** Stores token. */
  token?: string;
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
