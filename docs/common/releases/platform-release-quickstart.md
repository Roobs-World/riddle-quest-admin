# Jest release quickstart

This branch ships the Jest frontend only. Review the local plan, then use the canonical command:

```sh
pnpm release:plan
pnpm release:jest
```

The command builds and audits one immutable Jest artifact and requests activation after processing. Confirm that exact version is ready and active. It does not publish the game or submit it for review.

Use `pnpm build:jest` for a game build, followed by the standing release instruction unless the user requested build-only or dry-run behavior. Backend and notification-manager operations remain separate and unchanged.

See [release operations](release-operations.md), the [Jest runbook](../../jest/jest-html5-operations.md) and the [Jest-only frontend boundary](../../jest/jest-only-frontend.md).
