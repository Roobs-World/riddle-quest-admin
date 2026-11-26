# Hosted notification API

All routes run on Vercel. JSON bodies are bounded and validated. Responses never include raw database errors, provider errors or subscription credentials.

## Retired browser routes

Browser configuration, enrollment, renewal and activity routes return HTTP 410. A previously enrolled browser can still revoke its own registration through the authenticated cleanup endpoint.

## Management

Every management route requires the operator's Supabase access token. The API revalidates the user and current `notification_operators` membership.

| Route | Result or operation |
| --- | --- |
| `GET /api/management/config` | `{platforms:[{id,origin}],pushOnly:true}`; native Android has `origin:null` |
| `GET /api/management/campaigns?view=active\|history&limit=100&cursor=<opaque>` | `{campaigns,nextCursor}` |
| `POST /api/management/campaigns` | Save an idempotent campaign and begin due work |
| `GET /api/management/campaigns/<id>` | `{campaign}` |
| `DELETE /api/management/campaigns/<id>` | Cancel unsent work and return `{campaign}` |

A campaign request contains `requestId`, `title`, `body`, required nullable `imageUrl`, `target` and required nullable `sendAt`. Target is `all` or an admitted platform ID. `sendAt:null` means immediate delivery; an ISO timestamp with an offset means future delivery. Retrying the same operator/request ID with unchanged content returns the existing campaign, including after its scheduled time. Reusing the ID with different content returns a conflict.

Title accepts up to 200 characters, body up to 2,000 and HTTPS image URLs up to 2,048. URLs cannot contain credentials or fragments. Their combined serialized UTF-8 content must fit the 3,000-byte budget. Public campaigns include authored content, timestamps, status and attempted/accepted/failed/uncertain/skipped counters.

## Push payload

The management API and campaign queue deliver to eligible native installations. The React Native Android client registers through its existing authenticated game callable. Only that trusted server may call `POST /api/devices/android/registration` with the bridge credential and `{version:1,tokenHash,revision,enabled,locale,expiresAtMs}`. The reserved `android` target cannot be registered through the public browser endpoints.

The manager's Android adapter forwards `{version:1,tokenHash,revision,notificationId,title,body,imageUrl,expiresAtMs}` to the configured authenticated native dispatch function. It returns `{outcome:"accepted"|"failed"|"uncertain"|"skipped"}`. Token resolution and account authority remain outside the management database.

The native receiver displays manager-authored campaign content and opens the launcher activity on tap. A campaign expires six hours after its scheduled send time.

`GET` or `POST /api/cron/notifications` requires the separate scheduler bearer credential and dispatches bounded due work.
