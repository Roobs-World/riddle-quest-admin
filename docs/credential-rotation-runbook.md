# Credential Rotation Runbook

Last updated: 2026-08-23

## Scope

This repository has isolated Jest, Facebook Instant Games, Reddit Devvit Web, and
YouTube Playables targets plus a shared Firebase backend. It has no Apple or
native-store credential path. The YouTube runtime has no private credential; its
content-authoring command uses an owner-private OpenAI key before release.

Rotate every private credential that appeared in tracked local configuration or
was exposed outside its intended owner-only boundary:

- Firebase Admin service account key from `firebase-functions/qwordly-admin-sdk.json`
- Values from tracked `.env`
- Values from `firebase-functions/.env.default.backup`
- Values from `firebase-functions/.runtimeconfig.json`
- The Jest shared secret and game-upload token
- Historical Facebook app credentials; never reuse them for the Instant Games app
- The Reddit Devvit-to-Firebase gateway secret and independent Reddit UID HMAC secret
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
   - Rotate and set the server-only values used by each enabled target:

```sh
pnpm dlx firebase-tools@15.25.1 functions:secrets:set JEST_SHARED_SECRET --project riddle-quest-ec2b2
pnpm dlx firebase-tools@15.25.1 functions:secrets:set OPENAI_API_KEY --project riddle-quest-ec2b2
pnpm dlx firebase-tools@15.25.1 functions:secrets:set FACEBOOK_APP_SECRET --project riddle-quest-ec2b2
pnpm dlx firebase-tools@15.25.1 functions:secrets:set REDDIT_GATEWAY_SECRET --project riddle-quest-ec2b2
pnpm dlx firebase-tools@15.25.1 functions:secrets:set REDDIT_UID_SECRET --project riddle-quest-ec2b2
```

   - Do **not** replace `FACEBOOK_UID_SECRET` in place for an app with existing
     provider records. The current implementation accepts one key only and has
     no key version, previous-key fallback, or UID migration. Changing the key
     makes existing Facebook identity exchange and deletion fail their persisted
     UID/provider-scope checks. If this key is exposed, disable Facebook identity,
     preserve the existing value only inside the controlled incident boundary,
     and keep the target disabled until a reviewed dual-key or migration release
     has moved every provider mapping and deletion path. Initial provisioning for
     a genuinely new app is separate from rotation.

3. Jest release credentials
   - Rotate the Riddle Quest upload token in the Jest Developer Console.
   - Store the replacement only in the owner-only external credential file
     documented in `docs/jest-html5-operations.md`; require mode `0600`.
   - Keep `JEST_UPLOAD_IS_ACTIVE` and `JEST_CONFIRM_ACTIVATION` out of that
     persistent file. The canonical release interface rejects both variables
     because build activation intent is fixed in reviewed release code and bound
     to the exact gated artifact.

4. Sentry and sandbox credentials
   - Revoke any exposed Sentry organization token and replace it with a dedicated
     token limited to the release/project permissions needed for source maps.
   - Revoke App Check debug tokens after sandbox evidence capture. Never store a
     debug token in the repository or persistent browser state.
   - Remove the owner-only Jest sandbox browser-state file after acceptance.

5. Client/public config
   - Keep only non-secret client config in Vite `VITE_*` variables.
   - Never put OpenAI keys, the Jest shared secret, or service-account JSON in browser configuration.
   - Run `pnpm check:facebook-secrets`. This fails if a Meta server-secret
     identifier reaches browser source/configuration, a workflow references a
     Meta secret value directly, or a consuming Function loses or widens its
     exact Secret Manager binding.
   - Firebase web configuration, the App Check site key, and the browser Sentry
     DSN are public identifiers; rotate them only when their provider-side
     configuration or abuse response requires it.

6. Provider dashboards
   - OpenAI: create a new API key, deploy it as a Functions secret, then revoke the old key.
   - Jest: rotate the shared secret and upload token independently, then verify
     signed identity/purchase/referral payloads and the exact activated build upload.
   - Meta: create a new app secret, keep it server-only, verify signed identity
     and deletion fixtures, then revoke the superseded app-secret version. Do not
     rotate the independent UID HMAC key in place; use the disabled-identity
     migration procedure above if that key is exposed.
   - Reddit: generate new independent gateway and UID HMAC values. Put the UID
     secret only in Firebase Secret Manager. Put the gateway value in both
     Firebase Secret Manager and the Devvit global secret setting
     `redditGatewaySecret`; never expose either value to the webview.
   - Google/Firebase: disable exposed service-account keys, revoke sandbox debug
     tokens, and verify Secret Manager access and Cloud Run invoker policy.
   - Sentry: verify the replacement token can upload source maps but has no wider
     organization permissions.

7. Deploy and verify
   - Deploy Functions during the coordinated maintenance cutover after setting secrets.
   - Confirm Jest identity exchange, purchase/referral verification and recovery,
     riddle generation, App Check, notifications, profile/avatar, deletion retry,
     and Sentry error reporting.
   - Confirm Facebook nonce/exchange, App Check, generation-based deletion and
     signed deletion callback before enabling any additional capability.
   - When a Facebook UID-key migration is required, also verify an existing
     account, a fresh account, in-game deletion, signed callback deletion, lost-
     response retry, and post-deletion fresh generation against the migrated
     provider records before re-enabling identity.
   - Confirm the Reddit gateway rejects signature, operation, app, subject,
     account-generation, timestamp, and nonce mismatches; then verify identity,
     storage, gameplay, and deletion through the same-origin Devvit route.
   - Build and inspect all four exact artifacts again; none may contain a private
     token, service-account material, debug token, or source map.
   - Retain the `pnpm check:facebook-secrets` result with the deployment receipt;
     it proves source bindings and absence from browser inputs, not the age,
     uniqueness, IAM policy, or value of the deployed secret versions.

## Completion Evidence

Record the following before release:

- Date and actor for each provider rotation.
- New Firebase Functions secret versions.
- Confirmation that old keys are revoked or disabled.
- Confirmation that local `.env`, release credential, sandbox-state, and service
  account files remain untracked and have owner-only permissions where retained.
- The deployed Functions revision and active Jest version used for
  post-rotation sandbox verification.
