# Easier multiplayer race release — 2026-09-28

- Firebase project: `riddle-quest-ec2b2`
- Deployment: `firebase deploy --only functions --project riddle-quest-ec2b2 --non-interactive`; 62 Node.js 22 functions updated, zero errors.
- Source: `firebase-functions/content/race-en-reviewed-v2.json` (SHA-256 `e4ed372c49ed6a6d7f98f583549f86f192b6b5eec9890fe92b721b59cdfe4ef1`). It replaces ten medium-band riddles in each of six English categories with simpler prompts and answers.
- Firestore import: 180 target records written and 60 old records retired from race selection. Owner-only backup: `firebase-functions/artifacts/race-content-backups/race-content-riddle-quest-ec2b2-2026-09-28T22-37-38-764Z.json`.
- Preflight: 92 Functions suites and 1,028 tests passed, followed by successful type, lint, export, and build checks.
- Artifact checks: Jest, Facebook, Reddit, YouTube, Netflix, Yahoo, and the Devvit package builds passed their audits.
- Live verification: six English categories each have 30 eligible riddles with no validation issues; 60 eligible records carry `reviewed_v2`. A new history deck contains 10 easy and 5 new medium riddles, with no hard riddles. A previously published challenge resolved all 15 riddles, including five now retired from new-race selection.
- Scope: English race content only. The other supported locale pools were not changed.

The local legacy `firebase-functions/.env` contains reserved `FIREBASE_*` keys that the Firebase CLI rejects for deployment. It was held in a private temporary directory during upload and restored afterward with its original `0600` permissions; the validated project deployment environment remained in place.
