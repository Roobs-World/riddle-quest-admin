# Additional release targets — round 12

Research date: 21 September 2026. This review starts after the 53 targets in `config/platform-monetization.json` and checks the earlier research rounds before counting a destination. Sources are current first-party publisher pages, policies, and developer documentation.

## Selection standard

A target is recommended only when its own public material establishes all of the following: direct intake of an HTML5 game or developer-hosted web build; distribution compatible with publication elsewhere; a route accessible to a UK developer; a repeatable submission and update path; and a destination distinct from an existing distributor's downstream mirrors. A submission form alone is insufficient when ownership, licence, update, or commercial terms remain unclear.

## Recommended addition

### Rando.gg

**Recommendation:** Add `Rando.gg` as a provider-neutral, developer-hosted discovery target.

**HTML5 intake and destination.** Rando.gg's official [game-submission page](https://rando.gg/submit) accepts an embeddable URL for an HTML5 game of any engine or genre. It fetches the submitted URL, checks framing headers, and opens the game in a real browser before human review. An accepted game receives its own `rando.gg/play/...` page and enters the site's random-game catalogue. This is a distinct curated destination rather than a downstream placement supplied by one of the repository's existing distribution networks.

**Non-exclusivity and ownership terms.** The submission page explicitly states that submission is free, there is no exclusivity, the developer continues to host the game, and Rando.gg does not copy the game files. Its first-party [copyright policy](https://rando.gg/copyright) confirms that games remain third-party works, only the title, icon, and link are stored, and an owner may request removal. These terms support publication alongside every existing Riddle Quest release.

**Stable updates and UK route.** Updates require no platform upload because Rando.gg embeds the developer-controlled URL; the submission page states that changes at that URL go live immediately. Removal is available by request. The public HTTPS form exposes no country restriction or native-store requirement and is directly usable from the UK. Publication still depends on a human review that the page says normally takes a few days.

**Ads and privacy.** Rando.gg provides no advertising SDK, inventory, revenue share, or consent interface. Its [privacy policy](https://rando.gg/privacy) says third-party games can technically load their own ads and analytics, but the platform screens games and removes ones it finds serving ads. The Rando.gg target should therefore be ad-free and tracker-free. Facebook rewarded/interstitial code must remain absent, as it must from every non-Facebook artifact.

**IAP and commerce.** No Rando.gg product catalogue, checkout API, receipt-verification service, or commerce policy is documented. Ship a commerce-disabled entry URL and record platform IAP as unavailable. Do not expose Stripe or another platform's payment implementation unless Rando.gg supplies written approval and a server-verifiable fulfilment contract.

**Automation boundary.** CI can build the provider-neutral hosted target, verify that its exact URL returns successfully, test the game in an iframe whose origin is different from the game origin, assert that CSP `frame-ancestors` permits `https://rando.gg`, scan for forbidden provider SDKs, and continually probe the public listing after acceptance. The official route is a browser form followed by human review; no authenticated submission or status API is documented. Form submission and publication status must remain manual, and an accepted form response must not be recorded as a live release.

**Dashboard TODOs:**

1. Deploy a dedicated, ad-free and commerce-disabled HTTPS entry URL.
2. Run the provider-neutral artifact audit and a cross-origin iframe E2E test against the production URL.
3. Confirm the response headers allow framing by `https://rando.gg` while retaining the narrowest viable CSP.
4. Prepare the game name, direct embeddable URL, studio credit, contact email, icon, privacy URL, and a short review note.
5. Submit the official form manually and save a dated submission receipt.
6. Record the public `rando.gg/play/...` URL only after human acceptance, then enable a scheduled availability and iframe-smoke check.

### PWAStore.io

**Recommendation:** Add `PWAStore.io` as a second PWA discovery destination, distinct from the existing `PWA Directory` listing.

**Intake and first-party terms.** The official [submission form](https://www.pwastore.io/submit) accepts the URL of a developer-hosted PWA without requiring an account. The platform's [Terms of Service](https://www.pwastore.io/terms) define it as a free discovery service open to community submissions. Submitters must own or have permission to submit the PWA, grant only a licence to display and promote it, and retain ownership of the application. The listing therefore does not prevent Riddle Quest remaining available on every other target.

**Technical and UK route.** The official [PWA guidelines](https://www.pwastore.io/guidelines) require HTTPS, a valid manifest, a service worker with a fetch handler, responsive desktop/mobile behavior, offline or degraded-network operation, cross-browser compatibility, and WCAG 2.1 AA accessibility. The public URL-only submission route requires no local entity, platform package, or native build, and its terms state no territorial restriction, making it accessible to a UK developer. This route points users to the independently hosted PWA and is distinct from PWA Directory's own catalogue.

**Ads and IAP.** PWAStore.io documents no platform ad SDK, inventory, commerce catalogue, checkout, or receipt-verification API. Record platform ads and platform IAP as unavailable. The ordinary hosted PWA monetization policy may remain only if it complies with the directory review and terms; the safer initial submission is the existing provider-neutral, commerce-disabled PWA URL. PWAStore code does not belong in the game artifact.

**Automation boundary.** CI can validate HTTPS, manifest fields and icons, service-worker registration and fetch handling, installability, offline startup, responsive layouts, supported browsers, accessibility, and the final listing URL. The documented intake is a public one-field form, and the terms prohibit automated tools that scrape or overload the service. No submission/status API or documented metadata-update endpoint exists. Keep submission, approval confirmation, metadata correction, and removal requests manual; update the game itself through the stable developer-hosted URL.

**Dashboard TODOs:**

1. Verify the production PWA passes manifest, service-worker, offline, responsive, cross-browser, performance, and accessibility checks.
2. Decide whether to expose the normal hosted monetization or use a commerce-disabled start URL; record the decision before submission.
3. Submit the production PWA URL through the official form and save a dated receipt.
4. Record the public PWAStore listing only after it appears in the catalogue.
5. Ask PWAStore support to confirm the metadata correction and removal process, then record that answer.
6. Schedule a read-only listing and production-URL availability check.

## Holds and exclusions

| Candidate | Decision | First-party evidence and reason |
| --- | --- | --- |
| [Funox](https://dev.funox.com/) | **Hold pending publisher agreement** | The developer site expressly accepts HTML5/WebGL builds, permits publication elsewhere, documents dashboard uploads and rapid updates, and offers ads and Xsolla IAP through its SDK. Its [launch documentation](https://docs.funox.com/launch-process/) defines a credible two-stage review route. However, the official [developer FAQ](https://docs.funox.com/faq/) says every accepted game must sign a separate publishing agreement covering ads and IAP, while that agreement is not publicly reviewable. The public [site terms](https://funox.com/en/terms-conditions) describe consumer use, omit developer licensing and payouts, and include a notice that the document is a template needing legal review. Obtain and review the actual publisher agreement before adding a target or integrating its SDK. |
| [TapCraftBox](https://tapcraftbox.com/page/submit-game) | **Hold** | Its own submission page invites HTML5 games by email and requires distribution rights, but it does not publish developer licence terms, an update/removal process, advertising revenue terms, or an IAP policy. An email intake without those terms does not meet the release standard. |
| [Playvora](https://playvoragames.com/about/) | **Hold** | Its first-party page says it hosts static, ad-free HTML5 games and invites developers to contact it for guidelines. The guidelines, licence, non-exclusivity statement, submission mechanics, and update route are not public, so the destination remains an outreach lead. |
| Store.app and FindPWA | **Hold** | No complete first-party submission and licensing route was verified. Do not create more directory targets from third-party comparison pages or catalogue visibility alone. |
| Funox partner-network placements | **Do not count separately** | If Funox later qualifies, its own portal is one target. Sites reached through its partner distribution are downstream mirrors and do not create separate release artifacts or dashboard targets. |

## Conclusion

`Rando.gg` and `PWAStore.io` meet every stated condition using public first-party evidence. Both use developer-hosted URLs and need no provider SDK: Rando.gg embeds an ad-free game URL, while PWAStore.io lists an installable PWA. Funox is technically promising and has the clearest future ads/IAP opportunity, but its unpublished mandatory publisher agreement is a material gate; adding it before that agreement is reviewed would overstate legal and commercial readiness.
