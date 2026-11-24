# Notification management service

The management website lives in the top-level `notification-manager/` workspace. Vercel hosts the React frontend and `/api` Functions. Supabase provides Postgres, Google sign-in and public notification image storage. The manager has no Firebase SDK dependency. The existing Android game backend retains authenticated FCM token ownership and serves its device adapter.

Operators write a title and message, upload an image or supply a public HTTPS image URL, select an admitted platform audience and send now or choose a date and time on the calendar. Placeholder preview content never enters a campaign. Images are optional and their display depends on the device.

Calendar times use the operator's displayed browser timezone. The frontend converts them to an absolute UTC instant and rejects nonexistent daylight-saving times or past times. The server independently rejects a new schedule in the past. There is no arbitrary one-year limit.

Queue and history counts distinguish push-service acceptance, failure, uncertainty and skips. Acceptance does not prove that a device displayed the message. Cancelling stops unsent work but cannot recall a push a provider already accepted. Active campaigns and history have separate paginated lists with explicit Load more controls. Counts cover loaded rows.

## Local commands

Run from the repository root:

```sh
pnpm dev:notification-manager
pnpm check:types:notification-manager
pnpm build:notification-manager
```

Vite serves the frontend on port 5180. For local API routes, use Vercel's development runtime with `notification-manager/` as the project root. Vite alone serves only the frontend. Builds emit `notification-manager/dist/` and reject browser imports of server modules, Web Push server code, Firebase or private credentials.

The development login screen offers a local drafts workspace while external services are unconfigured. It makes no management API calls, and its send/upload controls stay disabled. Calendar dates describe draft plans, not scheduled delivery. This entry point is excluded from production builds. Production requires sign-in and a successful server operator check before opening the workspace; a later 401 or 403 closes it again.

The composer saves working drafts in this browser, including the request ID needed to recover an unchanged pending send. Operators can keep up to 25 saved drafts, reload or delete them, and import/export versioned JSON files. Signed-in drafts use a user-specific storage namespace. Draft files contain only form values, with no credentials or delivery authority. Browser storage failures leave the editor intact and show an export reminder. Android, iOS and desktop previews illustrate layout differences without promising an exact device appearance.

## Supabase setup

The Supabase project is named `riddle-quest-notifications`. Its Marketplace installation is connected to `riddle-quest-admin` in production, and its project URL remains `https://vqyjgcqyudqonfhgymoy.supabase.co`. The integration supplies the standard URL, publishable key and server secret variables. It is not currently connected to Preview or Development environments.

Database setup completed on November 24, 2026. Migration `20261124055801_notification_service` created six notification tables with RLS and twenty service-role-only, SECURITY INVOKER RPC functions. The public `notification-images` bucket accepts PNG, JPEG and WebP files up to 2 MB. Migration `20261124060208_notification_trigger_permissions` removed browser execution grants from Supabase's existing RLS event-trigger helper while preserving the helper and enabled trigger. Follow-up security and performance advisors reported zero warnings or errors. Informational findings reflect the deliberately inaccessible service tables and indexes in the empty database. See the [setup evidence](evidence/supabase-setup-2026-11-24.json).

Google sign-in is enabled. On November 24, 2026, the public Auth settings endpoint confirmed the provider is active, and an authorization request returned HTTP 302 to `accounts.google.com` with the expected Supabase callback and a configured client ID. This verifies the start of the flow; the complete Google sign-in and post-login redirect still need verification after deployment.

The approved administrator completed a verified Google sign-in. Its operator membership was added and verified on November 24, 2026; membership was not granted before identity verification. The push scheduler remains pending. The production website is live at https://riddle-quest-admin.vercel.app. Its first authorized deployment, `dpl_Gzfea2mX1TRRv1TGhwVWbfJjju1E`, uses source commit `351d9c1bd`. The page and JavaScript asset returned HTTP 200; the unsigned management configuration request returned HTTP 401. No user accounts were created or notifications sent by deployment.

A subsequent login investigation confirmed successful PKCE exchanges, an active administrator session and retained operator membership. Deployment `dpl_Ds7AfRFunREatECHMRgZ2QvMMcWR` removes the unsupported 4,096-character bearer limit and separates rejected credentials from authentication service failures. Authentication diagnostics record only bounded error codes and numeric status, never tokens, user identifiers or provider messages. The production build succeeded and invalid credentials remain rejected; signed-in workspace access still awaits confirmation.

1. Use the notification service's connected Supabase project. The game's existing account database stays separate.
2. The initial schema is already applied to this project. For future changes, edit the declarative schema files selected by `notification-manager/supabase/config.toml`, generate and review an incremental migration, then apply it once. Follow [Supabase's declarative schema workflow](https://supabase.com/docs/guides/local-development/declarative-database-schemas). Do not replay the raw CREATE statements against the existing database.
3. The bucket is already configured. `notification-manager/supabase/seed.sql` can reapply its settings. Approved operators can upload into their own user folder. Notification images are public.
4. Enable Google in Supabase Authentication and configure its callback with Google. Set the site URL and allowed redirects to the management website origin. Add local origins explicitly for development. See [Google OAuth setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
5. After an intended operator signs in, insert their authenticated user UUID into `public.notification_operators` using a trusted database administration connection. Only members can read campaigns, upload images or send notifications. Remove the row to revoke access.

Every notification table enables RLS. Browser clients cannot access installations, push credentials, campaigns, receipts or quotas directly. Server-only RPCs perform atomic subscription, revision, lease and receipt operations. Each management request checks the current Supabase user and database membership. User-editable metadata never grants authority.

No schema, seed, operator membership or scheduled job is applied by a frontend build.

### Google provider settings

Supabase manages the operator sign-in session. Google OAuth requires a Web application client ID and client secret from Google Cloud. The approved Google Cloud project is `riddle-quest-ec2b2`. Configure these exact URLs:

| Setting | Value |
| --- | --- |
| Google authorized JavaScript origin | `https://riddle-quest-admin.vercel.app` |
| Google authorized redirect URI | `https://vqyjgcqyudqonfhgymoy.supabase.co/auth/v1/callback` |
| Supabase Site URL | `https://riddle-quest-admin.vercel.app` |
| Supabase allowed redirect URL | `https://riddle-quest-admin.vercel.app` |

Create or select a Web application client in [Google Cloud](https://console.cloud.google.com/auth/clients?project=riddle-quest-ec2b2), then enter its client ID and secret directly in the [Supabase Google provider settings](https://supabase.com/dashboard/project/vqyjgcqyudqonfhgymoy/auth/providers?provider=Google) and enable Google. Keep the secret out of chat, source files and browser build variables. Site URL and redirect entries are configured separately in [Supabase URL Configuration](https://supabase.com/dashboard/project/vqyjgcqyudqonfhgymoy/auth/url-configuration). Keep existing redirects needed by other approved environments. See [Google OAuth setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

The authenticated MCP connection does not establish a Supabase dashboard browser session and does not expose an Auth provider configuration tool. The available browser runs headlessly. Enter or update provider credentials directly in the signed-in Supabase dashboard. Do not use placeholder credentials.

### Initial migration provenance

The application schema and migration history were confirmed empty before setup. Supabase CLI 3.2.0 generated the initial local migration filename. Its declarative diff engine could not run because Docker was stopped, so the initial SQL was generated by concatenating the five existing declarative files in their configured order. The SQL was reviewed, applied once with MCP and checked using read-only catalog queries. The local filenames were aligned with the versions recorded by Supabase's migration history. The initial migration contains the exact declarative source SQL; the trigger-permission migration is generated from `supabase/hardening.sql` and only changes grants on the existing provider-owned helper.

### Agent administration connection

The repository's `.mcp.json` configures Claude and `.codex/config.toml` configures Codex with Supabase's HTTP MCP endpoint. Both are scoped to project reference `vqyjgcqyudqonfhgymoy`, with the feature groups selected during setup. The project display name does not change the reference or connection URL. These files contain no access tokens.

Authenticate the client separately: use `codex mcp login supabase` for Codex, or open Claude in a regular terminal and use `/mcp` to approve and authenticate the `supabase` server. Choose the organization containing `riddle-quest-notifications`. Reload the client session after authentication if its Supabase tools are not available. See [Supabase's MCP setup guide](https://supabase.com/docs/guides/ai-tools/mcp).

## Vercel setup

The Vercel project is [riddle-quest-admin](https://vercel.com/craig-beswethericks-projects-d44935d2/riddle-quest-admin), project ID `prj_lMHXnKFcYLsTLtuj4Zgug67n25Dz` in team `team_Q3bXo2jPBKdjs3tuoKLtqUe2`. Its Root Directory is `notification-manager`, with Node.js 24 and access to workspace files outside that root. The checked-in `vercel.json` selects Vite, `pnpm build`, `dist` and 60-second API Functions. Automatic Git deployments are disabled; source pushes do not authorize a deployment or production release.

Installation runs `corepack pnpm install --frozen-lockfile`, using the repository's pinned pnpm version and shared lockfile. The manager directly pins `@supabase/auth-js` to the SDK's matching version because Vercel's TypeScript host does not resolve pnpm's transitive symlink paths like the standard compiler. Without that direct dependency, its API build loses the inherited `auth.getUser` type despite the project type check passing. Keep the versions aligned when upgrading Supabase.

The production frontend and all six API Functions were built locally with Vercel CLI on November 24, 2026, with no TypeScript diagnostics. The reviewed output is under the ignored `.vercel/output` folder. Creating that output does not deploy it. The user authorized the first production prebuilt deployment on November 24, 2026. Future releases also require explicit authorization and should use the reviewed output and production environment.

The checkout now uses `Roobs-World/riddle-quest-admin`, while Vercel's existing Git connection still references `Grindhead/riddle-quest`. A manual release must use the reviewed current checkout or its prebuilt output rather than silently building the older Git source. Updating the Git connection is a separate configuration action; keep automatic deployments disabled.

The build reads the standard `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` pair supplied by the [Supabase Marketplace integration](https://supabase.com/docs/guides/integrations/vercel-marketplace). Only these two validated public values enter the browser bundle. It also accepts the integration's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` pair when the standard pair is absent. No broad public environment prefix is enabled.

For local overrides, set both `VITE_NOTIFICATION_SUPABASE_URL` and `VITE_NOTIFICATION_SUPABASE_PUBLISHABLE_KEY`. A partial or invalid pair fails the build instead of mixing settings from different sources. When a server URL exists, the browser URL must refer to the same project. Modern `sb_publishable_` keys are required for public configuration; secret and legacy service-role keys are rejected. Production builds passed both without configured settings and with the connected project's public integration settings.

Use `notification-manager/.env.example` for the environment settings:

| Setting | Visibility and purpose |
| --- | --- |
| `SUPABASE_URL` | Integration-managed API and frontend Supabase URL |
| `SUPABASE_PUBLISHABLE_KEY` | Integration-managed public frontend key |
| `VITE_NOTIFICATION_SUPABASE_URL` | Optional public frontend URL override |
| `VITE_NOTIFICATION_SUPABASE_PUBLISHABLE_KEY` | Optional public frontend key override; set with its URL |
| `SUPABASE_SECRET_KEY` | API-only secret key |
| `HOSTED_PUSH_VAPID_PUBLIC_KEY` | Stable Web Push application public key |
| `HOSTED_PUSH_VAPID_PRIVATE_KEY` | API-only matching private key |
| `HOSTED_PUSH_VAPID_SUBJECT` | Real operator contact as `mailto:` or HTTPS URL |
| `NOTIFICATION_ALLOWED_ORIGINS` | JSON map of platform IDs to exact HTTPS game origins |
| `CRON_SECRET` | Dedicated random scheduler credential, 32 to 256 URL-safe characters |
| `NOTIFICATION_MANAGER_BRIDGE_SECRET` | Matching server-only Android bridge credential, 32 to 256 URL-safe characters |
| `ANDROID_NOTIFICATION_BRIDGE_URL` | HTTPS Firebase `dispatchAndroidNotification` function URL |

Generate one stable P-256 VAPID pair using the installed `web-push` package or an approved credential workflow. Store the private value only in secret configuration. Rotating it requires browser re-enrollment; do not generate a new pair on each build. Never prefix server secrets with `VITE_`, log them or commit them.

The default Content Security Policy admits Supabase connections under `*.supabase.co`. Update its `connect-src` directive if using an approved custom Supabase domain.

## Native Android setup

The React Native Android client uses the same Notifications provider interface and manager-authored campaign model as the web client. Its default device adapter uses data-only FCM. The authenticated `setAndroidPushSubscription` callable retains token ownership and the account's master preference in the existing game backend. It synchronizes only an opaque token hash, consent revision and expiry to the manager's server-only `/api/devices/android/registration` route. Supabase receives no raw FCM token or game account ID.

Configure the matching `NOTIFICATION_MANAGER_BRIDGE_SECRET` in Firebase Secret Manager and Vercel. Set Firebase's `NOTIFICATION_MANAGER_URL` to the exact Vercel service origin. Set Vercel's `ANDROID_NOTIFICATION_BRIDGE_URL` to `https://<region-project>.cloudfunctions.net/dispatchAndroidNotification`. Native Android appears in the management audience list only when the Vercel bridge configuration is valid. Do not put either secret into React Native configuration or a browser build.

For each native delivery, the manager sends immutable campaign content to the authenticated Firebase adapter. Firebase rechecks current account ownership, consent, device revision and deletion state before claiming one FCM attempt. A stable device intent counter prevents delayed registration from reversing newer choices across account changes and token rotation. Background renewal cannot lift an explicit master Off. Account deletion removes native tokens, device bindings and delivery receipts. The native receiver independently checks account, consent, permission and expiry before display. It shows the authored text immediately; WorkManager fetches an optional image with bounded size and time limits. Separate campaigns have separate notification identities.

This path needs an authorized Functions release, current Supabase schema and an updated native Android build. Legacy clients without campaign capability are excluded. Existing Google Services/FCM setup remains required; these edits do not deploy a service or upload an APK.

## Scheduled delivery

Supabase Cron invokes Vercel's authenticated `/api/cron/notifications` route every minute. Review `notification-manager/supabase/scheduler.sql` separately from the database schema. After the service is deployed, create these Supabase Vault secrets with a trusted administration connection:

- `notification_service_url`: the HTTPS Vercel service origin, with no API path.
- `notification_cron_secret`: the exact dedicated `CRON_SECRET` configured on Vercel.

Then run the reviewed scheduler source as the database owner. The named job `notification-manager-dispatch` can be configured repeatedly and reads the Vault values at runtime so rotation does not expose a credential in the scheduled SQL. It does not use a Supabase secret key as the HTTP credential. See [Supabase Cron](https://supabase.com/docs/guides/cron) and [scheduled HTTP requests with Vault](https://supabase.com/docs/guides/functions/schedule-functions).

Postgres persists scheduled work. The service does not rely on a browser tab or an in-memory timer. Send now starts a bounded dispatch batch; Cron continues remaining work. Scheduling resolution is one minute plus dispatcher and provider latency, rather than an exact device display time.

Each campaign has a durable lease and one receipt per installation. The dispatcher checks current consent, subscription revision and cancellation immediately before contacting the push vendor. Uncertain sends are recorded without blind retries. Raw subscriptions expire after 30 days without renewal; minimal opt-out revision records persist. Push payloads expire after six hours. Cleanup removes expired subscription material, quotas and terminal delivery records.

The database, environment values and scheduler must be configured before live delivery works. Source builds validate types and packaging. Live sign-in, RLS, uploads and after-close push delivery still need acceptance against an authorized configured deployment.

### Protected Vercel addresses

Use https://riddle-quest-admin.vercel.app for routine management. The longer team alias can require Vercel deployment sign-in before requests reach the application. Management requests include same-origin cookies so that Vercel can validate that session alongside the Supabase bearer token. Non-JSON deployment authentication failures are reported separately from expired Supabase sessions. Application identity and operator membership checks still apply to every management request.

The browser initializes Zod with `jitless: true` before loading application schemas. This prevents its dynamic-code capability probe from producing a CSP warning; `script-src` remains restricted to `self`. The `__cf_bm` cookie belongs to Cloudflare bot management, not the application session.

The public Google OAuth authorization URL identifies Google Cloud project number `329028367192`, which the connected project inventory maps to `riddle-quest-ec2b2`. It does not use project `qwordly-6ba44`, number `26666910831`, named in the restriction email. No Cloud project resources or credentials were changed during this check.
