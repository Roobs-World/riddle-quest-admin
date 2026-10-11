---
title: Testing with the Simulator
description: Test a build in the Developer Console, work through the launch checklist, and submit a self-review with an optional recording.
slug: /testing/simulator
---

## Run a build in the Simulator

The Simulator is a tool in the [Developer Console](/dev-console) that runs your app in a framed preview and plays the role of Jest.com for it. The SDK is handled by a mock host, so user identity, purchases, notifications, and other platform calls are answered locally.

Use it when you want a clean, full-viewport surface to:

- Prepare a self-review with SDK activity, notes, and an optional recording attached to the build you submit.
- Drive a build (or a local URL) end-to-end with a checklist that flags common issues before you submit.

To test a build, open **Simulator** from the left sidebar, or choose **Run in simulator** from a version's actions menu under **Manage → Versions**. To submit your app for review, use **Submit for Review** in your app's settings to open the submission flow described below.

## Submit a self-review {#record-a-self-review}

A self-review captures the SDK activity from your play-through, along with your notes and an optional screen recording. It is saved against the build you submit so reviewers can inspect the session alongside the build itself.

Before starting, complete the [submission prerequisites](../dev-console/apps.md#before-you-submit). You need write access to the app to submit it.

1. Open your app in the Developer Console. Under **Manage → Versions**, confirm that your draft uses the build you want to submit. To select a different build for the draft, choose **Set Active** from that version's actions menu.
2. Open **Manage → Edit App**, then select **Submit for Review** at the bottom of the page. This saves your changes and opens the Simulator with the build selected for your draft.
3. Choose **Start recording** to include a video, or **Not now** to continue without one. You can start recording later with **Record session**. When prompted, share the current tab in Chrome, or the browser window in Safari. The recording captures the app and overlays such as login, purchase, and loading screens.
4. Play through your app's required flows and work through the **Checklist** tab. Every applicable automated **Basic Launch** check must pass before you can submit. See [Reading the checklist](#reading-the-checklist).
5. Select **Submit for review**. This stops any recording and opens the submission form.
6. Optionally tell the reviewer what analytics you use and add summary notes. If all applicable Basic Launch and Fund checks pass, the form lets you apply to the Jest Fund; its checkbox is selected by default when eligible.
7. Confirm submission to upload the SDK log, notes, and any recording, and send the app for review. The app's status becomes **In Review**.

Video recording is optional even if the browser does not support screen capture or you decline permission. The SDK activity is still included in your self-review.

To replace a build already under review, select **Use in pending submission** on another version, then complete the **Update pending submission** flow. See [While your app is in review](../dev-console/apps.md#while-your-app-is-in-review).

### Good for

- Giving moderators evidence that a version's core flows actually work end-to-end before they review it manually
- Attaching a play-through and notes to the build a moderator will review
- Comparing recordings and SDK activity when investigating regressions

### Not good for

- Demonstrating real platform behavior — login, purchases, and notifications are mocked, not live (use [sandbox users](/testing/sandbox) for that)
- Performance or timing measurements — the Simulator runs in a framed container with a mocked host, not the real Jest.com shell

## Drive any URL

In URL mode, the Simulator loads any URL you give it — including `http://localhost:<port>` — instead of an uploaded build. Recording is disabled in this mode; it is meant for ad-hoc test-drives.

1. Open the Simulator from the sidebar.
2. Keep the mode toggle on **URL**.
3. Paste the URL served by your app's development server (for example `http://localhost:3001`) and select **Load**. Use the port and path that serve your app's HTML entry point. The Simulator provides the mocked host, so no `?host=...` parameter is needed.

This works against a running local dev server, so you can iterate on your app and reload the Simulator manually to see changes. There is no auto-refresh today — if your dev server hot-reloads the app itself, that still works inside the iframe; changes that require re-running SDK initialization need a Simulator reload.

If your local server sets `X-Frame-Options: DENY` or a restrictive `frame-ancestors`, the iframe will refuse to load. Adjust the dev server config to allow framing during development.

If your app sends signed SDK responses to a backend, configure your test verifier using the [Simulator's signing settings](#signing-configuration).

### Good for

- Trying out a local build against the Simulator's mocked host (products, user data, entry payload) without uploading
- Exercising the checklist against changes you haven't shipped yet
- Sharing a repeatable test harness across developers without each person needing a sandbox user

### Not good for

- Testing inside the real Jest.com shell — use the [hosted emulator](/testing/emulator) for that
- Validating an uploaded build with a live platform — use [sandbox users](/testing/sandbox)
- Day-to-day local iteration where the in-app `JestSDK` debug menu is enough — use [local mocks](/testing/mock)

## Reading the checklist

Open the **Checklist** tab to see checks based on the SDK activity the Simulator observes and the selected app's catalog. The [Launch checklist](../launch-checklist/index.md) is the full list of requirements, including those assessed manually by a reviewer.

### Requirement tracks

Checks are grouped into three tracks:

| Track               | What it means for submission                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Basic Launch**    | Every applicable automated check must pass to enable **Submit for review**.                                                                              |
| **Fund applicants** | Every applicable automated Basic Launch and Fund check must pass to enable a Jest Fund application. Fund checks do not block an ordinary app submission. |
| **Recommended**     | These checks help improve the experience, but do not block submission or a Fund application.                                                             |

Requirements marked as reviewed manually are assessed after submission. Passing the automated checks lets you submit; the reviewer still evaluates the app's quality and other manual requirements.

### Check states

Each automated check has one of four states:

- **Pass** — the rule saw what it expected.
- **Warn** — the rule found something to improve, such as scheduling notifications late after registration or using the same body for every notification.
- **Fail** — the rule detected a problem, such as an incomplete D1–D7 notification sequence or prompting an already-registered user to log in.
- **Waiting** — the rule has not seen the activity needed to satisfy it yet. Exercise the relevant flow and read the check's detail for the next action.

**Waiting and Warn are not passing states.** Either one on an applicable Basic Launch check keeps submission disabled. The same states on Fund checks prevent a Fund application, while Recommended checks never block either action.

Some blocking results, such as a recorded SDK error or a late first notification, persist even if you retry the flow. **Reload app** keeps the SDK log and Simulator state. To start a clean submission attempt after fixing the issue, refresh the full Simulator page in your browser or leave and reopen the submission flow, then repeat the required flows. This clears the log, discards any recording, and resets in-session configuration.

### Which checks apply

The checklist skips checks that do not apply to your app. For example, purchase checks are skipped when the app has no products in its platform catalog, subscription checks are skipped when it has no subscription plans, and custom registration-overlay checks depend on whether your app uses that flow. Skipped checks are excluded from the counts.

If your backend schedules notifications through the Jest API rather than the SDK, enable **Notifications are sent server-to-server** in the Checklist tab. This skips the automated notification checks across all three tracks and records the declaration for your reviewer. Manual notification requirements still apply.

### Exercise the required flows

Work through the [Launch checklist](../launch-checklist/index.md) for the requirements and verification steps for each applicable flow. Use the [Config panel](#configure-the-mocked-host) to prepare the player, purchase, and subscription states needed for testing. Each check's detail and documentation link help you identify the next action.

## Configure the mocked host

The Simulator's right-hand **Config** panel lets you set up mocked platform state for the session:

- **Player** — toggle registration, edit username/avatar, or log out to restart as a guest. After simulated registration, select **Reload app** to test a returning user with the same player state.
- **Entry payload** — edit the payload the app receives on startup. Changes reload the iframe so the app re-runs initialization.
- **Player data** — pre-seed user data, or pull the current in-app state into the editor with **Use live state**.
- **Notification assets** — register known asset references so the checklist can validate them.
- **Purchases** — configure products, choose canned responses for `BeginPurchase` / `CompletePurchase`, and manage incomplete purchases for recovery testing. When you load an app version, the first catalog product is queued as a pending purchase automatically. To seed one manually, add a purchase under **Config → Purchases → Incomplete purchases**, then select **Reload app**. Remove pending purchases to test a clean startup.
- **Subscriptions** — edit plans, choose canned responses for begin/cancel, and select **Activate** next to a subscription to simulate a user who already holds it. Select **Reload app** so your app re-reads the entitlement.
- **Referrals** — seed referral entries for `GetReferrals`.

Everything in the Config panel is in-session only. Nothing here writes back to the platform.

### Signing configuration

Open **Config → Signing** to see how player, purchase, referral, and subscription responses are signed:

- **App selected:** responses use the selected app's shared secret.
- **No app selected (standalone URL mode):** responses use a generated local Simulator key and audience. Your app's shared secret will not verify these responses.

For standalone URL mode, copy **Shared secret (base64url)** and **Audience (aud)** from **Config → Signing** into your test backend's verifier configuration. Use the base64url-decoded key and the displayed audience. See the [signed player payload reference](../sdk/player.md#get-a-signed-player-payload) for signature-verification details.

**Regenerate** changes both the key and audience. After using it, copy the new values into your test verifier and request fresh signed responses.

## Simulated purchases are flagged

The purchases and subscriptions the Simulator fabricates keep the prices you configured, so treat the amounts as real for display testing, but every one carries `sandbox: true` — including inside the signed token. Tokens use the key described under [Signing configuration](#signing-configuration). Have your backend check that flag before it books revenue or hands out anything of value. See [Recognize sandbox purchases](/sdk/payments#recognize-sandbox-purchases).

