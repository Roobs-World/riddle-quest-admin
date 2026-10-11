# Settlement deletion and cross-tab takeover diagnostics

Following the mounted settlement-write repair, two additional failure sequences are reproduced against the actual recovery hook, reducer and concrete journal storage adapter. No production source changed during this audit.

1. A paid Skip rejection removes its owned speculative successor and has no unrelated remaining work. Browser storage throws on journal removal, then recovers. The in-memory rollback is correct, but the original stored paid request and speculative marker remain. The deletion helper swallows errors and reports no result; the handler cancels its renewal clock.
2. A settled journal write fails transiently. Time advances past the first tab's lease deadline; a second tab successfully acquires the real journal lease and persists a newer index-3 draft `S`. The first tab's newly introduced settlement-persistence timer overwrites that draft with its older `R` snapshot. Its account/lifetime guards do not establish cross-tab ownership. This exposes a limitation of the recent single-mounted-owner repair and must be addressed before treating cross-tab recovery as safe.

Each scenario has a successful-storage control. Final combined run: two diagnostics fail and two controls pass, four suites, elapsed 0.241 seconds. The final fake clock respects cancelled handles; the takeover uses the actual lease acquisition implementation at 20,000 ms after initial acquisition at 1,000 ms. Inputs are synthetic guest gameplay, with no live provider requests.

Command from repository root:

```sh
pnpm_config_verify_deps_before_run=false pnpm --dir packages/portal exec jest --config jest.config.cjs --runInBand --roots /home/craig-beswetherick/Documents/riddle-quest/artifacts/solo-paid-settlement-delete-audit-2026-10-09 --testMatch '**/*.test.ts'
```

Evidence: `combined-diagnostic.log`, four diagnostic/control files and `source-inputs.json` in that directory. These are intentionally failing audit probes outside the normal test root. No full-build claim applies to them.

The next repair must cover settlement writes and deletion through one durability obligation. A retry must distinguish an unavailable store from an independently replaced journal, compare the stored predecessor to the expected settled request, and respect another tab's lease. A changed durable journal must not be erased or overwritten by an old retry. Current drafts within the original mounted owner still need to win over its failed snapshot. Both operations must stop on account/provider retirement and stop after successful persistence without replaying payments. A storage outage continuing through page close cannot guarantee durable removal.

All audit jobs are terminal. No deployment, commit, push or production mutation occurred. The broader goal remains active.
