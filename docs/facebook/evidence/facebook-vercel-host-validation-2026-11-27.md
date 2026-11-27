# Vercel hosting validation — 27 November 2026

**Riddle Quest's exact version-15 static files are publicly hosted on Vercel. Full gameplay from this host remains blocked/unverified.** The existing identity endpoints reject both Vercel origins; Firebase was preserved. The separate [physical Android Facebook-host checks](facebook-android-host-version-15-2026-11-27.md) remain successful within their recorded scope.

## Deployment and artifact

- Stable URL: [riddle-quest-facebook-testing.vercel.app](https://riddle-quest-facebook-testing.vercel.app)
- Exact deployment: [riddle-quest-facebook-testing-ceutg3wxg.vercel.app](https://riddle-quest-facebook-testing-ceutg3wxg.vercel.app)
- Project: `riddle-quest-facebook-testing` (`prj_DFWSVByFLrqzheCWpnkQdQeASHEk`), in the owner-selected `craig-beswethericks-projects-d44935d2` team, authenticated as `grindheadgames-8804`.
- Deployment: `dpl_5VMsHRZyAmM6LXeumHpeQxH6tyMj`, **READY** at `2026-11-27T23:25:19.407000+00:00`.
- Artifact: the accepted Facebook Testing version **15**, bundle `30470981679157112`, source `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0`; archive SHA-256 `5803b051ff965b97b7ea1e8669d816172983a7c7a1ae8ab8a44ba9a630cbf824`, 2,865,675 bytes.

There was **one deployment**. The CLI explicitly requested `--target preview`, but Vercel reported this first deployment's target as `production`. It remains the new isolated testing project authorized by the owner. This Vercel label did not promote the Meta artifact: Facebook Production remained version 9 and Testing remained version 15.

The upload contained the accepted artifact's **420 unchanged runtime files** plus a separate `vercel.json` hosting configuration. No Git integration, environment variables, functions or source build were added. The repository's existing Vercel linkage was preserved. The project has no SSO/password protection; public static responses allow origin `*` and specify `noindex, nofollow`.

## Verified HTTP delivery

Every runtime file at the exact deployment returned **HTTP 200** and was **byte-identical** to the accepted archive: **420/420**, totaling 4,727,397 runtime bytes. All checked responses carried the configured static CORS and robots headers, without framing-restriction headers. At the stable alias, `index.html` and `assets/index-BTdZDU9N.js` also returned HTTP 200 with identical bytes, correct HTML/JavaScript content types and static CORS `*`. The full 420-file comparison was performed against the exact deployment, not repeated against the alias.

## Gameplay and identity limits

The direct Firefox page displayed **Riddle Quest — Loading 5%**. A second observation more than one minute later showed the same state. The real `fbinstant.8.0.js` loaded and `FBInstant` was an object; no SDK mock was used. No backend resource requests appeared in that page's performance entries. **The 5% state is therefore not attributed to the separately observed HTTP 403 responses.** A standalone static page does not establish an authenticated Facebook-host session.

Separate HTTP **OPTIONS** checks established the existing identity-origin boundary:

| Origin | `issueFacebookIdentityNonce` | `exchangeFacebookIdentity` | Allow-origin response |
| --- | --- | --- | --- |
| Exact Vercel deployment | 403 `forbidden-origin` | 403 `forbidden-origin` | Absent |
| Stable Vercel alias | 403 `forbidden-origin` | 403 `forbidden-origin` | Absent |
| `https://apps-1748953042991569.apps.fbsbx.com` control | 204 | 204 | Matching Facebook origin |

These were preflight checks, not identity exchanges or evidence of authenticated gameplay. Static asset CORS cannot override the backend's origin policy. No Firebase allowlist, configuration, source or deployment was changed.

The Facebook `/embed/instantgames/1748953042991569/player?game_url=…` route reached Facebook login in the automation profile, which is separate from the user's Firefox session. An authenticated external-host journey was not established. Hosting delivery passed; full Vercel-origin identity/gameplay and the authenticated embed path remain unresolved. No blanket SDK acceptance is claimed.

The [compact sanitized receipt](facebook-vercel-host-validation-2026-11-27.json) records deployment identity, static checks and preflight results without credentials, authentication URLs or personal content. This unit made no Meta production promotion, publication or review submission.
