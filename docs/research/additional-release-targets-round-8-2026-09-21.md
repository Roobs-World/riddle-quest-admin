# Additional release targets — round 8

Research date: 21 September 2026.

This review starts after the 47 targets recorded in `config/platform-monetization.json`. It examines educational publishers, collaboration and embedded-web marketplaces, installable-web catalogues, regional portals, and TV/browser destinations. A recommendation requires current first-party proof of direct external-developer intake, a standard hosted Vite/HTML5 application or static ZIP, no native or proprietary-runtime conversion, no mandatory exclusivity, and a distinct destination rather than an existing distributor's downstream placement.

## Defensible addition

### Miro Marketplace

**Target name:** `Miro Marketplace`

**Why it qualifies.** Miro accepts public third-party applications into its Marketplace. Web SDK apps run HTML, CSS, and JavaScript inside hosted HTTPS iframes; panels and modals fetch developer-controlled URLs. This preserves the Vite web runtime and needs an isolated integration layer rather than a native package or runtime conversion. Miro's current publishing guide documents a public submission and review process. See [App panels and modals](https://developers.miro.com/docs/app-panels-and-modals), [App manifest](https://developers.miro.com/docs/app-manifest), [Deploy a Miro app](https://developers.miro.com/docs/deploy-a-miro-app), and [Publish your app](https://developers.miro.com/docs/publish-your-app).

Riddle Quest must be positioned as a collaborative team-building word challenge rather than an unrelated game embedded in a work product. The app should launch the game in a modal, create an optional board card for a challenge/result, and let a facilitator share a round with board participants. This adds Miro-specific entry and collaboration behavior while leaving the game engine and assets as a standard hosted Vite application. Miro explicitly expects public apps to add value in a work setting or have a reasonable team-building purpose.

**Non-exclusivity evidence.** Section 2.1 of Miro's current [Developer Terms of Use](https://miro.com/legal/developer-terms-of-use/) says the developer retains all intellectual-property rights in its apps and may remove a public app from the Marketplace. Section 2.2 grants Miro a **non-exclusive** licence. The same terms permit public Marketplace apps and independently operated customer relationships; they impose no exclusive game distribution requirement.

**Ads and IAP.** Section 3.3(s) of the Developer Terms prohibits advertising, including display ads, inside the app or Miro platform. The artifact must contain no Facebook or other advertising SDK. Miro's official [monetization guide](https://developers.miro.com/docs/monetization) says developers may offer paid features or access using their chosen billing system. Miro does not supply a game-IAP catalogue. Launch free-only first; if paid game features are later justified, keep checkout outside the embedded play flow, disclose it clearly, and preserve server-authoritative, idempotent entitlements.

**Release gate.** Marketplace submission is not immediate. Miro currently requires more than 50 monthly active users in each of the previous two consecutive months and more than 10 installs across unique organizations before it will review an app. A shareable installation link must therefore be used for a controlled beta before Marketplace submission. Review can then take 8–12 weeks. These figures come from the official [publishing guide](https://developers.miro.com/docs/publish-your-app).

**Automation boundary.** CI can build and deploy the hosted Miro artifact, enforce SDK isolation, verify HTTPS/CSP behavior, test the entry point and modal with a mocked Web SDK, and monitor the production URL. Miro app creation, developer-team setup, terms acceptance, OAuth/scopes, installation link, beta organization recruitment, review form, and Marketplace publication remain authenticated manual actions. No supported Marketplace publishing API or CLI is documented.

**Dashboard TODOs:**

- Add `Miro Marketplace` as `beta adoption required`, with ads `prohibited` and IAP `external/provider-neutral only after review`.
- Create a Roobs World Limited Miro developer team and application.
- Define the minimum team-building flow: facilitator starts a riddle, participants collaborate, and an optional result card is written to the board.
- Use least-privilege Web SDK scopes and avoid REST OAuth until a server feature actually requires it.
- Deploy a dedicated HTTPS target and test it inside Miro's modal/iframe constraints.
- Publish privacy policy, terms, support, data retention/deletion, and security documentation.
- Generate the public install link and recruit at least 10 unique organizations while measuring two consecutive months above 50 MAU.
- Submit for Marketplace review only after both thresholds are evidenced; record installs, MAU evidence, submission date, Jira review status, approval, listing URL, and live-version checks.

## Holds and exclusions

| Candidate | Decision | First-party evidence and reason |
| --- | --- | --- |
| **Greenhouse Games** | **Hold** | The public creator route appears to support HTML5/WebGL browser games and states that developers are paid from gameplay. However, the operative creator agreement and the answer concerning games already released elsewhere are not publicly accessible. Current non-exclusive rights therefore remain unproven. Do not add it until Greenhouse supplies written current terms explicitly permitting existing multi-platform distribution. |
| **Legends of Learning** | **Hold pending ICA** | The official [developer programme](https://gamedevelopers.legendsoflearning.com/developers/) is active, invites studios globally, creates a Developer Portal account, reviews completed games, publishes accepted titles, and pays based on company revenue, ratings, and play-time trends. Its main [developer page](https://gamedevelopers.legendsoflearning.com/) says developers retain game IP. However, every topic slot requires a separate Independent Contractor Agreement, and that operative ICA is not public. The general site terms' non-exclusive user-content licence does not prove that the game-production ICA is non-exclusive. Riddle Quest would also need curriculum-topic work. Hold until the actual ICA confirms continued external distribution and standard HTML5 delivery. |
| **monday.com Marketplace** | **Exclude for this game** | monday.com's official [submission guide](https://developer.monday.com/apps/docs/submit-your-app) has active public intake, and hosted views/widgets can use web technology. But a listed product must be a valid monday app with a board view, item view, dashboard widget, or integration recipe, and must provide clear workflow value. A standalone riddle game does not meet that product requirement without becoming a materially different workflow application. The publicly indexed materials also do not provide sufficiently direct evidence that the licence governing the developer's app content is non-exclusive. |
| **Canva Apps Marketplace** | **Exclude for this game** | Canva Apps are embedded web applications, but they must extend Canva design workflows and use Canva's Apps SDK. A standalone game is not a design-tool integration. Reworking it into a Canva content/design app would change the product rather than distribute the current HTML5 release. |
| **Zoom App Marketplace** | **Already represented** | The existing target already covers the defensible embedded meeting-web-app route. Do not create separate Zoom Meeting, Team Chat, or Whiteboard target rows unless their release contracts and artifacts become materially distinct. |
| **PWA Directory and Microsoft Store PWA** | **Already represented** | These cover the current installable-web catalogue and store routes. Adjacent PWA listing sites with the same URL-only catalogue model should remain promotional receipts, not maintained release artifacts. |
| **Amazon Fire TV HTML5** | **Do not duplicate** | Amazon documents hosted and packaged HTML5 testing on Fire TV, but the canonical `Amazon Appstore Web App` target already represents the Developer Console product and web runtime. Device eligibility should be a property/test result of that target, not a second release target. |
| **Samsung TV, LG webOS, Roku, VIDAA and Vewd/Xperi TV routes** | **Exclude/hold** | No current first-party route was verified that accepts an unchanged hosted Vite game through open UK developer intake without vendor packaging, signing, proprietary application manifests/runtimes, or a partner-only arrangement. |
| **Educational portals with editorial contact forms** | **Outreach only** | BrainPOP GameUp, Math Playground, PrimaryGames and similar sites may license or link educational games, but current first-party public material did not prove all of direct active intake, unchanged HTML5 delivery, non-exclusive terms, and a maintained developer release process. Contact forms are promotion/licensing leads rather than automatable platform targets. |
| **Regional casual portals** | **Do not count without a creator programme** | Many active portals consume GameDistribution, GamePix, GameMonetize, Playgama, Famobi, SOFTGAMES, GameFlare, or other existing feeds. Others expose only editorial email/contact submission. These are downstream placements or promotion leads unless first-party developer terms prove otherwise. |
| **TikTok, WeChat, Alipay, OPPO, vivo and similar mini-game ecosystems** | **Exclude** | Current game routes require proprietary mini-game packaging/runtime conversion or regional qualification. TikTok ended HTML/H5 Mini Game support in September 2026. |

## Conclusion

Round 8 adds one defensible candidate: **Miro Marketplace**. It is a standards-based hosted-web destination with explicit non-exclusive terms and a direct external-developer review route. Its practical gate is product positioning and adoption: Riddle Quest must deliver a real team-building collaboration flow and prove more than 50 MAU for two months across at least 10 organizations before Marketplace review.

Greenhouse Games and Legends of Learning remain the strongest educational holds. Neither belongs in the canonical target list until the actual creator/contractor agreement proves non-exclusive multi-platform rights.
