# Additional release targets — round 11

Date: 21 September 2026

## Selection standard

This round reviewed only first-party publisher and developer pages. A target is recommended only when its current public material establishes a working HTML5 intake route, permits a game already released elsewhere, and gives enough information to define safe advertising, commerce, automation, and manual-review boundaries. Targets already present in the repository's 52-platform catalogue were excluded.

## Recommended addition

### YalGames

**Recommendation:** Add `YalGames` as a low-cost hosted-browser discovery target.

**Submission route and eligibility.** YalGames' official [developer submission page](https://yalgames.com/developers/) accepts games from independent developers, studios, and publishers that own or control the distribution rights. It explicitly accepts HTML5 and WebGL games and asks for a secure playable URL, technology, supported devices, controls, release information, a 512 × 512 icon, and a 1200 × 630 landscape cover. Submission is by email to the address published on that page, with the suggested subject `Game Submission – [Your Game Title]`; its contact form is the fallback. Review includes completeness, browser compatibility, controls, content, safety, and rights. There is no fee, and acceptance or a publication date is not guaranteed.

**Non-exclusivity.** The same first-party FAQ explicitly says a game already published on another platform may be submitted when the developer owns it or has permission to distribute it through another website. This is direct evidence that the normal intake route is compatible with Riddle Quest's multi-platform strategy. Any additional agreement offered during review still needs checking before acceptance.

**Advertising.** The submission requirements allow advertising and external links when they are clearly disclosed, but YalGames publishes no developer ad SDK, placement contract, consent interface, revenue-share terms, or reporting API. Treat the listing as **ad-free/provider-neutral** initially. Do not add an ad dependency or describe it as an ad-supported release unless YalGames supplies written technical and commercial terms.

**IAP and commerce.** No YalGames purchase API, product catalogue, receipt-verification service, or commerce policy is documented on the reviewed first-party developer page. Treat platform IAP as unavailable. Submit a commerce-disabled entry URL; do not expose Stripe or another platform's purchasing system without written approval and a server-verifiable fulfilment contract.

**Automation boundary.** YalGames documents email/contact-form submission and later email-based updates. It publishes no supported submission API, CLI, webhook, or deployment integration. CI can build and test a provider-neutral archive, publish the dedicated HTTPS entry URL, calculate its checksum, validate the listing assets, and generate a submission packet. A person must send the initial submission, answer review questions, accept any agreement, and record the approved listing URL. A scheduled read-only check may verify that an established listing still responds, but must not automate the contact form or email without explicit authorization.

**Dashboard TODOs.** Track the target as `Research complete — manual email submission required`, with these gates:

1. Deploy an ad-free and commerce-disabled provider-neutral entry URL.
2. E2E-test desktop mouse/keyboard and mobile touch play at that URL.
3. Prepare the description, controls, device support, release information, 512 × 512 icon, and 1200 × 630 cover.
4. Disclose any remaining external links or tracking and confirm they are acceptable before submission.
5. Send the submission from the company email and retain its receipt.
6. Review any additional licence or commercial terms for non-exclusivity before accepting them.
7. Record review status, requested changes, publication date, and final YalGames listing URL.

## Holds and exclusions

| Candidate | Decision | Reason |
| --- | --- | --- |
| [Glaze Games](https://glazegames.com/developers) | Hold | Its first-party developer page and [SDK documentation](https://glazegames.com/developers/docs) describe HTML5 intake, local simulation, ads, identity, saves, leaderboards, achievements, purchases, QA, and a planned revenue share. It says developers retain ownership, but accepted partners receive additional commercial/licensing terms during onboarding and the public pages do not expressly establish that the distribution licence is non-exclusive. Obtain and review the binding partner terms before adding it. Its public SDK describes no release-submission API or CLI. |
| [AxoGamer](https://www.axogamer.com/developer) | Hold | The official portal accepts root-`index.html` ZIPs and advertises a 10% share of ad revenue, but its public [Terms of Service](https://www.axogamer.com/terms) are consumer terms and do not define the developer licence, exclusivity, reporting, payout basis, update/removal rights, or IAP policy. Request the publisher agreement before treating it as a release target. |
| [Browser Game Lab](https://webgame.clovecodestudio.com/developers/) | Hold | The first-party page describes a hosted-URL or staged-ZIP review route and a leaderboard bridge, but the operative developer and revenue terms did not expose enough verifiable text to establish non-exclusivity, advertising economics, commerce rules, or durable update rights. |

## Conclusion

Add only `YalGames` in round 11. Its first-party submission FAQ supplies the missing non-exclusive evidence and a current manual intake route. Keep Glaze Games, AxoGamer, and Browser Game Lab outside the canonical release catalogue until their binding publisher terms establish the required rights and monetization boundaries.
