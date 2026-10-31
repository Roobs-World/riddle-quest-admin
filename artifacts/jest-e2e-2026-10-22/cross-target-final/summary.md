# Final non-Jest target build and isolation checks

All six requested builds passed sequentially against the frozen journal repair. Commands, exit codes and raw audit summaries are in status.json; complete logs are adjacent. No runtime edits, canonical Jest build, immutable snapshot edits, provider changes, deployments, backend deployments or Sentry source-map uploads were performed. DEBUG was unset and SENTRY_UPLOAD_SOURCEMAPS=0.

| Target | Result | Files | Exact bytes | MiB | Initial local resources |
| --- | --- | ---: | ---: | ---: | ---: |
| facebook | PASS | 416 | 4,686,334 | 4.4692 | 666,350 bytes |
| reddit | PASS | 429 | 4,130,572 | 3.9392 | 661,246 bytes |
| youtube | PASS | 24 | 1,891,211 | 1.8036 | conservatively entire artifact |
| netflix | PASS | 24 | 1,890,553 | 1.8030 | self-contained package |
| yahoo | PASS | 24 | 1,890,547 | 1.8030 | self-contained package |
| gamesnacks | PASS | 28 | 2,677,810 | 2.5538 | self-contained package |

MiB uses 1,048,576 bytes. Facebook/Reddit initial resources are the deduplicated local src/href files referenced by their audited entry documents, matching their existing audit definition. Their 5,242,880-byte initial limits pass. YouTube conservatively counts its full 1,891,211-byte artifact as initial transfer, below its 15 MiB recommendation and 30 MiB hard limit. Netflix/Yahoo each remain below 30 MiB. GameSnacks lists 24 runtime files totaling 1,890,288 bytes; its 28-file full package adds metadata/marketing and remains below 100 MiB, with each file below 10 MiB. All shipped targets contain zero source maps.

## Isolation boundaries checked

- Facebook: exact Instant Games v8 entry/config and software notices; no Jest, Reddit, YouTube, native framework/auth or native ad leakage.
- Reddit browser: two relative-resource entry documents; same-origin API boundary; no Firebase browser SDK, Jest/Facebook/YouTube, external analytics, advertising, subscription or Remove Ads commerce leakage. Devvit package includes 430 regular client/server files totaling 7,809,881 bytes, exact CJS server and one configured HTTP gateway domain (www.roobsworld.com). Its 51 package/server validation tests pass. Redis remains delivery/cache infrastructure; this check does not make it the global account/economy authority.
- YouTube: exact Playables SDK entry is the approved external integration; no Firebase, other provider SDKs, arbitrary browser network APIs, analytics, commerce, ads or multiplayer surface. All 16 release locales and 180 Classic riddles per locale ship in the artifact.
- Netflix/Yahoo: self-contained candidate content/local progress, with no provider SDK, Firebase, analytics, browser network API, commerce or advertising leakage. Both contain all 16 release locales and 180 Classic riddles per locale.
- GameSnacks: target SDK adapter present, all 24 runtime files packaged; packager rejects Firebase, Facebook, Reddit, YouTube and commerce leakage, verifies runtime bytes and binds metadata/marketing to the same inventory. All 16 release locales and 180 Classic riddles per locale are included.

## Evidence and limits

Every file in the six copied dependency inventories was SHA-256 checked against the fresh output. Those inventories are preserved under dependency-inventories/; exact counts/bytes and limits are in artifact-measurements.json. source-sha256.json binds the shared repair and build inputs. The Reddit count includes both client and server package directories; its browser-only inventory is listed separately in the table.

Build scripts also ran the existing target-boundary, locale, content-release, license/commerce-activation and artifact gates where configured. No boundary or size gate failed. These are local build/isolation checks, not actual publication, partner approval, provider account changes, or hosted gameplay evidence. Earlier target rounds and all canonical Jest evidence remain separate.
