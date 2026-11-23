# Preview isolation browser and startup-budget checkpoint

The eager isolation implementation passed 64 real React lifecycle browser cases and 352 assertions across Chromium/Firefox, development/production and widths 390/1280. Coverage included successful and failed previews, a held canonical load, a 15-second optional deadline and late settlement, account/provider retirement, canonical supersession and the 250 ms automatic recovery target. These results are retained in `artifacts/solo-skip-preview-recovery-isolation-fix-2026-10-09/`.

The six-target build sequence stopped at the Jest startup-size gate. The first implementation and initial lazy split both exceeded the unchanged 0.55 MiB initial-resource budget. Optional preview delivery and eligibility now live in a deferred `loadOptionalSkipPreview` module. Origin, canonical delivery and account lifetime are captured before import and rechecked before provider admission and publication.

The latest Jest output has 577,044 initial resource bytes against a 576,716.8-byte budget: 327.2 bytes over. The previous verified cohort used 576,392 bytes. The budget was not relaxed. Exact measurements are in startup-budget-lazy.json; failed build logs are retained separately. Required next work is to reduce startup code further and rerun the entire final verification cohort.

The deferred implementation passes all 40 focused lifecycle/recovery tests and TSDoc. Build TypeScript compilation succeeds before the size gate. A retained-provider test was updated to wait for provider admission after dynamic import; its earlier timeout is retained in focused-lazy.log. The full 3,214-test pass and browser results predate the deferred split and are not claimed as verification of that final version.

No jobs remain live. The owned `/tmp/solo-skip-preview-recovery-isolation-fix-builds-20261009a` directory remains for continuation and contains the current Jest output. Other target builds, final rendered checks, whole hosted Skip verification and final source manifests remain incomplete. Nothing was deployed or published; the broader goal remains active.
