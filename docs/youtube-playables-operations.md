# YouTube Playables Operations

This runbook prepares the self-contained Riddle Quest YouTube Playable for manual Developer Portal submission. The repository produces and verifies the bundle; an invited channel Manager or Editor performs Portal ingestion, hosted testing, and certification.

## Release boundary

The YouTube artifact contains one platform integration and all runtime game content. Its only external script is `https://www.youtube.com/game_api/v1`; it does not use Firebase, `/api`, analytics, ads, purchases, identity, sharing, or multiplayer. Progress is a platform-local Playable Save and never joins the Global Game Account.

The public [Developer Portal guide](https://developers.google.com/youtube/gaming/playables/developer_portal) describes a manual Private Preview workflow and does not publish an upload or release API. Do not automate Portal submission by scraping it.

## Prerequisites

- Private Preview access to the Developer Portal.
- Manager or Editor permission on the onboarded YouTube channel.
- Owner-approved title, genre, description, publisher/developer values, and every thumbnail ratio currently requested by the Portal.
- An owner-private `OPENAI_API_KEY` for content authoring. Keep it out of repository files and shell transcripts.
- Distinct locked authoring models: `gpt-6.1-sol` generates new English additions; the existing `gpt-5.6-sol` translation contract remains pinned; `gpt-5.5` independently critiques both stages.

## Author and freeze content

Content authoring is networked and resumable; ordinary builds are offline. From the repository root:

New Classic and Daily additions alternate easy and medium batches. The author and independent critic use everyday recognition for easy riddles and one straightforward inference for medium riddles; hard additions are excluded. Legacy released content remains bound to its original receipt and difficulty policy.

```sh
pnpm --dir firebase-functions youtube:content:author
pnpm --dir firebase-functions youtube:content:compile
pnpm --dir firebase-functions youtube:content:audit
```

The initial authoring command translates the current canonical corpus into all 16 non-English bundles. For a later release, append a reviewed batch explicitly:

```sh
pnpm --dir firebase-functions youtube:content:append --append-count 6 --daily-starts-on 2027-01-01
```

The append count must be between 1 and 180. Supply the intended future UTC start date explicitly; it must not overlap any immutable released segment. The command allocates canonical IDs, categories, difficulty, Classic order, and a separately hashed Daily segment deterministically; models cannot choose or reorder those identifiers. It resumes from model/hash-bound checkpoints and commits an append receipt only after the independent English critique and all 16 translation critiques pass.

`youtube-content-source-v1.json` binds the unchanged, strict 180-riddle Race seed by SHA-256 and stores only YouTube additions. The Race import remains exactly 180 items. The compiler resolves that layered source offline, then proves an exact 17-locale canonical set, immutable Classic and Daily prefixes, native NFC answers of one to twelve graphemes, source/review hashes, and deterministic runtime bytes. The audit must fail if any locale, critique, hash, or committed output is absent or stale.

Retain the generated content audit beside the release evidence. Model prompts, responses, checkpoints, critiques, and authoring credentials must not enter the game ZIP.

## Build and package

Run the complete hash-bound preflight from the repository root:

```sh
pnpm check:youtube-progress
pnpm release:youtube
```

`release:youtube` runs the content tests, YouTube runtime unit tests, isolated builds and reciprocal artifact audits for all four targets, release-boundary tests, and injected browser suites for all four targets. It then writes the exact test report and packages only if every repository-owned gate passed. It has no remote upload action. To recapture only the verification report use `pnpm youtube:evidence`; to repackage an unchanged, already verified candidate use `pnpm youtube:package`. Packaging fails closed when the report is missing or no longer matches the Git snapshot, expanded artifact, or content/model audit. The legacy `pnpm youtube:preflight` alias delegates to the same canonical command for one migration cycle.

The expected outputs are:

- `builds/youtube/` — audited expanded artifact.
- `build-youtube.test-report.json` — machine-readable exact commands/results plus the repository and external certification checklist.
- `build-youtube.zip` — repository-root upload ZIP with `index.html` at archive root.
- `build-youtube.manifest.json` — repository-root source/content/model/test identity, file inventory, and ZIP SHA-256 evidence.

The manifest records the exact Git commit, clean/dirty state, a content-sensitive dirty-tree fingerprint, every artifact file hash, all locale/model hashes, the `canonicalAuthoring` generator/critic and append-receipt binding, and an embedded copy plus hash of the exact test report. Packaging must be reproducible: rerunning it from unchanged inputs and the same report produces the same ZIP and manifest. Never edit source, the expanded artifact, content audit, test report, or ZIP after evidence capture; any such drift requires rerunning the full preflight.

Source identity uses the development verifier’s tracked and untracked source path scope. Generated root artifacts, `.codex` state and generated readiness data are excluded; the expanded playable and content/model audit have their own SHA-256 identities. The runner captures source before the first suite, checks it after every suite, and rejects a mismatch before writing a passing report.

The release build intentionally remains blocked until all 16 credentialed translation bundles are present and audited. The English fixture build is suitable for repository verification, but neither it nor synthetic package tests can create upload evidence.

## Save and Daily operating assumptions

Playable Save schema v1 is the first deployed YouTube schema. The parser retains one explicit schema-v0-to-v1 migration for prerelease development saves; this is not evidence of a deployed predecessor. A valid v1 save may recover by dropping only a corrupt or content-mismatched active game while retaining valid progression. Malformed envelopes and future schema versions fail closed and are never overwritten automatically; recovery requires an explicit destructive reset and user confirmation.

Cloud Save is last-writer-wins across concurrent devices because the public Playables API provides no compare-and-swap contract. The target must load successfully before its first write, serializes local writes, and keeps an exact failed revision behind retry, but it cannot merge two devices' independent histories.

Daily selection uses device UTC because the public SDK exposes no trusted platform time. An unfinished Daily remains the one globally active puzzle across midnight, and `lastDailyCompletedDate` blocks a clock rollback from replaying a rewarded day. Record this unavoidable device-clock limitation in release notes and certification evidence.

## Local acceptance

The exact artifact must pass all of these before Portal ingestion:

- `firstFrameReady()` once before `gameReady()`, with successful `loadData()` and interactive localized content between them.
- No save before a successful load; every material gameplay mutation is durably serialized or held behind retry.
- SDK-only pause/resume, locale, and master audio behavior.
- Mouse, touch, keyboard, native IME, zero-size startup, and the recorded extreme-aspect viewport matrix.
- No browser visibility/offline behavior and no prevented Escape event.
- No unsupported UI or forbidden network request.
- Relative resource paths, approved filenames, at most 8,000 files, every file strictly below 30 MiB, initial transfer strictly below 30 MiB, and total content strictly below 250 MiB. The [normative stability requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability) win over any sample analyzer boundary discrepancy.

Run the unchanged Jest, Facebook, and Reddit build/audit/browser gates as well. A YouTube change is not releasable if it contaminates or regresses another target.

## Portal ingestion and certification

1. Create a draft and enter the current Portal metadata.
2. Upload the exact `build-youtube.zip` and its required thumbnails.
3. Record the ingested release identifier, ZIP SHA-256, Dev link, and Test Suite link.
4. Run Google's [bundle analyzer](https://developers.google.com/youtube/gaming/playables/samples/bundle_analyzer) against the exact ZIP and retain its output.
5. Run the hosted [Test Suite](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide), including the production CSP override.
6. Verify desktop web, mobile web, physical Android, and physical iOS. Bind recordings and sanitized logs to the same ZIP hash.
7. Reconcile every row in `docs/youtube-playables-progress.html`. Only one release may be under certification; submit only when all repository and hosted gates for this hash are complete.

Portal metadata fields, thumbnail dimensions, review timing, rollout, rollback, and retained-version behavior may change or remain partner-specific. Capture the current Portal contract and Partner Manager instruction rather than encoding undocumented assumptions.

## Failure handling

- A missing or rejected cloud save keeps the Playable in its retry state; never upload evidence claiming gameplay readiness.
- A failed material save keeps the exact pending revision. Retry it rather than replaying the economic transition.
- If the hosted artifact hash differs from the locally audited ZIP, discard its evidence and ingest the audited bytes again.
- If certification rejects the release, create a new deterministic ZIP/version and repeat every hash-bound gate. Do not overwrite evidence for the rejected artifact.
- If a Portal action has an ambiguous result, reconcile it in the Portal or with the Partner Manager before retrying.

## Evidence record

For each candidate retain:

- Source commit and clean/dirty-state note.
- Content version, canonical source hash, 17 locale hashes, translator/critic IDs, and content-audit result.
- Expanded artifact report, deterministic ZIP SHA-256, and release manifest.
- Unit, injected-browser, existing-target regression, bundle-analyzer, hosted Test Suite, and physical-device results.
- Portal release/certification identifiers and timestamps without player identity, credentials, signed URLs, or private payloads.
