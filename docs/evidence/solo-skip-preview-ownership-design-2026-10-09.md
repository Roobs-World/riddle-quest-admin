# Skip preview rollback ownership requirements

The original preview/rejection audit's index-2 rollback control represented existing behavior, not proof of speculative ownership. The strengthened eight-case diagnostic now distinguishes an actually requested and admitted preview from an independently loaded next-index round.

On the current worktree five cases fail and three controls pass. An owned preview still correctly rolls back on definitive rejection, while an independently loaded index-2 round incorrectly rolls back too. Wrong-index, wrong-mode, advanced preview admission and index-3 rejection remain failures. The original seven-case results are archived separately from the strengthened final results in `artifacts/solo-skip-preview-rejection-audit-2026-10-09/`.

Source review shows why a current-index-only guard is insufficient: the preview ref stores its request ID and origin token but not the admitted preview session. The journal's successors array collects any consecutively loaded round; membership alone does not prove preview ownership. The ref resets on a new mount, while the paid request and successor survive in storage. A hot-only ref fix would therefore lose legitimate rollback ownership on reload.

Required behavior for the implementation:

- Bind preview admission to its paid Skip, issued origin, target Classic index and current round freshness.
- Record the exact admitted speculative session before allowing it to become current; rejected durable writes must not admit an unowned preview.
- Preserve that ownership across reloads, validate it against the retained paid action and issued origin, and discard stale or malformed ownership without dropping the paid receipt.
- Rejection may restore the paid action's issued segment only while its original session or explicitly owned speculative session remains current. An independently loaded round or later round must survive.
- An authoritative successor supersedes speculative rollback ownership; duplicate or reordered preview delivery must not reset a playable successor.
- Retain exact payment retry and account/locale revocation, existing legitimate rollback, and later owned request/draft preservation.

No production source changed in this design pass. Current diagnostics and source inspection provide the implementation requirements; no browser, build, or deployed-behavior claim is made for an unimplemented fix. The broader goal remains active.
