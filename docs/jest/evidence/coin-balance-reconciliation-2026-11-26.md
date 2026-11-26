# Sandbox coin balance reconciliation — 26 November 2026

The reported 18,295-coin balance came primarily from sandbox checkout grants. Read-only Jest transaction records, the matching Firebase account, eight completion receipts and retained solo sessions established the source of the spike. No duplicate gameplay award was found in the inspected records or settlement paths.

## Confirmed grants

| Source | Coins |
| --- | ---: |
| Starter sandbox purchase on 22 November | 250 |
| All six sandbox packs on 26 November, 17:23–17:28 UTC | 13,700 |
| Premium grant recorded at initial account setup on 22 November | 3,400 |
| Total test grants | **17,350** |
| Balance before correction | **18,295** |
| Balance after removing test grants | **945** |

Jest identified all seven product transactions as sandbox purchases with zero charge. The six current pack grants are 250, 550, 900, 1,600, 3,400 and 7,000. The account's `premiumCoinsGrantedAt` records its initial 3,400-coin grant. Purchase testing exercises the ordinary authoritative grant path, so these credits persist in the sandbox player's saved game.

The solo receipts total 520 coins across six Classic wins and two Daily wins. Their recorded balance increased from 4,560 after Classic 5 to 18,295 after Classic 6: exactly 13,700 in pack grants plus the final 35-coin completion. Retained sessions also show one 25-coin hint and two 50-coin continues. Starting coins (300), solo receipts (520) and spending (-125) explain 695 of the retained 945. The remaining 250 is consistent with the saved three multiplayer wins (150 under current rules), three race achievements (75) and first-purchase achievement (25); historical race receipts were not individually reconciled. The correction retains all existing achievement rewards, including purchase-related unlocks.

The account was matched through Jest's player lookup and the deterministic server identity mapping. Player identifiers, purchase tokens and active session secrets are intentionally omitted from this repository evidence. The authoritative adjustment is retained on the affected account at `economyAdjustments.sandbox20261126`.

## Approved correction

The owner confirmed that the matching account was theirs and explicitly approved removal of 17,350 test coins. At 18:57:21 UTC, the account balance and adjustment record were updated atomically with a Firestore document-version precondition. A stale initial precondition rejected the first write without changing the balance; a fresh read allowed the correction. The adjustment record stores the delta, before/after balances, reason, grant breakdown and approval context.

Purchase replay receipts, Premium's last-grant timestamp, progression, achievements and subscription entitlement were preserved. The retained timestamp prevents an immediate Premium regrant. An active subscription can still receive its next scheduled grant after 30 days, and another sandbox purchase will grant its advertised coins. This correction does not cancel Premium or change paid product values.

## Economy assessment

The [shared economy](../../common/core/game-economy.md) remains generous: Classic pays 25/40/60, Daily pays 75/100/125 plus streak rewards, and hints/continues/skips cost 25/50/100. A player who rarely spends will accumulate coins. Ten easy Classic wins and an early-streak easy Daily produce 335 coins before level and achievement bonuses; spending on five hints, one continue and one skip consumes 275, leaving a 60-coin surplus before bonuses. This illustrates the intended optional-help economy, not measured typical player behavior.

945 coins can fund 37 hint letters, 18 continues or 9 skips, as alternatives. 18,295 could fund 731 hints, but 94.8% of that balance was from test commerce. This report therefore does not justify a global reward reduction or wallet cap. Keep purchase acceptance and ordinary economy playtesting on separate sandbox accounts, then evaluate earnings and spending on accounts without checkout grants before tuning rewards. Preserve legitimately purchased value and committed reward receipts.

## Verification

The correction was read back from Firebase after the write. No tests, browser harnesses, game builds, deployments or provider publication were needed for this account-data correction. Existing unrelated source edits were left untouched.
