import {createYouTubeContentSource, type YouTubeContentEnvelope, type YouTubeContentSource} from "@qwordly/solo";
import contentDocument from "#solo-content";
/**
 * Content source bound to the reviewed Bundled Content Pack shipped inside the APK.
 *
 * @remarks
 * Metro maps `#solo-content` to the same generated document the YouTube, Netflix,
 * and Yahoo targets bundle, so every self-contained surface plays identical riddles.
 * Packs ship as plain JSON here because the bundle is already inside the signed app.
 */
export const androidContentSource: YouTubeContentSource = createYouTubeContentSource(
  contentDocument as unknown as YouTubeContentEnvelope,
);
