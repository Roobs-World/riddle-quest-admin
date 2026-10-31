# Project issue fixes, 22 October 2026

This pass reviewed the current dirty workspace, GitHub issues, Jest feedback, dependency audits, and static project checks. GitHub had no open issues and Jest had no open player reports. Existing uncommitted work was preserved.

## Gameplay fixes

- After five failed guesses, purchasing coins from the Continue prompt could replace the blocking shop with nonblocking reward tabs. Editing and submitting then admitted an unpaid sixth guess. A shared attempt-budget guard now protects editing, drafting, reducer admission, and submission. A confirmed Continue permits the sixth attempt. Receipt reconciliation remains available after the final attempt.
- The first-riddle tour could promote the coin shop before the player had won a riddle, contrary to the latest Jest moderation feedback. Coin-shop guidance now requires a previous win. Existing contextual guidance introduces it after that win. The Daily exit and multiplayer tour steps remain available according to target capabilities.
- Added purpose-specific TSDoc to 311 missing declarations without changing the documentation policy. The new guidance guard also has a documented declaration. No new visible text or translation keys were added.

## Verification

Direct TypeScript checks passed across the workspace. Backend ESLint, TSDoc, file-size, target-boundary, locale, security configuration, CI security, function capacity, scalability, modern-package, and whitespace checks passed. The bundled content audit passed for 16 locales and 180 riddles per locale.

Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, and GameSnacks artifacts built successfully. Their artifact audits passed. Reddit's staged client, server build, and package contract also passed.

The ordinary aggregate type-check command unexpectedly invoked one module-cycle test through Firebase's `precheck:types` hook. That test passed. Subsequent checks and builds used direct commands to avoid test hooks. No game tests or browser harnesses ran during this pass. Gameplay and purchase verification on the hosted game remains outstanding.

Updated existing guidance assertions and added regression cases for exhausted input during purchase rewards, the granted sixth attempt, and final receipt reconciliation. These test sources passed targeted TypeScript checking but were not executed.

The initial build could not write pnpm's external SQLite license index under the sandbox permissions. A private copy of the index under `/tmp` allowed license inventory reads without changing project code or the external store. Third-party notices passed their consistency check.

## Dependency audit

The dependency review found additional vulnerable transitive packages in both the workspace and the independent Firebase deployment lockfile. The deployment lock included the critical [proxy-addr IP-spoofing advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). The workspace also included advisories for Vite and MCP tooling. Patched dependency resolutions and final audit results are recorded with this pass's artifacts.

Updated Vite to 8.3.3, MCP SDK to 1.32.0, MCP client/server to 2.3.0, busboy to 3.2.2, grpc-js to 1.14.5, and compatible transitive HTTP/parser dependencies. Both lockfiles agree on the security overrides. Frozen workspace installation, Firebase production installation dry run, and all four direct TypeScript checks passed after installation. The seven target artifacts were rebuilt and audited again with these dependencies.

Firebase's production npm audit now reports zero vulnerabilities. The workspace's high-severity audit gate passes. Its metadata retains three pre-existing high findings covered by the existing reviewed local patches and audit exceptions. Those patches and exceptions remain intact; this pass added none.

Two moderate advisories remain visible:

- [sprintf-js precision handling](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) has no published patched version. The registry rejects the 1.1.4 version suggested by its audit response. Existing uses come through tooling dependencies; the game has no direct import.
- [OpenTelemetry baggage allocation](https://github.com/advisories/GHSA-8988-4f7v-96qf) remains in the development Firebase CLI's Pub/Sub dependency. The current CLI requires Pub/Sub 5.x, which uses OpenTelemetry 1.x. The fixed core is 2.8.0 or later. Forcing that major into its 1.x consumers would bypass the parent contract.

The [final workspace audit](../../artifacts/project-issue-fixes-2026-10-22/riddle-dependency-audit-all-final.json) and [clean Firebase production audit](../../artifacts/project-issue-fixes-2026-10-22/riddle-functions-npm-audit-production-final.json) preserve the results. Backend dependency fixes are local and have not been deployed.

## Provider limitation

Jest's [subscription contract](https://docs.jest.com/sdk/html5/subscriptions) guarantees signed entitlement data, audience, and subject. Additional freshness claims such as `iat` are optional, and the documented contract does not provide a server-authoritative current-entitlement lookup. A historical active snapshot without freshness data cannot be distinguished from a current one solely by verifying its signature. Requiring optional claims would reject valid provider payloads. This existing limitation remains unresolved and needs a provider freshness or lookup contract. See also the earlier [subscription audit](jest-api-alignment-2026-10-18.md).

## Jest upload

The final build `1.0.0-dev.20261022-issue-security`, version `01a160c9-0dd3-763f-94aa-cfd010b879ee`, completed processing with status `ready`, no processing error, and `isActive: false`. Open the [exact inactive preview](https://jest.com/g/riddle-q?versionId=01a160c9-0dd3-763f-94aa-cfd010b879ee).

The final archive SHA-256 is `19dbd2cd8d1d865f1d61e80bda9efdde7febd68fbb15ae813a810d2e33a8f8fe`. [Build metadata and source hashes](../../artifacts/project-issue-fixes-2026-10-22/build-info.json) identify the local inputs. The earlier gameplay/documentation build also completed processing successfully.

No build activation, publication, review submission, or backend deployment was performed. The previously active 20 October build remains active. Existing uncommitted work and these fixes remain in the workspace.
