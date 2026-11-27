# Facebook deployed source comparison, 27 November 2026

The three downloaded source-archive representatives differ from the protected baseline `2834dc910a39aa9add734440ddfb8dfd533d30dc`. Exact equality with that baseline is contradicted for those representatives. The [comparison record](facebook-deployed-source-comparison-2026-11-27.json) preserves the source-object metadata, representative downloads, baseline compilation, and file comparisons.

## Provenance and comparison method

Read-only metadata covered the pinned GCS source objects for the 32 functions in the [deployed authority inspection](facebook-deployed-authority-2026-11-27.md). The objects form three groups by recorded MD5, CRC32C and byte count, containing 28, three, and one functions. One representative object from each group was downloaded. Each download matched its recorded MD5 and size, and a SHA-256 was computed from its bytes. The active `getFacebookClientConfiguration` source object was then downloaded independently at generation `1795762226012771`; its SHA-256 and 1,223,827-byte size matched the main representative exactly. Four objects were downloaded in total. The other 28 objects were not downloaded; their group membership comes from metadata.

| Representative download | Functions in metadata group | Bytes | Representative SHA-256 |
| --- | --- | --- | --- |
| `aggregatePresenceStatus` | 28 | 1,223,827 | `c2fc176be530aebec257d0a14590c8f044b3fee239f4f9f0157be0d68f31e9a7` |
| `dispatchFacebookManagerNotification` | 3 | 1,232,695 | `97885d44d3081979f15dea6b80a363bca5a9a3fe9b943c8f5e1af0bf73de5c72` |
| `deleteAccount` | 1 | 1,242,107 | `f589154a48d214b7938871b24201c6707bc5abe8b8bd082860046ad57bfe8247` |

Each archive contains only `package.json`, its lockfile, and compiled files under `lib`. None contains TypeScript source. Their source maps contain no `sourcesContent`. Both package manifests match the protected baseline byte for byte.

The exact baseline was copied with `git archive` into scratch space under `/tmp`. The copied staging script and canonical TypeScript 7.0.2 compiler ran successfully under Node 22.23.1. This produced 566 emitted files and manifests for comparison. All 29 direct dependency versions matched the lockfile; this does not establish full transitive dependency integrity. Compilation did not write to the workspace's Firebase source or configuration and did not deploy anything.

## File comparison results

The counts below come from the comparison record's matching count and the lengths of its difference arrays. Source maps count as files. A difference here is a byte comparison, not a claim that every changed file affects an invoked function.

| Representative group | Archive files | Matching files | Different files | Deployed-only files | Baseline-only files |
| --- | --- | --- | --- | --- | --- |
| Main 28 functions | 554 | 504 | 44 | 6 | 18 |
| Three manager functions | 558 | 516 | 38 | 4 | 12 |
| Account deletion | 562 | 544 | 16 | 2 | 6 |

All three comparisons report `identicalContents: false`. The baseline has 566 files in each comparison. These results do not identify the original Git commit used for deployment.

## Facebook-specific impact

The active `getFacebookClientConfiguration` deployment belongs to the main 28-function metadata group. Its inspected configuration module reads `facebookCommerceAccounts` and projects ad eligibility from feature switches. It lacks the protected baseline's `users/{uid}.hasActiveSubscription` read and `permitsAds` check. All three representatives contain this older configuration module, but the main group owns the active configuration endpoint.

Version 12 trusts the returned ad booleans and has no independent consumer of a subscription field. Subscription-based ad suppression is therefore absent from the inspected active source path. This is an acceptance blocker for that policy. No live subscriber harm was observed. The separate durable `removeInterstitialAds` entitlement remains present; this finding does not establish that every ad rule or deployed function is broken.

The main archive also contains older notification modules, but those copies do not establish the active notification behavior. The active `setNotificationPreference`, `dispatchFacebookManagerNotification`, and `syncFacebookManagerRegistration` functions use the separate manager-group deployment. Its inspected notification modules match the baseline and the current client consent shape. Full dependency-path and runtime acceptance remain unproven.

## Preserved backend and remaining gate

All observed remote deployment updates predate this thread. The current branch's only shared `src` differences from the protected baseline are two Settings UI files outside the server dependency graph. This comparison does not attribute the deployed source differences to the current Facebook client work.

The inspection downloaded source archives and compiled an isolated baseline. It did not invoke functions, mutate database records, edit workspace backend files, change deployed configuration, activate features, or deploy a repair. The owner's Firebase freeze remains in force.

The [backend acceptance gate](../facebook-api-submission-checklist-2026-11-27.md) stays open. Exact source equality is contradicted for the inspected representatives, subscription suppression has a concrete source-level blocker, and shared endpoint coverage, runtime receipts, idempotency, callbacks, and notification delivery remain separate acceptance work.
