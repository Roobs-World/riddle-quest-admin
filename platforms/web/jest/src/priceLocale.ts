/**
 * Returns a locale Intl accepts, or undefined for the runtime default.
 *
 * Browsers can report non-BCP 47 tags such as "en-US@posix"; passing one to
 * Intl.NumberFormat throws and would fail the whole shop catalog.
 */
export const priceLocale = (locale?: string): string | undefined => {
  if (!locale) return undefined;
  try {
    return Intl.getCanonicalLocales(locale)[0];
  } catch {
    return undefined;
  }
};
