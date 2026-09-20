# One-shot target release

Run every release target from the repository root:

```bash
pnpm release:all
```

The command first runs `pnpm verify:all-targets`. No target release adapter starts unless that shared gate succeeds. It then runs the Jest, Facebook, YouTube, Reddit, Netflix, and Yahoo adapters in a deterministic order and stops at the first failure.

Review the complete plan without building, uploading, packaging, or publishing:

```bash
pnpm release:all --dry-run
```

Each adapter preserves the provider's current delivery boundary. Jest uploads and activates automatically. Facebook, YouTube, and Reddit produce their existing immutable portal handoffs. Netflix and Yahoo produce validated isolated artifact directories until their private partner upload tools are available. Adding a partner upload transport belongs inside that target's adapter; callers continue to use the same `release:all` command.
