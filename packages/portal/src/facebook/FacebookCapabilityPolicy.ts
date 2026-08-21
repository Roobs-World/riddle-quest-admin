/** Describes facebook age category. */
export type FacebookAgeCategory = "13_plus" | "unknown";

/** Describes facebook optional capability availability. */
export type FacebookOptionalCapabilityAvailability = Readonly<{
  commerce: boolean;
  ads: boolean;
  notifications: boolean;
  nativeSocial: boolean;
}>;

/** Describes facebook capability visibility. */
export type FacebookCapabilityVisibility = FacebookOptionalCapabilityAvailability & Readonly<{
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
  ageCategory: FacebookAgeCategory;
  available: FacebookOptionalCapabilityAvailability;
}): FacebookCapabilityVisibility {
  const ageKnown = ageCategory === "13_plus";
  return {
    corePlay: true,
    commerce: ageKnown && available.commerce,
    ads: ageKnown && available.ads,
    notifications: ageKnown && available.notifications,
    nativeSocial: ageKnown && available.nativeSocial,
  };
}
