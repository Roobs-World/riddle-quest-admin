# Credential Rotation Runbook

Last updated: 2026-05-23

## Scope

Rotate every credential that appeared in tracked local configuration:

- Firebase Admin service account key from `firebase-functions/qwordly-admin-sdk.json`
- Values from tracked `.env`
- Values from `firebase-functions/.env.default.backup`
- Values from `firebase-functions/.runtimeconfig.json`

Treat all historical values as compromised.

## Rotation Steps

1. Firebase Admin service account key
   - Open Google Cloud Console IAM and Admin > Service Accounts.
   - Find the Firebase Admin SDK service account for the project.
   - Disable and delete the exposed key.
   - Create a replacement key only if a local administrative script still requires one.
   - Store any replacement key outside the repository.

2. Firebase Functions secrets
   - Rotate and set server-only values with Firebase Functions secrets:

```sh
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set APPLE_SHARED_SECRET
firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT
firebase functions:secrets:set FACEBOOK_APP_SECRET
```

3. Client/public config
   - Keep only non-secret client config in Expo/EAS variables.
   - Do not put OpenAI keys, Apple shared secrets, service account JSON, or Facebook app secrets in Expo `extra`.

4. Provider dashboards
   - OpenAI: create a new API key, deploy it as a Functions secret, then revoke the old key.
   - Apple: rotate the app-specific shared secret if exposed.
   - Meta/Facebook: rotate the app secret and client token if exposed.
   - Google/Firebase: rotate any API keys that were exposed beyond intended client use.

5. Deploy and verify
   - Deploy Functions after setting secrets.
   - Confirm purchase validation, riddle generation, auth providers, analytics, messaging, and avatar upload flows.

## Completion Evidence

Record the following before release:

- Date and actor for each provider rotation.
- New Firebase Functions secret versions.
- Confirmation that old keys are revoked or disabled.
- Confirmation that local `.env` and service account files remain untracked.
