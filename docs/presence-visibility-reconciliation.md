# Reconcile existing presence permissions before hosted review testing

The versioned presence mirror prevents an older grant from overwriting a newer block. Existing boolean permissions need a one-time reconciliation from current server authority. The maintenance CLI prepares that step without changing client adapters or granting identity, purchases, ads or notifications.

First deploy the matching rules and mirror implementation to staging and verify that older non-versioned writers have drained. Reconciliation cannot prove that an old Cloud Run revision, trigger delivery or retry has stopped. Keep deployment and drain evidence with the candidate. The current rules retain compatibility with existing booleans during preparation; compatible stored booleans alone do not prove current block enforcement.

Prepare a private inventory from a verified export of the staging project's **`presenceVisibility` subtree**. Include every existing directed viewer/target pair, including denied and versioned entries. Preserve the exact Firebase UIDs; do not substitute native Facebook/Reddit player IDs or derive identities in the browser. Convert the pairs to JSON objects with exactly `viewerUserId` and `targetUserId`. Do not include permission values, revisions, timestamps, profiles or entitlements. Keep the file outside the checkout, with owner-only file permissions. Files may contain at most 5,000 unique pairs and 2 MiB; larger exports need separate inventories. Record which export and scope each inventory covers, and verify that their union covers the intended export. The tool does not assert global coverage.

Build the server once:

```bash
pnpm --dir firebase-functions build
```

Preview one bounded page, replacing the project, verified default-database URL and private input path:

```bash
node firebase-functions/scripts/run-with-functions-node.js \
  firebase-functions/scripts/presence-visibility-reconcile.js \
  --project YOUR_PROJECT \
  --database-url https://YOUR_PROJECT-default-rtdb.YOUR_REGION.firebasedatabase.app \
  --input /absolute/private/presence-pairs.json --offset 0 --limit 20
```

Preview reads the selected stored permissions and returns counts, the input SHA-256 and a cursor. It performs no Firestore mutation, operation-lease acquisition, RTDB write or Auth operation. It inventories scope; it does not predict authorization at the time of a later apply. Verify the explicit project and URL, inventory scope, hash and counts before proceeding. A URL for another project, URL credentials, unknown or duplicate options, invalid identities, duplicate pairs, oversized input and inconsistent emulator settings fail before SDK initialization.

Apply the **same previewed offset**, using its exact hash:

```bash
node firebase-functions/scripts/run-with-functions-node.js \
  firebase-functions/scripts/presence-visibility-reconcile.js \
  --project YOUR_PROJECT \
  --database-url https://YOUR_PROJECT-default-rtdb.YOUR_REGION.firebasedatabase.app \
  --input /absolute/private/presence-pairs.json --offset 0 --limit 20 \
  --apply --confirm-project YOUR_PROJECT --expect-sha256 PREVIEW_SHA256
```

Apply recomputes current authorization through the production mirror; the inventory never authorizes a grant. The server checks the current relationship, both players' blocks and existing account-deletion guards. An irreversible deletion guard with no older active operation permits removal of only this directed permission and its reverse cleanup hint. An active operation, including one whose diagnostic expiry is old, remains a blocker until it actually drains. The CLI never disables Auth, deletes a user, removes relationships, changes consent or changes another permission. A corrupt stored revision requires investigation and stops writes for that page.

Use the apply result's `nextOffset` for the next page, keeping the input file/hash unchanged. A busy owner's unfinished entry does not advance the cursor; wait for the existing operation to finish and retry that offset. If an SDK failure interrupts a page, the generic failure output exposes no player IDs or provider diagnostics: retry the same offset because successful partial refreshes are idempotent. Save every apply result from offset zero through the end of each inventory. `reachedInventoryEnd` reports position; it does not prove preceding pages ran. `globalCoverageVerified` and `oldWritersDrainedVerified` remain false because those require separate evidence.

After reconciliation, verify hosted consenting-rival reads, bilateral block revocation, unblock, active observer cancellation, account-wide opt-out, account deletion and delayed trigger delivery. Check both Facebook and Jest realtime clients; Reddit's signed server polling continues checking current Firestore blocks independently. Pair deletion must preserve the permanent deletion guard and unrelated state. Record hosted roles, rule/backend revisions, inventory coverage and all page results before accepting this gate. No hosted reconciliation has been performed by this chat.

For local proof, see [the emulator and CLI evidence](evidence/presence-visibility-reconciliation-2026-10-03.md). The operator wrapper selects the repository's pinned Node 22 runtime. An optional `pnpm --dir firebase-functions presence:reconcile -- ...` invocation builds first; repeated page calls should use the already-built wrapper above.
