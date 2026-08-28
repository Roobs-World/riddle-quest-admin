/** Describes facebook age category. */
export type FacebookAgeCategory = "13_plus" | "unknown";

/** Describes facebook optional capability availability. */
export type FacebookOptionalCapabilityAvailability = Readonly<{
  /** Stores commerce. */
  commerce: boolean;
  /** Stores ads. */
  ads: boolean;
  /** Stores notifications. */
  notifications: boolean;
  /** Stores native social. */
  nativeSocial: boolean;
}>;

/** Describes facebook capability visibility. */
export type FacebookCapabilityVisibility = FacebookOptionalCapabilityAvailability &
  Readonly<{
    /** Stores core play. */
    corePlay: true;
  }>;

/** Accepts only the explicit verified 13+ build value; every other value is unknown. */
export const parseFacebookAgeCategory = (value: string | undefined): FacebookAgeCategory =>
  value === "13_plus" ? "13_plus" : "unknown";

/** Fails optional monetization/social features closed without ever disabling core play. */
export function resolveFacebookCapabilityVisibility({
  ageCategory,
  available,
}: {
  /** Stores age category. */
  ageCategory: FacebookAgeCategory;
  /** Stores available. */
  available: FacebookOptionalCapabilityAvailability;
}): FacebookCapabilityVisibility {
  /** Provides age known behavior. */
  const ageKnown = ageCategory === "13_plus";
  return {
    corePlay: true,
    commerce: ageKnown && available.commerce,
    ads: ageKnown && available.ads,
    notifications: ageKnown && available.notifications,
    nativeSocial: ageKnown && available.nativeSocial,
  };
}
