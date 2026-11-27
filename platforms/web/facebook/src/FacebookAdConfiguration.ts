import type {FacebookClientConfiguration} from "./facebookCallableResponses";

export type FacebookAdFormat = "interstitial" | "rewarded";
type Configuration = Pick<FacebookClientConfiguration, "interstitialsEnabled" | "rewardedAdsEnabled" | "removeInterstitialAds">;
type VerifiedConfiguration = Configuration & {hasActiveSubscription: boolean};

/** Keeps ad eligibility fresh independently of whether Facebook checkout is enabled. */
export function createFacebookAdConfiguration({initial, read, isActive, onChange, reportFailure}: {
  initial: Configuration;
  read: () => Promise<VerifiedConfiguration>;
  isActive: () => boolean;
  onChange: () => void;
  reportFailure: (error: unknown) => void;
}) {
  let current: VerifiedConfiguration | undefined;
  let lastKnown: Configuration & {hasActiveSubscription?: boolean} = initial;
  let pending: Promise<void> | undefined;
  const formatEnabled = (configuration: Configuration, format: FacebookAdFormat): boolean => format === "rewarded"
    ? configuration.rewardedAdsEnabled === true
    : configuration.interstitialsEnabled === true && configuration.removeInterstitialAds === false;
  const allows = (format: FacebookAdFormat): boolean => isActive() && current?.hasActiveSubscription === false && formatEnabled(current, format);
  const canOffer = (format: FacebookAdFormat): boolean => isActive() && lastKnown.hasActiveSubscription !== true && formatEnabled(lastKnown, format);
  const visiblePolicy = () => [allows("interstitial"), allows("rewarded"), canOffer("interstitial"), canOffer("rewarded")];
  const publish = (next: VerifiedConfiguration | undefined): void => {
    if (!isActive()) return;
    const previous = visiblePolicy();
    current = next;
    if (next) lastKnown = next;
    if (visiblePolicy().some((value, index) => value !== previous[index])) onChange();
  };
  const refresh = (): Promise<void> => {
    if (!isActive()) return Promise.resolve();
    if (pending) return pending;
    pending = (async () => {
      try {
        publish(await read());
      } catch (error) {
        publish(undefined);
        if (isActive()) reportFailure(error);
      }
    })().finally(() => {pending = undefined;});
    return pending;
  };
  return {
    allows,
    canOffer,
    refresh,
    /** Refresh again immediately before display so a subscription acquired during load wins. */
    async refreshEligibility(format: FacebookAdFormat): Promise<boolean> {
      // A resume read started before this checkpoint cannot authorize a later impression.
      if (pending) await pending;
      await refresh();
      return allows(format);
    },
  };
}
