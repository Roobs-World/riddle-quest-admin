# Notification request modal and sandbox setup

The reported message was "Notification settings could not be saved. Please try again." The affected active Jest version was `01a21016-96b0-70b8-b024-b0321c3ac82a`, built from `ab9418699`.

## Observed failure

A read-only fetch of the public Jest game page found the game iframe sandbox set to `allow-scripts allow-same-origin allow-forms`. It grants neither popup creation nor top-level navigation. The installed Jest SDK exposes no arbitrary external URL opener. The [official redirect documentation](https://docs.jest.com/sdk/html5/app-redirects) limits its redirect API to another game owned by the same team.

Cloud Logging showed three successful `getNotificationEnrollmentStatus` POST requests between 01:33:52 and 01:33:54 UTC, with no preference-save or enrollment-creation request in the inspected window. The client returned early when `window.open` failed, before calling Firebase. Its provider classified that setup failure as a preference-save failure.

## Changed behavior

The notification request now opens in its own modal after the startup menu and instructions close. Registration, guidance, other dialogs and multiplayer retain presentation ownership until they finish. Guests, saved Off preferences, unsupported providers and already connected devices do not receive a setup request.

An explicit setup action creates a strictly validated, account-bound enrollment link even when the host denies the popup. The player can copy the link into their browser or select it manually if clipboard access is also denied. The link is excluded from game screenshots, expires after its server-issued lifetime and is cleared on retirement or confirmed enrollment. Request generations prevent retired requests and older pairing-status responses from replacing or clearing a newer link.

Preference-save errors, setup errors and delivery-status failures remain distinct. A successful save is still successful when the subsequent status check is unavailable. Initial delivery restoration stays busy until the provider can determine whether a request is needed.

## Verification and release boundary

Jest, Facebook and Yahoo production builds and artifact audits pass. Android's shared-contract type check passes. Regression specifications cover denied popups, handoff validation and expiry, account replacement, asynchronous retirement, stale pairing-status responses and save/status separation. Tests and browser harnesses were not run under the repository's explicit-request policy.

This source change does not upload or activate a replacement Jest build or deploy Firebase Functions. Real-device enrollment and notification display remain unverified for the replacement source.
