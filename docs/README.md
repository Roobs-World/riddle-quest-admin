# Riddle Quest documentation

Project documentation lives in this folder. Platform documentation belongs in `docs/<platform>/`. Documentation for shared modules and operations belongs in `docs/common/<module>/`. Keep each module's evidence and documentation assets with its documents.

Start with the [project setup guide](common/project/README.md), [platform source ownership](common/architecture/platform-layout.md), [shared feature folders](common/architecture/shared-source-layout.md), [Functions source organisation](common/architecture/functions-source-layout.md), or [shared module index](common/README.md).

## Platforms

| Platform | Documentation |
| --- | --- |
| Android / Google Play | [Android documentation](android/README.md) |
| Jest | [Jest documentation](jest/README.md) |
| Facebook Instant Games | [Facebook documentation](facebook/README.md) |
| Reddit Devvit Web | [Game and review guide](reddit/README.md), [operations](reddit/reddit-games-operations.md), [progress](reddit/reddit-games-progress.html) |
| YouTube Playables | [YouTube documentation](youtube/README.md) |
| Netflix candidate | [Candidate build guide](netflix/README.md) |
| Yahoo candidate | [Candidate build guide](yahoo/README.md) |
| GameSnacks | [Build and handoff guide](gamesnacks/README.md) |

Other web destinations use the [shared release guides](common/releases/README.md) and [platform integration matrix](common/architecture/platform-integration-matrix.md).

## Monitoring

The background Sentry worker has its own [runbook](sentry-worker/README.md) and [evidence](sentry-worker/evidence/).

Game action events, Google Analytics consent and platform reporting boundaries are documented in [Google Analytics and action events](common/observability/google-analytics.md).

The Settings toggle and universal provider contract are documented in [Notifications](common/notifications/README.md). [Firebase enrollment](common/notifications/firebase-enrollment.md) covers account-owned device registration across platform adapters. The [management service guide](common/notifications/service.md) covers the Vercel website and API, Supabase database and calendar scheduling.

Multiplayer fallback names and AI leaderboard totals are documented in [Multiplayer AI opponents](common/hosted/multiplayer-ai-opponents.md).

The shared catalog, localized collections and unlock authority are documented in [Achievements](common/progression/achievements.md).

## Documentation placement

Move callers and links with a document so it has one canonical location. Add shared module documentation beneath `common/`, and provider-specific documentation beneath that provider's folder.

The root `readme.md` and `SECURITY.md` are discovery links. `AGENTS.md` and `.agents/` contain agent guidance and retain their tool-discovered locations. Third-party license notices stay beside the runtime artifacts that distribute them.
