# Meta Social Technologies MCP registration — 1 October 2026

Current follow-up: the owner completed authentication, and the 2 October
authenticated MCP inventory confirms read-only access to Riddle Quest. The tools
are now callable. App configuration, review, compliance and webhook observations
are recorded in [the current readiness evidence](meta-facebook-readiness-2026-10-02.md).
The pending/expired authentication observations below describe the initial setup.

Registered `facebook_devtools` at `https://mcp.facebook.com/devtools` in the local
Codex MCP configuration. This is a separate endpoint from the previously
registered Ads MCP. Meta now calls it **Social Technologies MCP**; its former
Developer Tools name, endpoint and `devtools_` prefix remain compatible.
[Meta's official documentation](https://developers.facebook.com/documentation/mcp/devtools-mcp?locale=en_US)

The official reference was retrieved directly from Meta and its SHA-256 retained,
without copying the full document into the repository. Its advertised surface
includes app settings, App Review, compliance, API usage, developer-documentation
search, changelog and webhook tools. It does not replace the game's FBInstant SDK
and does not establish an Instant Games build-upload or payment-verification API.

Executed evidence:

- An unauthenticated MCP initialize request returned HTTP 401 and Meta's exact
  protected-resource metadata URL.
- The protected-resource metadata identifies the `/devtools` resource and
  `https://www.facebook.com/devtools` authorization server. Public OAuth metadata
  exposes PKCE S256 and dynamic client registration.
- `codex mcp add facebook_devtools --url https://mcp.facebook.com/devtools`
  registered the server and successfully created an OAuth authorization flow.
- The automatic all-scope flow was stopped before consent. A new login requested
  `developer_tools_mcp_app_read,business_management`, omitting app-management scope.
- `codex mcp get facebook_devtools --json` confirms an explicit eight-tool read
  allowlist. Webhook management, test delivery and skill telemetry are excluded.
- The authenticated owner browser reached the real Meta consent dialog. It says
  ChatGPT receives the account name/profile picture and ongoing access, and uses
  “read and manage” wording. User approval is pending; no consent button was pressed.
- The callback wait timed out while user approval was pending; the expired browser
  tab was closed. Start a fresh read-scoped login after approval.
- The current registry reports `not_logged_in`. No authenticated tool listing,
  app read or review-status result has been claimed.

The browser confirmation policy requires approval when an app gains new access to
security-sensitive systems. The pending request authorizes proceeding only if
subsequent steps permit **Read** access to Riddle Quest app `1748953042991569`.
If Meta requires Manage or broader app access, stop and retain the pending state.
OAuth state, callback codes, access tokens, cookies and client secrets are not
retained in repository evidence. The consent screenshot is owner-private outside
the repository; it is available in the chat for review.

After approval, complete the current login if still live, otherwise start a fresh
read-scoped login. Verify the connection's granted app and scope, then perform a
bounded app-list read followed by that app's settings, review and compliance reads.
Only returned provider evidence can change those release gates. A newly registered
server may need the Codex client to reload before its tools appear in the active
chat; registration alone does not prove callable tools or app authorization.

The older `facebook` Ads entry, official pinned Devvit MCP and Firebase MCP remain
configured. This pass changes no game, backend, build, SDK, credentials, IAM grants,
provider settings, uploads or publication state. All six client artifacts are
compared against the preceding retained hashes; the existing build and browser
verification remains applicable.
