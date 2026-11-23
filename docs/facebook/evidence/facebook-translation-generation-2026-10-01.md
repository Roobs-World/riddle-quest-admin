# Facebook translation generation — 2026-10-01

Actual generation is available, but the complete corpus is not ready for import. A read-only authenticated model-list probe confirmed the pinned `gpt-6.1-sol` translator and independent `gpt-6-astra` critic. Credentials were neither printed nor retained in review artifacts.

The existing reviewed English source remains unchanged: 180 unique canonical riddles and answers, 30 in each of six categories. Generation requires 16 complete non-English bundles, totaling 2,880 translations. All model requests used structured output and `store: false`.

| Locale | Drafts | Independent critiques | Accepted | Remaining rejection |
| --- | ---: | ---: | ---: | --- |
| German | 30 | 30 | 30 | Next batch fails native answer length |
| Spanish | 30 | 30 | 29 | `alcázar` is narrower than canonical `castle` |
| French | 15 | 15 | 15 | No rejection in the current partial checkpoint |
| Italian | 15 | 15 | 15 | No rejection in the current partial checkpoint |

The critic rejected translations that changed Mesoamerica to Central America and a French clue that added a Latin-name qualifier. The pinned translator repaired the wording; fresh independent critique accepted the repairs. Original rejected checkpoints are retained. No critique flag was forced to success. Every current checkpoint passed the existing source hash, canonical ID, answer, and exact translation-to-critique hash validation.

German generation then stopped at `race:geography:07`, whose native answer is `Brasilien` (nine letters). Other fixed concepts expose the same conflict: `Deutschland` has eleven letters; Spanish `castillo` has eight. Shorter substitutes that change the answer's meaning cannot satisfy equivalent-canonical critique. The seven-grapheme rule remains enforced.

The [review manifest](../../../artifacts/facebook-translations-review-2026-10-01/manifest.json) records 90 drafts, 89 accepted critiques, four hash-bound checkpoint snapshots and zero eligible bundles. The complete matrix CLI exited 1 because a complete bundle is missing. Partial checkpoints are not an import manifest, and accepted individual critiques do not establish whole-pool duplicate, balance or language quality.

A [separate canonical revision proposal](../../../artifacts/facebook-translations-review-2026-10-01/canonical-revision-proposal.json) offers three candidate replacement concepts with new canonical IDs while keeping seven-letter gameplay. It is deliberately not an import source and carries no reviewed quality label. Factual accuracy, difficulty, all-locale native spelling, length and uniqueness must be reviewed before any revised source can be used. The proposal covers demonstrated conflicts only, not the entire corpus.

No content was imported, no deployed pool changed, no runtime answer limit changed, and no SDK or platform implementation changed during generation. The six isolated target builds and backend regression evidence in [context retention validation](facebook-context-retention-2026-10-01.md) remain applicable. Completion still requires resolving the source constraint, generating all bundles, independently evaluating actual output, passing the complete matrix audit and retaining a reviewed import preview.
