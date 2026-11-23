# Bounded Unicode work in race validation — 5 October 2026

Race guess and current/preloaded evaluation answer refinements now check the existing 128-unit raw text bound before calling the grapheme counter. The 128-unit limit, seven-grapheme capacity, trimmed guess behavior and original authored answer bytes remain in place.

The actual compiled shared schemas rejected a 4,096-unit ASCII input before this change but still normalized and segmented all 4,096 units in each of the three schema paths. The same probe now records zero normalized and segmented units for all three paths while still rejecting the input. This is a reduction in unnecessary validation work; no end-to-end gameplay latency improvement is claimed.

Thirteen new tests observe the native normalization and segmentation APIs through the actual shared schemas. Six failed on the matching baseline. Controls include oversized ASCII and a 129-unit single grapheme, a valid 128-unit seven-grapheme answer whose original bytes are preserved, eight slots within the raw limit, and whitespace around a maximum-size guess. The existing decomposed French, Russian, Japanese and Hindi cases continue to pass. These predicates may add a generic refinement issue to an oversized single grapheme's existing raw-length issue; accepted and rejected inputs retain the same outcome.

Validation passed:

- 351 core tests across 37 suites, including 26 focused tests across two suites.
- 1,669 backend unit tests across 134 suites and 401 private loopback emulator tests across 27 suites.
- Ten existing real-SDK Unicode gameplay tests also passed on the pinned Functions Node 22 runtime, covering evaluation decks, hints, answer-free runs, scoring, replay, balances and invalid guesses.
- 37 focused portal tests across four suites and eight built-browser gameplay tests across three suites. The existing buffered transition assertion remains below 100 ms.
- Core, backend and portal TypeScript checks; canonical downstream backend lint; documentation audit of 26,056 declarations across 1,167 files.
- Six isolated artifact builds and audits for Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. YouTube used the incomplete-content fixture path, which is not release certification.

The backend deploy-core and installed-core copies were synchronized before freezing verification inputs. Nine hashes cover the shared schema JavaScript, declarations and declaration map across three locations. The frozen manifest contains 2,365 inputs. All 1,300 build files and six target dependency inventories are preserved and hash-verified before the owned temporary builds and matching original inventories are removed. All 18 observed jobs have terminal results; the owned emulators are stopped.

The first diagnostic probe incorrectly unwrapped the required preload evaluation object; it was corrected before collecting the matching runtime baseline. An initial core lint invocation selected system ESLint because the core package has no configured lint command. That tooling failure is retained in the job ledger; core types/tests and canonical downstream backend lint passed. No production changes were made to accommodate either tooling issue.

The evidence and authoritative report verifier are in [the artifact directory](../../../../artifacts/race-validation-work-2026-10-05). The goal remains active. Retained live/accepted recording recovery and per-cell Unicode hint/history capacity are separate audit candidates.
