# 0006: Server-confirmed live guess receipt lookup

Status: Implemented and verified locally. Private proofs, authenticated lookup, target adapters and receipt-bound client recovery are complete. Strict fallback remains active for missing or unconfirmed proof. No deployment has been made.

## Problem and traced ownership

LiveRaceGame owns one stable request ID for each submitted guess and permits independent input while its receipt is pending. The server accepts guesses and creates `liveRaceMatches/{matchId}/requests/{requestDocumentId(userId, requestId)}` inside the same Firestore transaction. Existing receipts contain authenticated user ID, an input binding hash and expiration; they do not identify an accepted attempt version. Duplicate requests verify that hash and do not score again.

The local checkpoint currently binds account, ticket, run, locale, riddle, position and accepted-guess count. Reload cannot preserve independently composed input across a count change because it cannot distinguish the original pending submission from a different command that consumed the saved word. A local marker failed the consumed-word/failed-clear regression and was removed.

LiveRaceViewSchema and RaceConfirmedGuessSchema are strict. The installed runtime probe accepts existing requests/responses but rejects unsolicited receipt fields and new request opt-in fields. Adding a response field without negotiation would break older clients. An opt-in field requires a server-first deployment and fallback for older request validators.

## Decision

Add a separate authenticated read-only receipt lookup as an optional live transport capability. Keep existing join/update inputs and live views unchanged. Missing capability, unavailable endpoint, missing/legacy receipt, malformed response or timeout retain strict recovery behavior. No normal start, poll, guess, hint or skip depends on this endpoint.

Implemented target-neutral contract:

```ts
type LiveGuessReceiptQuery = {
  ticketId: string;
  requestId: string;
  riddleId: string;
  position: number;
  guessesUsedBefore: number;
};
type LiveGuessReceiptResult = {status: "accepted" | "unconfirmed"};
interface LiveReceiptCapability {
  confirmGuessReceipt?(query: LiveGuessReceiptQuery): Promise<LiveGuessReceiptResult>;
}
```

The browser does not supply an account ID. Authentication selects the owner. The endpoint checks account deletion/access, ticket ownership and its actual match, then reads the user-scoped receipt. It never joins, renews a live-seat lease, advances bots, scores, settles rewards or retires a seat. The request must remain strictly bounded.

For new accepted wrong guesses that retain the same question, record a private proof in the existing receipt transaction: ticket, riddle, position, accepted count before and accepted count after. The proof must show exactly one attempt advance. Hints, skips, correct/auto-skipped guesses and pre-proof legacy receipts cannot provide this same-question recovery proof. Duplicate command replay leaves the original receipt immutable. No backfill may invent missing historical attempt identity.

Only independently composed post-submit input may carry a receipt locator in local presentation storage. Store the original request identity needed for lookup, not a command/action/payload or a replay instruction. The locator and current checkpoint still bind the original account, seat, run, language and question. Normal exact-count recovery needs no query. For a one-count advance, restore only if this specific original guess is confirmed and the owned canonical run still remains at that exact accepted attempt. Historical acceptance alone cannot authorize recovery after a later guess or question change. Another instance's accepted request cannot satisfy it, even if the words are identical.

A rejoin recovery query must have a finite deadline and share the mounted journey's cancellation/receipt ownership. Check ownership again after awaiting it. It must not overwrite newer local editing, a changed authoritative question, a replacement account or another writer's storage revision. The initial implementation should resolve eligible proof before publishing the initial recovered draft, avoiding an asynchronous overwrite of newly composed input. Missing proof drops only the ambiguous draft, never authoritative progress. Restored cells carry a transient recovery version. If a fresh authority observation advances the accepted attempt before the player changes any letters, discard those untouched cells and retain only confirmed hint locks. Cursor movement alone is not new answer intent. This also protects against a competing acceptance after the read-only proof snapshot.

## Alternatives

- Local post-submit boolean: rejected by the executed consumed-word regression.
- Add proof to every live view/confirmed guess: rejected for existing strict-response compatibility.
- Add negotiated proof to join/update: viable with explicit capability negotiation, but introduces mixed-version request handling into every live transport. A separate optional read isolates the compatibility boundary and adds work only for eligible reload recovery.

## Module changes

- Core: bounded query/result schemas and optional live capability; existing live schemas stay unchanged.
- Backend: private accepted-wrong-guess proof on immutable request receipts, read-only lookup service, authenticated callable export.
- Jest/Facebook: lazy function wrapper and the shared Firebase live adapter.
- Reddit: same-origin `/api/game/race.live.receipt` adapter path, Devvit allowlist and approved Firebase gateway operation/response validation. The browser receives no Firebase SDK. The lookup must be classified as read-only; replay caching must not freeze an unconfirmed observation.
- UI/checkpoint: bounded receipt locator, canonical binding verification and cancellation-safe optional recovery; no automatic command replay.
- YouTube/Netflix/Yahoo: no live capability or provider SDK added; artifact isolation remains required.

## Verification requirements

Use actual Firestore SDK tests to prove atomic receipt creation, exact request identity, immutable retries, no proof for wrong scope/other users/deleted accounts/legacy or non-guess receipts, and zero canonical game/economy writes on lookup. Browser tests must prove held accepted-wrong recovery and the failed-clear consumed-word counterexample, plus typing, hints, question changes, account replacement, retirement, storage denial, competing writers and lookup timeout. Preserve the zero-read unchanged-checkpoint behavior. Run client/backend suites and static checks, all six isolated builds plus Devvit, and rendered target checks before handing off the implemented change.

Compatibility probe: `artifacts/live-guess-receipt-contract-2026-10-09/compatibility.json`. The contract is grounded in current source and runtime validation. Backend proof and lookup evidence is recorded in `docs/common/hosted/evidence/live-guess-receipt-proof-2026-10-09.md` and `docs/common/hosted/evidence/live-guess-receipt-lookup-2026-10-09.md`. Adapter evidence is recorded in `docs/common/hosted/evidence/live-guess-receipt-adapters-2026-10-09.md`. No deployment has been made.

Client implementation and verification: `docs/common/hosted/evidence/live-guess-draft-receipt-recovery-2026-10-09.md`.

Concurrent acceptance follow-up: `docs/common/hosted/evidence/live-receipt-concurrency-fix-2026-10-09.md`.
