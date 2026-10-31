# Frontend reward explanation amendment

The victory modal now explains a coin award with the nonzero components of its authoritative completion receipt. It retains the existing chest, automatic grant and Next action. Classic and Daily base rewards have separate translated labels. Root added the six labels to all 16 locales.

No bonus is inferred from achievement IDs, level changes or local projections. The display parser derives its type from the core completion contract and requires safe whole-coin amounts whose components equal both receipt totalAwarded and coinsEarned. It narrows unknown fields without casts and constructs a fresh canonical typed receipt. Canonical transport validation remains unchanged. Absent, incomplete, malformed, array-shaped, zero-reward and non-winning receipts have no itemization.

The current completion owner controls admission. Receipt replacement clears prior details, a new question or account clears the reward record, and recovery validates persisted itemization before it can re-enter presentation. Rendering additionally requires an acknowledged win. Matching replay retains the same components without applying the historical newBalance to the wallet. The chest uses the latest profile balance when present. Signed component amounts use an isolated left-to-right element in Arabic.

Changed runtime files:

- packages/portal/src/play/completionRewardBreakdown.ts
- packages/portal/src/play/gameSessionTypes.ts
- packages/portal/src/play/gameSession.ts
- packages/portal/src/play/types.ts
- packages/portal/src/play/useGameMessageRouter.ts
- packages/portal/src/play/modalPages/fanfare/VictoryModalContent.tsx
- packages/portal/src/styles.victory.css

Behavior coverage was added to VictoryModalContent.test.tsx, useGameMessageRouter.test.ts and gameSession.test.ts. It covers Daily and Classic labels and exact component amounts, optional and zero bonuses, provisional withholding, malformed and fractional values, replay, newer wallet preservation, legacy replacement, zero-reward replacement, question/account changes and persisted recovery validation. Canonical-schema drift checks derive every required field from the actual schema and compare missing/negative fields, optional referrals, fractional display admission and arrays carrying named receipt properties.

Validation completed against the current source:

- Final full portal unit/component run: 320 suites and 3,326 tests passed. See portal-unit-results.json and portal-unit.log. This is a fresh full run on the frozen final source, not a union of earlier runs. The three receipt/state/router files contribute 207 cases to this run.
- Production TypeScript check passed. See reward-typecheck.log.
- Direct TypeScript check of the three touched test files passed. See reward-test-typecheck.log.
- Comprehensive TSDoc audit and scoped git diff whitespace check passed. See reward-tsdoc.log.

Root owns the combined Jest build and upload. The platform agent owns independent rebuilt-artifact checks for narrow screens, long translations, Arabic and the retained Next action. Those artifact results are separate from the source validations above.

## Packaging and startup budgets

The final display parser has no runtime import of Zod or the validation barrel. Zod was absent from the previous startup graph. A canonical schema leaf still added 93,518 bytes of Zod plus 3,567 bytes of schema code to initial resources, so the final parser uses the schema-derived type and its tested synchronous cosmetic admission checks. No additional asynchronous recovery lifecycle was introduced, and no Vite schema alias remains.

A Jest-only build transform in webTargetViteConfig.ts compacts whitespace inside marked Three GLSL templates. It preserves comments, diagnostic line counts, directive spacing, and LF/CRLF continuation lines. It leaves other JavaScript and all other targets unchanged. The five node checks in scripts/jest-shader-indentation.test.mjs pass, including every exported shader token stream across all 128 installed modules. See shader-behavior.log.

Paired isolated builds measured 4,725,831 bytes before shader compaction and 4,717,886 bytes afterward, a saving of 7,945 bytes. Binary assets, stylesheets and license notices were byte-identical. See shader-packaging-results.json and shader-packaging.log. Shader program tokens and visual content were unchanged.

The subsequent tiny-parser probe passed audit-jest-artifact.mjs with 419 files, 4,717,274 total bytes and 576,151 initial bytes, inside the unchanged 4.5 MiB total and 0.55 MiB initial budgets. That isolated probe preceded only the array-shape rejection guard. Root's canonical build verifies the exact final frozen source. See schema-scope-audit.log; schema-scope-results.json retains the earlier failed leaf-schema comparison as diagnostic evidence.

Final production and focused test TypeScript checks, comprehensive TSDoc and scoped whitespace checks pass. The platform agent owns actual native WebGL compilation, linking and rendered-scene checks on root's immutable canonical artifact.
