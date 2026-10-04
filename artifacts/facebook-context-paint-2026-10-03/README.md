# Facebook context screenshot verification

See [the corrected evidence report](../../docs/evidence/facebook-context-capture-check-2026-10-03.md).

`stored-baseline.log` unexpectedly passes: the supposed missing board exists in the saved PNG. `stored-repaint.log` passes too. `stored-capture-hashes.log` proves the original, repaint and earlier diagnostic full-page images are byte-identical. Those results disprove the earlier browser-capture inference.

`facebook-chooser-only-browser.log` and `facebook-full-sdk-browser.log` are fresh full injected journeys after removing repaint instrumentation. Their owned screenshots pass `chooser-only-pixels.log` and `full-sdk-pixels.log` and share the hash in `fresh-capture-hashes.log`.

The probe is read-only:

```sh
python3 artifacts/facebook-context-paint-2026-10-03/diagnostic/paint_probe.py \
  artifacts/facebook-context-paint-2026-10-03/screenshots/chooser-only.png \
  artifacts/facebook-context-capabilities-2026-10-03/screenshots/chooser-only-context-board.png.json
```

It uses locally available Pillow, reads only synthetic fixture image/geometry and writes no image. No runtime dependency, deployment, provider mutation or real player message is introduced.
