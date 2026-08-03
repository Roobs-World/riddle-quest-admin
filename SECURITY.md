# Security policy

## Encryption and trust model

Production browser traffic is accepted only over HTTPS. Firebase Hosting and
Cloud Functions terminate TLS, HSTS is enabled by Hosting, and the deployed
Content Security Policy upgrades or blocks mixed-content requests.

Firebase and Google Cloud encrypt managed Firestore, Storage, Secret Manager,
Cloud Logging, and function storage at rest. Jest's shared signing secret and
the OpenAI API key belong only in Google Secret Manager; they must never be
placed in Vite variables, Jest player data, source control, or browser storage.

The game is server-authoritative for multiplayer state, purchases, referrals,
entitlements, currency, and competitive rewards. Production callable functions
require Firebase Authentication and App Check where user identity is needed.
Signed Jest payloads are verified by the backend before trusted state changes.

Riddle answers and guesses are application data, not cryptographic secrets.
They must not be emitted to logs or telemetry. Canonical multiplayer answers
stay on the server. Single-player answer validation is being migrated to the
same server-authoritative model; until that migration is complete, single-player
answers remain visible to the browser and must not protect valuable secrets.

True zero-knowledge end-to-end encryption, where the server cannot decrypt the
payload, is intentionally not claimed: it is incompatible with a trusted server
validating guesses and granting rewards. Do not add client-held encryption keys
and describe that as end-to-end protection; an attacker controlling the client
would receive the same key.

## Reporting a vulnerability

Do not disclose credentials, player data, exploit details, or signing material
in a public issue. Contact the project owner privately with reproduction steps,
affected endpoints, and the minimum data necessary to confirm the issue.
