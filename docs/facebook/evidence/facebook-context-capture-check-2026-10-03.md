# Facebook context capture check — 3 October 2026

The retained Facebook screenshots contain the expected context board. The earlier report of incomplete browser painting was based on an unreliable image preview, not a failing saved PNG. No application rendering defect is established by those captures.

## Authoritative evidence

- The original chooser-only, full-SDK, viewport-repaint and earlier diagnostic full-page PNGs all have the same SHA-256: `ff9dd9fcb1d189ed481e3e6f9b241e29872f98e734d82ecea204117d5833988d`. Thus the previews that appeared different did not correspond to different saved pixels.
- A read-only Pillow probe inspects the existing light context panel using the retained, bounded DOM geometry. **94.78%** of its interior pixels are light, above the probe's 50% requirement. Both original and repaint captures pass; the supposed baseline does not fail. The probe also checks one visible screen, opacity and exact fixture palette. It does not modify an image or application state.
- The image-view tool returned these PNG bytes with a `data:application/octet-stream` prefix. Forwarding the unchanged data with the correct `image/png` MIME type showed the complete French Activity header, context result and history panel. This identifies a preview-path discrepancy; it does not establish the upstream cause.
- After removing the unnecessary frame waits, animation override, diagnostic logging and viewport repaint from the browser helper, **both fresh Facebook browser variants pass**. Runtime assertions retain the exact chooser-only/full-SDK inventory, and the actual target adapters still verify context synchronization, new standings, repeated-dialog exclusion and overlay cleanup. Fresh PNGs again have the same hash and pass the pixel probe.
- Portal types, TSDoc, file-size and whitespace checks pass. This cleanup changes only the test harness; application behavior and all other platform adapters are untouched. The preceding [capability evidence](facebook-context-capabilities-2026-10-03.md) retains the all-six isolated build/audit, Reddit and selected Jest regression results; those broader checks were not rerun solely for harness cleanup.

The pixel diagnostic and logs are in `artifacts/facebook-context-paint-2026-10-03/`. Pillow is used only by that local read-only diagnostic and adds no runtime or package dependency. Explicit per-variant screenshot paths remain so evidence belongs to the test that created it.

## Review limits

The claimed intermittent Chromium capture defect is withdrawn. Real Meta role/device rendering acceptance remains unverified independently of this preview discrepancy. No settings, feature switches, deployment, publication or player messages were changed. The shared checkout still changes concurrently; this evidence does not certify an atomic release commit or deployed-source equivalence.
