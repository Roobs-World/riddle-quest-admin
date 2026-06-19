Title: iOS build & integration next steps

Source: [docs/IOS_BUILD_GUIDE.md](docs/IOS_BUILD_GUIDE.md) and [docs/integration-guide.md](docs/integration-guide.md)

Workstream status: complete for documentation tracking on 2026-05-30. External iOS execution remains blocked on Apple credentials and iOS CI runner setup.

- Current review note: this issue doc was completed by the current Codex thread as part of the 2026-05-30 docs pass.
- 2026-05-30 refresh: owner assignments for the documented next steps remain in place, and the supporting guide docs now capture the Apple ID, app-specific password, App Store Connect, and runner-access gaps.
- 2026-05-30 continuation: the current thread closed this documentation slice after marking the remaining iOS execution blockers explicitly.

Checklist:

- [x] Review `Next Steps` sections in iOS build and integration docs and assign owners
- [x] Add CI automation tasks (GitHub Actions) to build/test iOS artifacts where possible
- [x] Document any missing credentials (Apple app store, signing) and gating issues

Missing credentials and gating issues:

- Apple Developer account access is still required for device registration and signing flows.
- App Store Connect sign-in gaps still need to be captured before the first build attempt.
- The current Windows workspace still lacks iOS CI runner access, so simulator and build execution remain deferred here.

Blockers:

- Requires Apple credentials and CI runner setup for iOS builds

Assignee: Release engineering / iOS

Milestones:

- Review the Next Steps sections in the iOS build and integration docs
- Draft CI automation tasks for iOS build/test where runner access permits
- Document missing Apple signing and App Store credentials plus any gating issues
