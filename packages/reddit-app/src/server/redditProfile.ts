const REDDIT_AVATAR_HOSTS = new Set(["www.redditstatic.com", "styles.redditmedia.com", "i.redd.it"]);

/** Keeps only HTTPS avatar URLs served by Reddit's own documented delivery domains. */
export function normalizeRedditAvatar(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && REDDIT_AVATAR_HOSTS.has(url.hostname)
      ? url.toString() : null;
  } catch { return null; }
}
