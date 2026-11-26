# Jest release commands

The `jest` branch has one game frontend and one game release target. Retained provider backends and the notification manager are separate services, with unchanged behavior and configuration. See the [frontend boundary](../../jest/jest-only-frontend.md).

```bash
pnpm release:plan
pnpm build:jest
pnpm release:jest
```

`build:web` builds the Jest game. `build` retains backend preparation and compilation around the Jest build. Other game release commands, manual frontend handoffs and neutral distribution packages are absent.

The Jest release command creates a clean committed snapshot, runs the production gate, builds an isolated immutable artifact, verifies its exact bytes and HTML, then uploads it for activation after processing. Credentials, source hashes, artifact receipts and duplicate-upload barriers retain their existing protections.

After a completed Jest game build, follow the [standing upload and activation authorization](../../jest/jest-html5-operations.md#build-and-upload). Confirm the exact uploaded version has finished processing and has the requested activation state. An accepted HTTP request alone does not establish either fact.

The release does not publish the game, submit it for review or change listing visibility. `JEST_RELEASE_INACTIVE=true` is reserved for an explicitly requested inactive build. Tests, browser harnesses and hosted GitHub runner usage require their existing separate authorization.
