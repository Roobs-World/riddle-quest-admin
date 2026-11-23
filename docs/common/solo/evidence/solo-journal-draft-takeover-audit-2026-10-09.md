# Passive journal draft saving after cross-tab takeover

The preceding guarded receipt-transition repair protects its own persistence retries. This audit finds a separate writer that bypasses those guards: the draft effect in `useProvisionalPlayRecovery.ts` calls `adapters.journal.write(journal, unchanged)` with its older in-memory journal after another tab has persisted newer work.

The injected real React StrictMode harness uses the actual router, reducer, hook, journal reader/writer and lease adapter. After a failed settlement write, the second tab acquires the lease at 25,000 ms and stores a newer index-3 draft. The guarded receipt retry correctly leaves that draft alone. The second tab then persists a new paid Skip request for that issued question; the durable reader confirms it exists. The first tab receives a canonical load for index 3. Its passive draft save overwrites the record with its old in-memory journal, removing the second tab's required paid request. No extra click or second receipt is needed to trigger the failure.

At both 390px and 1280px:

- Chrome development: two journeys, 20 checks, exactly two failures. The second-tab paid request changes from the expected action to null.
- Firefox development: the same two journeys and exact failures.
- Chrome control suppressing only the stale tab's canonical load: two journeys, 20 checks, all pass. The paid request remains durable.
- Chrome with the second tab releasing its lease before the stale canonical load: the same two failures. Therefore a current-lease check alone does not address stale durable data after release.

The browser captures each expected action, persisted journal and screenshots in `artifacts/solo-journal-draft-takeover-audit-2026-10-09/`. Final logs are `chromium-diagnostic.log`, `firefox-diagnostic.log`, `chromium-control.log` and `chromium-released.log`. All jobs are drained. `source-inputs.json` records the unchanged production inputs. No production source was modified during the audit.

Commands use `browser.mjs` in that evidence directory with `PENDING_LIFE_BROWSER=chromium` or `firefox`, `PENDING_LIFE_MODE=development` and a distinct `PENDING_LIFE_REPORT_DIR`. Firefox uses the cached Firefox 153 executable through `PENDING_LIFE_FIREFOX_EXECUTABLE`. `DRAFT_TAKEOVER_CONTROL=1` runs the control; `DRAFT_TAKEOVER_RELEASED=1` runs the released-lease case. Local servers require the approved execution permission.

The next repair must make passive draft persistence conditional on the expected durable predecessor as well as lease ownership, and must preserve another tab's paid requests and guesses after lease release or expiry. The caller should not blindly overwrite a validated replacement with its old cached journal. Related normal reconciliation, successor append and guess-settlement writers need the same ownership audit, rather than assuming receipt-transition guards cover them. Keep in-memory restoration and scope retirement coherent while introducing that guarded write boundary.

These are local controlled storage and provider fixtures; they do not prove a live provider charge, server replay or financial loss. The failure proves a required local recovery action can be discarded. Nothing was deployed, committed or pushed. The broad goal remains active; this finding is not fixed yet.
