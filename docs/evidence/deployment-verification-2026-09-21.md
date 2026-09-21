# Deployment verification — 21 September 2026

## Deployed services

- Firebase project `riddle-quest-ec2b2`: all 60 Functions deployed and reported ACTIVE, including `skipRaceRiddle`. Firestore rules/indexes, Storage rules and Realtime Database rules deployed successfully. Secret Manager bindings were retained; deployment staging excluded reserved Firebase environment names and plaintext duplicates of declared secrets.
- [Firebase Hosting](https://riddle-quest-ec2b2.web.app): deployed the retained, exact verified Jest archive. Live HTML and all seven referenced entry assets match the verified files byte for byte.
- [Jest game](https://jest.com/g/riddle-q): Developer Console reports **Bundled / Active** for `1.0.0-dev.20260921203831.675d13051574.7b59232b`, version ID `01a0c5c2-6cd3-71ad-b852-e93f69dc9340`. Source `675d13051574198542bc24107bbad7082ac8ab48`; archive SHA-256 `7101967ae282950cde6e548baa302c77f62cf2f963caa1fc8e6d040784e6e823`. The accepted-pending source barrier was archived with authoritative Console completion evidence.
- [Yahoo candidate](https://yahoo.roobsworld.com): production deployment `riddle-quest-yahoo-b1dq7v0y0.vercel.app`. The previous remote-account implementation failed guest startup and also conflicted with the required provider-neutral candidate boundary. The deployed candidate now bundles local play and all content, with no Firebase, identity, purchases or external resource requests. Existing remote account records were not migrated or deleted. Live HTML matches the audited artifact. Phone-browser play solved ROME, awarded 150 coins (300 → 450), and retained 450 coins and Classic 2/180 after reload.
- Release dashboard returned HTTP 200; Sentry worker `/api/sentry-webhook` health returned HTTP 200 with active status. These unchanged support deployments were checked, not redeployed.

## Verification

The canonical Jest release passed the full production gate, a ten-minute mobile soak, W3C validation and browser checks against the exact immutable ZIP before upload. Across the completed gates: 765 portal tests, 1,011 backend tests, 54 rules checks, injected Jest authentication (29), hosted UI (1), Facebook (1), Reddit (1), YouTube (9), plus six target builds and isolation audits. The corrected Yahoo candidate also passed the standalone boundary audit and local and live save/reload checks.

The live Jest headless browser requires the existing dedicated App Check debug credential; reCAPTCHA rejected the unconfigured automated browser with HTTP 403. The credential is injected into the test context only and is not bundled in production.

Live Jest exact-version smoke passed: registered identity exchange, riddle loading, 48 px CSS keys (at least 44 px rendered), no viewport overflow, multiplayer start, immediate skip with an authoritative 45-second penalty, hidden battle coin button, race abandonment, coin catalog, referral verification and subscription catalog/entitlement rendering. The subscription assertion now waits for the asynchronous shop refresh to finish. A separate zero-dollar sandbox checkout granted 250 coins, rejected receipt replay idempotently and completed purchase recovery successfully.

## Jest resubmission

Completed the Developer Console self-review against the new build: guest solved BEAVER, completed the reward sequence, then received the registration overlay. After simulator registration, all D1–D7 notifications were observed (first scheduling three seconds after registration). Mock coin checkout and subscription checkout completed, and the active entitlement stopped being offered again. Basic Launch finished **21/21** and Fund checks **7/7**. These simulator checks do not certify real messaging-network delivery.

Submitted the self-review and Fund application with notes addressing the prior review feedback. The Console Overview authoritatively shows **In Review**, version `1.0.0-dev.20260921203831.675d13051574.7b59232b`. Review approval is pending. No session video was attached.

## Remaining provider release limits

| Target | Verified result | Release limit |
| --- | --- | --- |
| Facebook | Existing hosted testing version 3 completed a real riddle and displayed an authoritative +75 coin / 400 XP win against the deployed backend. Updated artifact built and injected browser passed. | New upload remains blocked by retained SHA-256 `25102bb69a8d9c43092140ec9916700181faf1a60e03bf00539a237d1878571e` receipt in `transmitting` state. Its outcome has not been authoritatively reconciled; it was not bypassed. New UI fixes are not deployed to Facebook. |
| Reddit | Client build/isolation and injected browser passed; shared backend deployed. | `release:reddit` refuses missing approved auth, payment, refund, post-entry, realtime and notification contract fixtures. Remote ingestion also needs exact-byte proof. No Reddit client upload occurred. |
| YouTube | Clean source `bee43294c5f3689f0901b2d0a6750e21b626ea27` completed the release workflow. `build-youtube.zip` is 367,795 bytes, SHA-256 `1b9f41fc0a46378341c01fac3176566ffe1489beebfaef9f751c0191fd69c041`, with manifest and test report beside it. | Prepared local handoff; provider portal ingestion and certification remain outstanding. |
| Netflix | Self-contained candidate built and audited with full bundled release content. | No approved partner SDK or deployment destination exists in this repository. Candidate artifact is available in `packages/portal/dist-netflix`; not published to Netflix. |

## Screenshots

- [Yahoo live win](../../artifacts/deployment-verification-2026-09-21/yahoo-win.png)
- [Yahoo progress after reload](../../artifacts/deployment-verification-2026-09-21/yahoo-reloaded.png)

No claim is made that all six provider releases are published or certified, or that live production latency has a guaranteed upper bound.
