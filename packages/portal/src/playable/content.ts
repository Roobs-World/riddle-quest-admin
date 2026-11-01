import {readProtectedContent} from "@qwordly/core/contentProtection";
import {createYouTubeContentSource, type YouTubeContentSource, type YouTubeLocale} from "@qwordly/solo";
import contentDocument from "#youtube-content";
export {YOUTUBE_LOCALES, parseYouTubeContentDocument, resolveYouTubeLocale} from "@qwordly/solo";
/** Content source bound to this Web Target's bundled document and its protected locale packs. */
export const youtubeContentSource: YouTubeContentSource = createYouTubeContentSource(
  contentDocument,
  readProtectedContent,
);
/** Loads only the selected locale from the self-contained artifact. */
export const loadYouTubeContent = (locale: YouTubeLocale) => youtubeContentSource.load(locale);
/** Schema compatibility is available before downloading any answer-bearing pack. */
export const youtubeContentVersion = youtubeContentSource.contentVersion;
/** Provides youtube content release ready behavior. */
export const youtubeContentReleaseReady = youtubeContentSource.releaseReady;
