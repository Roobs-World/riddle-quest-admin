# Credential Rotation Runbook

Last updated: 2026-08-12

## Scope

This repository is a Jest HTML5 game and Firebase backend. It has no Apple,
Facebook, native-store, or external-auth production credential path.

Rotate every private credential that appeared in tracked local configuration or
was exposed outside its intended owner-only boundary:

- Firebase Admin service account key from `firebase-functions/qwordly-admin-sdk.json`
- Values from tracked `.env`
- Values from `firebase-functions/.env.default.backup`
- Values from `firebase-functions/.runtimeconfig.json`
- The Jest shared secret and game-upload token
- The OpenAI API key
- Any Sentry source-map upload token
- Any Firebase App Check debug token used for sandbox automation

Treat all historical values as compromised.

## Rotation Steps

1. Firebase Admin service account key
   - Open Google Cloud Console IAM and Admin > Service Accounts.
   - Find the Firebase Admin SDK service account for the project.
   - Disable and delete the exposed key.
   - Create a replacement key only if a local administrative script still requires one.
   - Store any replacement key outside the repository.

2. Firebase Functions secrets
   - Rotate and set the two server-only values used by this release:

```sh
pnpm dlx firebase-tools@15.25.1 functions:secrets:set JEST_SHARED_SECRET --project riddle-quest-ec2b2
pnpm dlx firebase-tools@15.25.1 functions:secrets:set OPENAI_API_KEY --project riddle-quest-ec2b2
```

3. Jest release credentials
   - Rotate the Riddle Quest upload token in the Jest Developer Console.
   - Store the replacement only in the owner-only external credential file
     documented in `docs/jest-html5-operations.md`; require mode `0600`.
   - Keep `JEST_UPLOAD_IS_ACTIVE` and `JEST_CONFIRM_ACTIVATION` out of that
     persistent file. Activation intent belongs only on one deliberate command.

4. Sentry and sandbox credentials
   - Revoke any exposed Sentry organization token and replace it with a dedicated
     token limited to the release/project permissions needed for source maps.
   - Revoke App Check debug tokens after sandbox evidence capture. Never store a
     debug token in the repository or persistent browser state.
   - Remove the owner-only Jest sandbox browser-state file after acceptance.

5. Client/public config
   - Keep only non-secret client config in Vite `VITE_*` variables.
   - Never put OpenAI keys, the Jest shared secret, or service-account JSON in browser configuration.
   - Firebase web configuration, the App Check site key, and the browser Sentry
     DSN are public identifiers; rotate them only when their provider-side
     configuration or abuse response requires it.

6. Provider dashboards
   - OpenAI: create a new API key, deploy it as a Functions secret, then revoke the old key.
   - Jest: rotate the shared secret and upload token independently, then verify
     signed identity/purchase/referral payloads and inactive Draft upload.
   - Google/Firebase: disable exposed service-account keys, revoke sandbox debug
     tokens, and verify Secret Manager access and Cloud Run invoker policy.
   - Sentry: verify the replacement token can upload source maps but has no wider
     organization permissions.

7. Deploy and verify
   - Deploy Functions during the coordinated maintenance cutover after setting secrets.
   - Confirm Jest identity exchange, purchase/referral verification and recovery,
     riddle generation, App Check, notifications, profile/avatar, deletion retry,
     and Sentry error reporting.
   - Build and inspect the exact Jest artifact again; it must contain no private
     token, service-account material, debug token, or source map.

## Completion Evidence

Record the following before release:

- Date and actor for each provider rotation.
- New Firebase Functions secret versions.
- Confirmation that old keys are revoked or disabled.
- Confirmation that local `.env`, release credential, sandbox-state, and service
  account files remain untracked and have owner-only permissions where retained.
- The deployed Functions revision and inactive Jest Draft version used for
  post-rotation sandbox verification.
