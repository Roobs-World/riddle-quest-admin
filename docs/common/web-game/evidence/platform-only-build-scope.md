# Platform-only HTML5 build scope

30 September 2026 user requirement: support platform-specific HTML5 browser targets
and exclude all standalone web/PWA builds.

Removed standalone web/PWA deployment commands and their deployment implementation.
Removed Microsoft Store PWA, PWA Directory and PWAStore.io from the canonical release
registry, packaging and browser verification. Removed the PWA package implementation.
Combined release commands and CI handoffs enumerate only the remaining destinations.
The former generic HTML5 release command is now `prepare:html5-handoffs`: an audited
shared source input for named distributions such as itch.io, rather than a hosted
standalone release. `build:web` remains the Jest/Facebook/Reddit aggregator.

The dashboard retains historical receipts and links with explicit exclusions and no
scheduled build/submission work. Historical submission refresh and release automation
both apply the scope restriction, preventing an old live receipt from reopening work.
Existing external deployments and listings were not changed.

Verification: 25 release tests and 11 dashboard content tests passed. Public release
and distribution interfaces reject all five excluded target names before dispatch.
Historical live-receipt refresh preserves evidence and leaves action queues excluded.
All seven isolated artifacts passed their build and dependency audits: Jest, Facebook,
Reddit, YouTube, Netflix, Yahoo and GameSnacks. File-size and TSDoc checks passed, and
the dashboard was rebuilt using the installed Data App compiler.

This scope change does not close the continuing multiplayer reliability goal or
establish provider publication. The development task receipt records its verification
separately from historical submissions.
