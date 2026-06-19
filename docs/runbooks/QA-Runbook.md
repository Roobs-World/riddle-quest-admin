QA Runbook — Android emulator & provider-auth evidence

Purpose: Steps to collect the evidence needed by the QA checklists (provider-auth UID/snapshots, modal screenshots, Coin Shop flows, rewarded-ad callbacks).

Prerequisites

- Android SDK / AVDs installed and configured
- `adb` on PATH
- `pnpm` and project dependencies installed
- App build that can be installed on emulator (debug or QA build)
- Staging/production-like ad IDs and billing credentials (set in `.env` or CI secrets)

Quick commands

- Install dependencies:

  pnpm install

- Run the emulator matrix test (existing project task referenced in docs):

  pnpm run test:android:matrix

- Install APK on emulator (replace path/device id):

  adb install -r android/app/build/outputs/apk/debug/app-debug.apk

Evidence collection (manual)

- Capture screenshots:

  adb shell screencap -p /sdcard/screen.png
  adb pull /sdcard/screen.png ./evidence/screen-<name>.png

- Capture logs:

  adb logcat -d > ./evidence/logcat-<name>.txt

- Capture Firebase/Backend deltas:
  - Use Firebase console or an admin script to export (before/after) snapshots for the test UID. If you have service account JSON, use Firebase Admin SDK locally to read relevant documents and write JSON snapshots.

- Rewarded ad / billing verification:
  - Ensure `GOOGLE_MOBILE_ADS_*` or `ADMOB_*` are set in `.env` and app rebuilt.
  - Trigger rewarded ad path (loss popup or configured placement) and capture logs/screenshots for load, show, completion, and callback processing.

Where to store artifacts

- Place matrix screenshots, logs, and JSON snapshots under `device-matrix-test/DD-MM-YYYY/<device>/images/` and `device-matrix-test/DD-MM-YYYY/<device>/logs/`.
- For non-matrix evidence, keep using `docs/evidence/` or the existing issue-specific archive paths and reference them in the issue checklist.

Next steps for a teammate with credentials

- Provide a disposable provider-auth account or test credentials and set them up on an emulator device.
- Provide staging ad IDs / billing sandbox credentials and populate `.env` accordingly.
