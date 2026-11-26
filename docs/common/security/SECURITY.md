# Security policy

## Encryption and trust model

Production game requests and responses use HTTPS/TLS. Browser clients reject
remote HTTP pages and plaintext API endpoints before sending data. Relative API
URLs resolve against the verified page origin. Signed identity, purchase and
game API clients reject redirects, including redirects to HTTP. Firebase region
settings accept region names only, so they cannot select a custom HTTP endpoint.

Firebase Hosting and Cloud Functions terminate TLS. Firebase Hosting and the
notification manager send one-year HSTS policies and Content Security Policies
that upgrade or block mixed-content requests. Partner-hosted game archives also
enforce secure transport in their own clients, independently of Hosting headers.

Android release networking forbids cleartext connections to every host, including
loopback. Release builds reject emulator configuration. Debug resources permit
only localhost, 127.0.0.1 and the Android emulator host bridge at 10.0.2.2 for Metro
and Firebase emulators. Browser development can explicitly permit loopback HTTP.
Google's private server-side metadata token endpoint is separate from player
traffic and retains its managed runtime transport with redirects disabled.

Run `node scripts/audit-security-config.mjs` after changing transport policy.
It checks game, Android and notification-manager source URLs, release Android
network policy, and hosting headers. It is a configuration check, not proof of
the configuration currently deployed by each hosting provider.

Firebase and Google Cloud encrypt managed Firestore, Storage, Secret Manager,
Cloud Logging, and function storage at rest. Jest's shared signing secret and
the OpenAI API key belong only in Google Secret Manager; they must never be
placed in Vite variables, Jest player data, source control, or browser storage.

The game is server-authoritative for single-player and multiplayer outcomes,
purchases, referrals, entitlements, currency, and competitive rewards.
Production callable functions require Firebase Authentication and App Check
where user identity is needed. Signed Jest payloads are verified by the backend
before trusted state changes.

Riddle answers and guesses are application data, not cryptographic secrets.
They must not be emitted to logs or telemetry. Clients can receive answer data
for immediate feedback. A player controlling the client can inspect that data
after decryption. Guesses, attempts, paid actions, completion and rewards remain
validated against the private server session.

True zero-knowledge end-to-end encryption, where the server cannot decrypt the
payload, is intentionally not claimed: it is incompatible with a trusted server
validating guesses and granting rewards. Do not add client-held encryption keys
and describe that as end-to-end protection; an attacker controlling the client
would receive the same key.

HTTPS encrypts data on the network in both directions. The browser decrypts it
before displaying it in developer tools. Application-level payload envelopes can
deter casual inspection, but a player controlling the browser can inspect the
game's decryption code and decoded data. Do not describe these envelopes as a
way to keep secrets from the player or prevent client tampering. Firebase and
platform SDK protocols retain their own HTTPS transport.

## Game API payload protection

The [November 26 release evidence](evidence/transport-encryption-2026-11-26.json)
records the deployed backend cohort, completed builds and confirmed Jest activation.

Updated Jest, Facebook and Reddit browser clients encrypt their own game API
request and response bodies with AES-256-GCM in addition to HTTPS. This includes
signed identity and purchase exchanges, callable application errors, live-race
stream chunks and profile reads. Browser profiles use the authenticated
`getPlayerProfile` callable rather than direct Firestore reads. That callable
derives the account from verified authentication and returns only profile fields.

The versioned envelope uses a fresh 96-bit IV for each message. Authenticated
additional data binds the ciphertext to its operation, request identifier and
request, response or stream direction. The decoder validates the exact envelope
shape and bounds encoded and decoded payload sizes before domain validation.
Updated clients reject unexpected plaintext game API responses.

The decoding key ships with the browser code. This deters casual inspection of
Network-panel bodies; it is not a secret, authentication credential or anti-cheat
control. Firebase Authentication, App Check, presence and provider SDK protocols
remain provider-managed and visible to the browser. URLs, headers, status codes,
sizes and timing remain visible. Android uses HTTPS with its existing native
Firebase protocol and does not require browser Web Crypto.

The server accepts the existing HTTPS JSON formats so older clients and Android
keep working. Deploy the server changes before activating an updated browser
client. Provider webhooks, signed callbacks and OAuth contracts retain their
provider-defined body formats. Do not apply the game envelope to those routes.

## Reporting a vulnerability

Do not disclose credentials, player data, exploit details, or signing material
in a public issue. Email `grindheadgames@gmail.com` with reproduction steps, affected
endpoints, and the minimum data necessary to confirm the issue.
