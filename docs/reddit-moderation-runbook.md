# Reddit Games moderation runbook

Last updated: 2026-08-20

## Current status

Blocking/reporting and the moderation queue are not yet implemented; tracker task
R3-08 remains incomplete. Do not claim an operational reporting flow or release social
matching until its tests and operator exercise pass. Riddle Quest will not add chat or
an admin panel.

## Required behavior before activation

- Blocking takes effect immediately in game authority and revokes known-rival and
  presence visibility in both directions.
- Reports require an authenticated reporter, an established rival relationship, a
  fixed category, an opaque subject reference, server timestamp, and bounded optional
  context. Free-form chat and raw Reddit IDs are forbidden.
- Apply per-reporter, per-subject, and global abuse limits transactionally. A report
  retry must be idempotent and must not create duplicate queue work.
- The queue is server-readable only. Reddit moderators and normal players cannot read
  reports through Firestore, Redis, realtime channels, or webview responses.
- Deletion removes live relationship/profile data while retaining only the minimum
  evidence counsel approves for abuse defense. Retention and access roles must be
  configured and recorded before release.

## Operator procedure

Triage categories consistently, restrict access to named operators, record every
action, avoid exporting identifiers, escalate credible safety threats, and use Reddit's
platform reporting tools where platform conduct is implicated. Test block/report rate
limits, unauthorized reads, deletion, and reconnect behavior with multiple role
accounts before enabling matchmaking or presence.
