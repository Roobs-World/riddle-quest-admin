# Additional release targets — round 9

Research date: 21 September 2026. This review starts beyond the 48 canonical targets in `config/platform-monetization.json` and uses current first-party platform or developer sources only. A recommendation requires active direct intake, a standard hosted HTML5/Vite URL or ZIP, no native wrapper or proprietary runtime conversion, evidence that distribution is non-exclusive, and a destination distinct from the downstream network of an existing distributor.

Three additions meet the threshold: **Greenhouse Games**, **OzoGames**, and **SlowDen**. Greenhouse is the strongest commercial opportunity if Riddle Quest's word and deduction mechanics can be presented with a clear learning objective. OzoGames is a conventional browser portal with explicit non-exclusive publishing. SlowDen is a smaller discovery catalog with a direct, ownership-preserving hosted-link route and no monetization integration.

## Candidate matrix

| Target | Official intake and artifact | Non-exclusivity evidence | Ads | IAP / commerce | Recommendation |
|---|---|---|---|---|---|
| **Greenhouse Games** | The official [creator page](https://greenhousegames.io/devs) accepts educational WebGL/HTML5 games through a developer dashboard. Its [developer documentation](https://docs.ghg.gg/getting-started) requires a standalone ZIP, `index.html` at the root, locally bundled assets, and compatibility with its CSP. The current limit is 1 GB and 10,000 files. The platform performs validation, security scanning, staging, and human educational/content review. | Greenhouse's first-party creator FAQ explicitly answers that a game already available on other platforms may be listed, provided the developer owns the rights and has no conflicting exclusivity agreement. This directly establishes a non-exclusive route. | Third-party ads, banner ads, tracking payloads, loot boxes, and monetization manipulation are prohibited. The candidate artifact must contain no ad SDK or analytics beacon. Creator compensation comes from the subscription pool based on active gameplay time. | Microtransactions, paid upgrades, sneaky paywalls, and pay-to-win mechanics are prohibited. All IAP UI and purchase calls must be removed or disabled in this artifact; gameplay progression must remain complete without payment. | **Add as a high-priority educational candidate.** Before submission, document how riddles teach vocabulary, semantic reasoning, pattern recognition, and deduction; then build a fully offline/CSP-safe artifact. |
| **OzoGames** | OzoGames' official [developer page](https://ozogames.com/for-developers/) invites independent developers and studios to submit an HTML5/WebGL game by playable URL, demo link, or hosted ZIP to `contact@ozogames.com`. Its editorial team reviews browser compatibility, performance, and family safety, then hosts and publishes accepted games with developer attribution. | The developer page expressly says OzoGames operates a **non-exclusive publishing model** and that developers retain 100% ownership and copyright of the game, brand, and IP. | The page offers flexible advertising integration and possible revenue sharing, but it does not publish an ad SDK, placement API, payout formula, consent contract, or reporting specification. Submit an ad-free provider-neutral candidate and treat ads as contract-gated until written technical and commercial terms arrive. | No first-party IAP system or receipt-verification API is documented. Disable commerce in the submission artifact. Do not use Stripe or another platform's purchase system unless OzoGames gives written permission and a server-verifiable fulfillment contract. | **Add as a direct portal candidate.** Send the hosted demo and listing package, request the publisher agreement and monetization terms, and integrate nothing until those terms are reviewed. |
| **SlowDen** | SlowDen's official [submission page](https://slowden.com/submit/) accepts any finished browser-playable HTML5/web game through a form. The developer keeps hosting the game on its own HTTPS URL, supplies a title, description, cover image, technology and contact details, and confirms ownership. The listing links players to that browser build; no download or wrapper is required. | SlowDen states that the game stays owned by the developer, can be removed on request, has no submission fee or obligation, and may already be hosted on itch.io, Netlify, GitHub Pages, or the developer's site. This is an explicit non-exclusive discovery listing rather than a distribution licence. | SlowDen documents no developer ad SDK or revenue-share programme. Preserve the existing hosted site's own lawful monetization only if the submission form/owner approves it; the safest initial listing is the ad-free provider-neutral URL. Do not count SlowDen as an ad-supported release. | SlowDen supplies no commerce API and does not process purchases. Any existing web checkout remains an external website feature and must not be described as SlowDen IAP. Prefer a commerce-disabled landing path for the submitted listing unless written approval confirms otherwise. | **Add as a low-cost discovery target.** Submit the canonical hosted browser URL and record the resulting public listing URL. It needs no new game artifact unless the current site cannot offer a clean platform-neutral entry point. |

## Integration and release boundaries

- Greenhouse requires its own isolated, self-contained artifact. Its CSP blocks off-origin requests, and its child-focused rules prohibit ads, IAP, tracking and outbound promotional links.
- OzoGames should initially receive a provider-neutral review build. Any future advertising API belongs behind an OzoGames-specific adapter and must remain absent from the six core target artifacts.
- SlowDen is a discovery listing for a developer-hosted URL. Record it as a directory/referral destination so it does not inflate hosted-build or distributor-placement counts.
- Publication evidence must be an authenticated approval, a live platform page, or a listing URL. An email sent, form submitted, or ZIP generated is not a published release.
- None of these routes changes the server-authoritative purchase rule or the repository restriction on SDK leakage between targets.

## Automation boundary

### Greenhouse Games

Automation can create the isolated ZIP, run CSP/offline checks, scan for storage/network/ads/IAP code, generate educational listing copy and images, calculate checksums, and prepare dashboard evidence. A human must create and approve the creator account, accept the creator agreement, provide payout/tax details, make the educational-positioning decision, upload through the dashboard, respond to reviewer feedback, and approve publication. No public release API was found.

### OzoGames

Automation can prepare the hosted demo, optional ZIP, screenshots, rights statement, technical report, pitch email draft, and dashboard record. A human must send the submission, review and accept the publisher agreement, decide on ad revenue sharing, provide payment/tax details, and approve any SDK or source disclosure. Intake is by email rather than a documented API.

### SlowDen

Automation can validate the public URL, prepare the form fields and cover image URL, monitor the resulting listing, and update the dashboard when the page is live. The first form submission and confirmation of its terms remain a human action. SlowDen exposes no documented submission API.

## Dashboard TODOs

1. Add **Greenhouse Games** as `Research complete — educational fit and creator agreement required`.
2. Add a Greenhouse checklist covering the learning-objective statement, CSP-safe offline ZIP, ads/IAP/analytics removal, creator-account onboarding, tax/payout setup, submission, review feedback, and live listing evidence.
3. Add **OzoGames** as `Research complete — email submission and contract review required`.
4. Add an OzoGames checklist covering the hosted demo, ZIP, screenshots, rights statement, explicit request for ad/revenue terms, contract review, submission receipt, and live URL.
5. Add **SlowDen** as `Research complete — hosted-link form submission required` and classify it as a discovery directory rather than a separately hosted artifact.
6. Show Greenhouse ads and IAP as **prohibited**, OzoGames ads/IAP as **contract-gated**, and SlowDen platform ads/IAP as **unavailable**.

## Exclusions

- **Legends of Learning:** first-party pages show active worldwide developer intake, retention of game IP, revenue based on playtime, and a developer portal. The operative route begins by selecting an available curriculum topic, signing an Independent Contractor Agreement, submitting a new game design document, and delivering the approved educational game within ten weeks. The public pages do not publish the ICA or establish a right to distribute that commissioned build elsewhere. This is a bespoke development contract rather than a defensible release route for the current Riddle Quest build. Revisit only after obtaining an ICA that expressly permits non-exclusive reuse and confirming an available vocabulary/word-reasoning topic.
- **EducationalGamez.com:** its public documentation describes developer accounts, ZIP upload and an educational scoring API, but no current first-party developer terms or non-exclusive licence could be verified. The site therefore fails the licensing-evidence requirement.
- **Browser Game Lab:** it has an active hosted-URL/ZIP intake and standard iframe bridge, but the available search evidence does not establish meaningful audience, established operations, or commercial benefit sufficient to treat it as a credible release destination in this round.
- **AxoGamer:** it accepts standard HTML5 ZIPs and advertises revenue share, but its general terms address user-generated ratings/reviews rather than the developer game licence. Non-exclusive game-distribution terms and payout details could not be verified.
- **MEEGames:** it welcomes HTML5 publishing enquiries and says it respects developer IP, but does not publish a direct submission workflow, non-exclusive licence, or monetization contract.
- **TapCraftBox:** it accepts HTML5 submissions by email but publishes no developer licence, ownership retention, removal right, or monetization terms.
- **PWA directories:** `PWA Directory` is already canonical. Its own current comparison identifies `pwastore.io` and `store.app`, but no sufficiently complete first-party operative terms and direct submission evidence were verified for adding either as a distinct target in this round.
- **Meta Horizon Store PWA:** Meta's current path uses Bubblewrap to create, sign and submit an Android/Trusted Web Activity package. It fails the no-native/no-TWA requirement even though the underlying application is hosted web content.
- **Google Play / ChromeOS PWA:** the official route similarly converts the PWA into an Android App Bundle with Bubblewrap and therefore falls outside the repository scope.
