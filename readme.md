# Riddle Quest

Riddle Quest is a standard React HTML5 game for the Jest gaming platform. The repository no longer contains a React Native, Expo, Android, iOS, EAS, or admin-panel application.

## Workspace

- `packages/portal`: Vite + React game and Jest SDK adapter
- `packages/core`: shared browser-safe game, validation, bridge, and pricing code
- `firebase-functions`: authoritative gameplay and secure Jest identity, purchase, and referral endpoints
- `docs/html5-riddle-quest-progress.html`: canonical implementation and release tracker
- `docs/jest-html5-operations.md`: build, upload, and sandbox operations

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Use `?harness=jest` for the deterministic local Jest SDK harness.

## Verification

```bash
pnpm test
pnpm test:functions
pnpm build
```

Build only the uploadable Jest artifact with:

```bash
pnpm build:web
```

The standalone output is written to `packages/portal/dist-jest`.

## Jest release

```bash
JEST_GAME_UPLOAD_TOKEN='<token>' \
JEST_NOTIFICATION_EMAIL='developer@example.com' \
pnpm jest:build-upload
```

See `docs/jest-html5-operations.md` for environment variables, upload behavior, and sandbox acceptance checks.
