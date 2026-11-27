import type {FacebookClientConfiguration} from "./facebookCallableResponses";

export type FacebookAdFormat = "interstitial" | "rewarded";
type Configuration = Pick<FacebookClientConfiguration, "interstitialsEnabled" | "rewardedAdsEnabled" | "removeInterstitialAds">;

/** Keeps ad eligibility fresh independently of whether Facebook checkout is enabled. */
export function createFacebookAdConfiguration({initial, read, isActive, onChange, reportFailure}: {
  initial: Configuration;
  read: () => Promise<Configuration>;
  isActive: () => boolean;
  onChange: () => void;
  reportFailure: (error: unknown) => void;
}) {
  let current: Configuration | undefined = initial;
  let pending: Promise<void> | undefined;
  const publish = (next: Configuration | undefined): void => {
    if (!isActive()) return;
    const changed = current?.interstitialsEnabled !== next?.interstitialsEnabled ||
      current?.rewardedAdsEnabled !== next?.rewardedAdsEnabled ||
      current?.removeInterstitialAds !== next?.removeInterstitialAds;
    current = next;
    if (changed) onChange();
  };
  const allows = (format: FacebookAdFormat): boolean => isActive() && (format === "rewarded"
    ? current?.rewardedAdsEnabled === true
    : current?.interstitialsEnabled === true && current.removeInterstitialAds === false);
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
