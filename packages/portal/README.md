# Qwordly Management Portal

Private Firebase-backed operations portal for Riddle Quest.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill the public Firebase web app configuration values.
3. Run `pnpm portal`.

The signed-in Firebase user must either have the custom claim `{admin: true}`
or an existing document at `admins/{uid}`.

## Deploy

Run:

```sh
pnpm portal:deploy
```

Firebase Hosting provides the default project URL. A custom domain can be
attached later in Firebase Console without changing the application.
