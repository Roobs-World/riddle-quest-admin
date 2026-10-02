# Coin economy

The solo economy is defined in `packages/core/src/game/economy.ts`. Server gameplay, the injected commerce harness, and the self-contained YouTube, Netflix and Yahoo clients use the same rules.

## Earning and spending

| Authored difficulty | Classic base win | Daily base win |
| --- | ---: | ---: |
| Easy or legacy content without a rating | 25 | 75 |
| Medium | 40 | 100 |
| Hard | 60 | 125 |

| Action | Coin price | Easy Classic wins needed |
| --- | ---: | ---: |
| Reveal one hint letter | 25 | 1 |
| One extra attempt | 50 | 2 |
| Skip a Classic riddle | 100 | 4 |

Action prices are stable across difficulties and player levels. More difficult content pays more without making help more expensive. A hint-assisted easy win can recover the hint's cost; medium and hard wins leave a surplus after one hint. Continuing costs more than a hint because it restores an attempt after the normal limit. Skipping costs more than continuing because it advances progression immediately. Skips and losses grant no win coins.

The initial balance stays at 300. Existing level-up (50), eligible achievement (25), referral, multiplayer and Daily streak rewards retain their rules. Hint-use achievements remain non-paying. Daily streak bonuses are additive, increase by 20 every seven consecutive wins, and remain capped at 300. These are separate bonuses, not part of the difficulty reward.

Difficulty comes from canonical content. Server sessions pin it when issued; completion uses that private snapshot rather than caller input. Completion receipts retain their committed reward across retries. Missing or malformed ratings receive the easy reward, including existing sessions without a rating. New server-generated riddles preserve the independent quality review's rating through storage. The authoring pipeline retains its existing policy of rejecting unfair hard candidates; approved imported hard content can still receive the hard reward.

## Shop value

Existing bundle amounts and product IDs are retained. Halving all three action prices doubles every pack's gameplay purchasing power. The price ladder below provides progressively better value as bundle size increases; tests enforce that relationship separately for USD and Reddit Gold. [Deployed verification on 2 October 2026](evidence/coin-economy-deployed-verification-2026-10-02.md) found that Jest still used older provider prices and updated its six existing products to this USD ladder. The latest active Jest build displays the corrected catalog.

| Pack | Coins | Configured USD default | Reddit Gold | Hints **or** extra attempts |
| --- | ---: | ---: | ---: | --- |
| Starter | 250 | $0.99 | 50 | 10 or 5 |
| Small | 550 | $1.99 | 100 | 22 or 11 |
| Mid | 900 | $2.99 | 150 | 36 or 18 |
| Large | 1,600 | $4.99 | 250 | 64 or 32 |
| Huge | 3,400 | $9.99 | 500 | 136 or 68 |
| Mega | 7,000 | $19.99 | 1,000 | 280 or 140 |

The action counts are alternatives that each spend the entire pack. The shop calculates them from the actual provider coin grant, using whole purchasable actions. Its explanatory copy is translated in all 16 supported locales. Platform catalogs remain the authority for displayed regional prices and checkout. This change does not change signed receipt grants, fulfillment idempotency, subscriptions or provider settings.

## Validation and tuning

The balance is a starting policy grounded in the game's existing coin scale, rather than a claim about observed player behavior. Track hint usage, continued-win rates, coins earned/spent per completed riddle, depleted balances and bundle conversion by authored difficulty before further tuning. In particular, assess whether players using multiple hints can replenish their balance through ordinary play.

Tests cover conservative difficulty fallback, increasing rewards, action price ratios, pack purchasing power, increasing bundle value, server-only difficulty, immutable session difficulty, generated-content metadata and replay-safe settlement. Injected browser checks cover the rendered shop and coin actions at mobile and desktop widths. Build and artifact audits cover all six supported targets.

Deploy the client artifacts and backend economy together so displayed costs and authoritative charges agree. Existing balances and old completion receipts require no migration; unrated legacy content continues using the easy reward.
