# Race question exclusions, 12 October 2026

The user instructed us to remove questions whose faithful translated answers exceed seven letters. The game still accepts one through seven grapheme clusters. Do not substitute a shorter word that changes the answer.

The authoritative English source is `firebase-functions/content/race-en-reviewed-v2.json`. Three demonstrated conflicts were removed from its canonical question set:

| Canonical question | Locale | Faithful answer | Letters |
| --- | --- | --- | --- |
| race:geography:07 | de | Brasilien | 9 |
| race:geography:v2:17 | de | Deutschland | 11 |
| race:history:v2:20 | es | castillo | 8 |

The original 180-question source is retained at `firebase-functions/content/archive/race-en-reviewed-v2-before-length-exclusions.json`. Its SHA-256 is `e4ed372c49ed6a6d7f98f583549f86f192b6b5eec9890fe92b721b59cdfe4ef1`. The filtered 177-question source SHA-256 is `615abbb81c87d2544e1b7b8cca5219195130e3e7ec58d4fb22edf2181c91821c`. The exclusion manifest retains the earlier conflict proposal as evidence; its suggested replacement questions were not adopted.

Pool validation now accepts 15 through 30 questions per category. Every category must still supply at least 10 easy and 5 medium questions. Locale bundles must contain exactly the final English canonical set, with matching source hashes, metadata and independent critique. The matrix count derives from that source rather than a fixed 180-question assumption. The actual supported-locale definition contains English and 15 non-English locales.

The applied change passes 61 targeted unit tests across six suites, the Functions TypeScript check, and 21 tests against the private Firestore emulator. The emulator verifies reduced-category availability, the unchanged 15-question deck, seven-slot answer limits, category and locale boundaries, and invalid-content rejection.

## Remaining work

Geography has nine easy questions after the exclusions. The source therefore remains invalid for import. Do not relabel a question or relax the deck requirement merely to satisfy its count.

The other canonical concepts still need faithful native-answer screening across all 15 non-English locales. The three demonstrated conflicts are not proof that the remainder is playable. The translation key is absent from the current session and active Functions environment files, so generation has not resumed.

Existing checkpoints remain bound to the original source hash. They are preserved unchanged and cannot be treated as approvals for the filtered source. No complete new bundle, corpus audit, cloud import or provider publication has occurred.

Verification receipts and logs are in the Portfolio workspace at `output/task-fixes/riddle-translation-exclusions/application-receipt.json`. Before changing source, the completed browser check report was archived under its original source digest. Those checks remain historical evidence rather than being relabelled as checks of this content revision.
