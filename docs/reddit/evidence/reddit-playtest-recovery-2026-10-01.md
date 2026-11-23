# Reddit private playtest recovery — 2026-10-01

The private uploader now retains upload uncertainty across invocations. Previously it stopped after an unsuccessful CLI result but a later invocation could transmit another version without inspecting the earlier outcome. The new receipt-directory lock and immutable journal close that bypass.

The lock covers local package validation and the entire synchronous Devvit upload. A failed local package check leaves no attempt and can be corrected. Immediately before invoking Devvit, the wrapper writes and flushes a private attempt record. It writes a separate accepted or ambiguous CLI outcome, never retries automatically, never reuses an attempted version, and refuses every later version while any retained attempt is unresolved. Corrupt, orphaned and non-regular evidence fails closed.

An interrupted process leaves its lock and attempt in place. Recovery requires confirming that the recorded process is terminal, removing only its stale lock, inspecting the exact provider version, and recording an explicit accepted or confirmed-absent outcome with matching version confirmation. The local resolution command appends immutable evidence and never calls Devvit. A timeout or inaccessible dashboard cannot establish absence. Original uncertain records remain intact.

These are private bootstrap records, not reviewed production upload receipts, source hashes or proof of installed bytes. The installed Devvit CLI can rebuild during upload; the existing production transmission commands remain blocked until exact-byte ingestion and hosted acceptance are proven. The lock/journal coordinates one shared receipt directory; separate machines require coordinated provider ownership.

| Verification | Result |
| --- | --- |
| Focused uploader/recovery tests | 7 passed on Node 24; 7 passed using pinned Node 22 |
| Real subprocess cases | A competing process is rejected before validation; an exited upload process leaves lock/pending evidence and needs explicit recovery |
| Complete Reddit package tests | 35 passed; server types passed |
| Required isolated builds | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo passed |
| Artifact boundaries | All six target audits passed; Reddit remains same-origin and excludes Firebase/Jest/Facebook browser SDKs |
| Package validation | Build and Devvit package contract passed |
| Source checks | TSDoc, file-size, backend scalability, documentation/wizard tests and whitespace passed |
| Read-only hosted route | Existing gateway still rejects unsigned requests as expected |

The [review manifest](../../../artifacts/reddit-playtest-review-2026-10-01/manifest.json) records selected source hashes and validation logs. Build output is a selected summary because the tool truncated the full Vite output; the full sequential build command exited zero. Focused tests use temporary receipt directories and mocked transmission callbacks; subprocess tests never contact Devvit. No live upload, install, publish, deployment, payment or journal resolution was performed.

Current provider blockers remain: exact-host approval, a new confirmed private version containing the current first-party gateway, real signed forwarding and payment/refund fixtures, owner role access, physical-device acceptance, and an immutable reviewed release. This work improves safe testing preparation without claiming those gates passed.
