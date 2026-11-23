# Shared solo controllers

Shared local gameplay authority lives in `src/gameplay/local`, with persistence in `src/gameplay/persistence`. Content, economy, achievements, and copy live in their corresponding feature folders. Their [evidence](evidence/) covers saved progress, journals, paid actions, recovery and controller ownership.

Read the [domain glossary](../core/CONTEXT.md), [game economy](../core/game-economy.md), and [solo architecture decision](../architecture/adr/0003-bounded-provisional-solo-play.md) for the gameplay contracts. Android integration follows the [parity plan](../../android/android-parity-plan.md).
