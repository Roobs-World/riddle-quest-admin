# Additional release targets — round 10

Research date: 21 September 2026

## Selection standard

This pass reviewed remaining educational publishers, browser catalogs, collaboration surfaces, and hosted-game services beyond the 51 canonical targets. A recommendation requires current first-party evidence of direct external-developer intake, an ordinary hosted HTML5/Vite URL or static ZIP, non-exclusive distribution, no native or proprietary runtime conversion, access without a region-specific entity requirement that excludes a UK company, and a distribution surface distinct from existing networks.

Only one remaining route meets every requirement defensibly.

## Recommended addition

### NoAdsGames

**Target name:** `NoAdsGames`

**Why it qualifies:** NoAdsGames operates a current first-party browser-game publishing flow. It accepts either a public embeddable HTTPS URL or an HTML5 ZIP containing `index.html`, explicitly supports HTML5, JavaScript, WebGL, and Canvas games, performs automated safety checks followed by human review, and creates a public game page after approval. Its submission language applies to any developer and publishes no country restriction or local-entity gate; the route does not require payout onboarding because submission and publication are free.

**Non-exclusivity evidence:** The official publishing page repeatedly states that developers retain ownership of their games. Hosted builds remain at the developer's URL, while ZIP builds are stored for platform hosting. The published rules request only confirmation that the submitter owns or may distribute the game; they contain no exclusivity requirement. Confirm that no additional license displayed during submission changes those terms before sending the build.

**Ads and IAP:** NoAdsGames prohibits all advertising in the submitted edition, including banners, popups, interstitials, rewarded videos, ad-network scripts, and deceptive promotional redirects. The artifact must therefore remain completely ad-free, consistent with the repository rule that rewarded/interstitial ads are Facebook-only. The platform explicitly permits optional microtransactions, cosmetic purchases, subscriptions, donations, and other transparent monetization when lawful, secure, disclosed, and never required to access gameplay advertised as free. Retain the existing server-authoritative Stripe verification and idempotent grant flow only after confirming embedded checkout works inside the sandbox; otherwise open checkout in an allowed top-level browser flow or ship purchases disabled.

**Technical constraints:**

- Hosted URLs must use HTTPS, allow embedding by `https://noadsgames.org`, and point directly to the playable game rather than a landing page.
- ZIP submissions are limited to 50 MB, 2,000 files, and 200 MB unpacked, with no executables, server code, nested/encrypted archives, or unsafe paths.
- The player restricts popups, redirects, forms, downloads, camera, microphone, location, and clipboard access.
- External calls, access requirements, and all monetization must be disclosed.
- Hosted updates occur at the submitted URL; ZIP updates require a replacement submission and another review.

**Automation boundary:** NoAdsGames publishes a direct submission API. CI may POST JSON for a hosted build or multipart form data for a ZIP and cover, then store the returned HTTP 202 submission ID. The API limits successful submissions to five per IP per hour and publication always requires human review. Automation must run the isolated build and embedding audits first, submit only release-tagged artifacts, record the exact request without secrets or personal data, and never interpret acceptance into the review queue as publication. Polling or scraping review state is not documented and should remain manual unless the platform adds a status endpoint.

**Dashboard TODOs:**

- Build a provider-neutral, ad-free artifact with no Facebook, Reddit, YouTube, Jest, Firebase browser, analytics, or advertising SDK leakage.
- Test the hosted URL inside a sandboxed cross-origin iframe with popups, forms, downloads, and sensitive permissions disabled.
- Verify the build is within ZIP/file limits or choose the hosted-URL route.
- Decide whether Stripe checkout can be supported under the player restrictions; record IAP as disabled until the complete purchase and server-verification path passes testing.
- Prepare title, developer name, contact email, description of at least 40 characters, controls, category, cover image, and an exact monetization disclosure.
- Add a release-only CI job for the documented API, storing the submission ID, build checksum, submitted URL/version, and timestamp in dashboard data.
- Record review outcome, remediation requests, public game URL, approval date, update history, and last live/embedding verification.

**Official sources:**

- [NoAdsGames publishing page, rules, API, and FAQ](https://noadsgames.org/en/publish-game)
- [NoAdsGames browser catalog](https://noadsgames.org/en)

## Exclusions and holds

| Candidate | Decision | Reason |
| --- | --- | --- |
| AxoGamer | Hold | It has active HTML5 ZIP intake, manual review, UK operations, hosting, and a stated 10% ad-revenue share. Its public general terms call user-content licenses non-exclusive but do not clearly state the operative license for submitted game builds. Obtain developer-specific terms before adding it. |
| Browser Game Lab | Hold | It accepts hosted URLs/ZIPs and documents a simple iframe `postMessage` bridge, but the accessible first-party material does not establish a non-exclusive game license or enough durable operating/commercial history for a canonical target. |
| EducationalGamez | Hold | It documents HTML5 ZIP upload, a mandatory score/progress API, review, and premium revenue share, but does not publish the operative developer license or non-exclusivity terms. The mandatory API also needs security review before any adapter is considered. |
| DeskLink Games | Hold | It advertises direct hosted-URL submission and HTML5 support, but no accessible developer license establishes ownership, non-exclusivity, monetization, or long-term update rights. |
| YalGames, Gamingro, IPlayArena, Paizix, TapCraftBox, and similar small catalogs | Outreach only | They advertise HTML5 intake but lack sufficient first-party licensing, stable automation, demonstrated reach, or commercial detail to justify maintained canonical artifacts. Track them as promotional listings. |
| Okona | Exclude for this product | It has clear HTML5 hosting and developer ownership terms, but requires a phone-controller multiplayer design and SDK. That would create a different game experience rather than distribute the current release. |
| Greenhouse Games | Already represented | It is already among the 51 canonical targets and must not be duplicated. Its artifact must remain free of ads, microtransactions, trackers, and paid upgrades under its published rules. |
| SlowDen, OzoGames, PWA Directory | Already represented | These browser catalog targets are already canonical. Adjacent sister directories or mirrored listings must not inflate the platform count. |
| Miro Marketplace and Zoom App Marketplace | Already represented | These collaboration surfaces are already canonical. Slack, Teams, Google Chat, Notion, and similar app directories do not provide an equivalent first-party route for publishing this playable hosted game without a different app/bot model. |
| Canva Apps | Exclude | A Canva app is a platform-specific editor integration with SDK and design-surface requirements, not a general hosted-game destination. Adapting Riddle Quest would create a different product. |
| Smart-TV manufacturer stores | Exclude | Samsung, LG, VIDAA, Panasonic, and Roku require vendor packaging, signing, proprietary APIs/runtimes, certification, or partner intake rather than accepting the hosted Vite game directly. |
| Engine-specific communities | Exclude | Construct Arcade, gd.games, and Opera GX.games require their respective authoring/export ecosystems; this repository is a standard React/Vite project. |
| Distributor downstream portals | Do not count | A placement supplied through GameDistribution, GameFlare, GamePix, GameMonetize, Playgama, Famobi, SOFTGAMES, or another canonical network is not a separate developer submission or release pipeline. |

## Conclusion

Add `NoAdsGames` as the only defensible round-10 release target. After it, the credible market is exhausted under the standard hosted-HTML5, non-exclusive, UK-accessible, non-duplicative constraints. Future candidates should stay in outreach or hold status until their first-party developer agreements explicitly establish game ownership, non-exclusive distribution, and a durable update path.
