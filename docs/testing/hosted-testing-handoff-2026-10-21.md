# Test the current hosted Jest game

Prepared for 21 October 2026. This document preserves the [20 October handoff](hosted-testing-handoff-2026-10-20.md) as historical evidence.

Use this checklist to test the unpublished Riddle Quest game. Record **PASS**, **FAIL**, or **BLOCKED** for each numbered check. Use **NOT APPLICABLE** for landscape checks if the Jest host enforces its configured portrait orientation. None of the hosted checks below has been run as part of this handoff.

## Confirm the build and access

The active build is `1.0.0-dev.20261020-keyboard-complete.mvfvxio4`, version ID `01a1567e-c03d-712d-b40e-2ef13b822050`. Jest activated it at 04:18:04 BST on 20 October 2026. Fresh metadata confirms the same version remains active and ready, with no processing error. The game remains unpublished, with no published or in-review revision. See the [deployment and activation evidence](../evidence/continuation-release-2026-10-20.md).

Today's backend readback confirms all sixteen selected regional instances remain ACTIVE on Node 22, with the expected revisions and latest traffic. Source provenance still matches the verified release. There is no current backend readiness blocker. See the [21 October backend readback](../../artifacts/testing-readiness-20261021/backend/backend-readiness.json).

Open the [exact active version](https://jest.com/g/riddle-q?versionId=01a1567e-c03d-712d-b40e-2ef13b822050). Use this URL for the initial checks. Before testing SMS entry, confirm that this version is still active because generated invitations can open the active game. The ordinary game URL is [jest.com/g/riddle-q](https://jest.com/g/riddle-q).

The user reports that Console sign-in is complete, but the connected Chrome profile still reaches **Sign in** when Console is reopened. The signed-in session must be matched to the browser profile available for testing. Actual Console authentication and Sandbox Users A, B, and C remain unverified. This does not establish that those accounts are absent. The authenticated Jest connector does not expose Sandbox User management. See the [Console access readback](../../artifacts/testing-readiness-20261021/frontend/console-access.json) and [current readiness summary](../../artifacts/testing-readiness-20261021/readiness-summary.json).

Complete these owner-controlled access steps before the hosted checks:

1. Use the Console session after its sign-in has been verified. If the browser still requests authentication, complete sign-in yourself.
2. Open **Sandbox Users**. Use suitable existing users, or select **Create Sandbox User** for the dedicated test identities. The documented limit is three per developer.
3. Select **Generate Login Link** for each test identity. Open each private login link in a separate browser profile or device, then open the exact active-version URL.
4. Confirm that each identity can enter this unpublished game. Mark any access failure **BLOCKED** before testing multiplayer.

Use the provider's [Sandbox Users instructions](https://docs.jest.com/dev-console/sandbox-users) and [two-user sandbox workflow](https://docs.jest.com/testing/sandbox). Do not substitute a simulator session for hosted platform verification. Do not share the private login links publicly.

Prepare these test resources before starting:

- Three dedicated Jest Sandbox Users named A, B, and C. Keep each account in its own browser profile or device. Do not share account sessions between testers.
- Two phones for A and B, with an agreed SMS recipient and permission to send a test invitation. C can use a separate desktop browser profile.
- A desktop browser and a phone in portrait. Include a narrow portrait view near 320 px. Use landscape near 844 by 390 px only if the hosted game permits it.
- A fresh Sandbox User for the unfinished Daily and first-win achievement. The 07:36:40 BST backend readback confirms all sixteen current regional Daily documents are playable. Their keys span 20 and 21 October because the regional 09:00 rollover has not occurred everywhere. No account data was seeded and no achievements or currency were granted for this handoff.
- A provider-confirmed sandbox subscription session and a Sandbox User without an active subscription. Step 3 can establish sandbox active access through normal checkout. Continue only when the provider UI confirms that no charge will occur. Do not complete a real-money purchase.
- A way to interrupt one phone's connection briefly without changing the other phone's connection.

Match the same content language and category for public searches. Start only the intended two searchers. Public matchmaking can select another eligible person who is waiting in the same pool.

The game's current hosted orientation setting is portrait. If rotation leaves the game in portrait, record the host restriction and mark only the landscape branch **NOT APPLICABLE**. Do not classify the intentional host lock as a keyboard defect or change the orientation setting for this session. Prior local landscape checks remain linked below.

## 1. Check the keyboard and answer cells

1. Open a puzzle in portrait. Tap the left edge, center, and right edge of several letter boxes, about one pixel inside each visible edge. Include Q and the final key in each row. Each tap enters one intended letter, without an adjacent letter or an action.
2. Tap Backspace near both edges. Each tap removes one letter. Hold a letter near its edge, then release it. The box stays stationary and accepts one press.
3. Tap each editable answer circle. The intended circle becomes active. The tap must not enter a keyboard letter or trigger Hint, Submit, or Skip.
4. If the host permits landscape, rotate and repeat the edge taps and circle selection. The keyboard must remain separate from the answer grid and all three actions. Check Backspace and the circle nearest the keyboard especially closely. Otherwise, record the portrait restriction.
5. Open Settings or Hint. Tap where the underlying keyboard is visible, then press Tab several times on desktop. The answer stays unchanged and focus remains in the visible modal. Dismiss the modal and confirm that typing resumes.
6. Spot-check Turkish dotted İ and dotless I, then an Arabic RTL layout. Confirm that the intended letter or slot receives each tap. Repeat landscape separation in RTL only if the host permits landscape.

## 2. Finish Daily and observe achievements

1. Complete an unfinished Daily with the test account. Record the result presentation. The result modal appears before any achievement notification. Notifications must not intercept the modal's controls.
2. Use a completion that earns an achievement. Keep the result modal open until the notification appears. The notification runs behind the modal after the modal is visible. Optional saving must not replace the successful result with an error or require dismissal of the notification first.
3. Select **Next** once it becomes available. The game opens Classic and shows the next playable Classic puzzle. The completed Daily must not reopen. Next must remain unavailable while the final answer or completion acknowledgement is pending.
4. Reload, then open the profile's achievements. The confirmed achievement remains saved. A reload must not grant the same completion reward again.
5. If another test account has an unfinished Daily, repeat with a loss and decline continuation. Advancing from the completed Daily must lead to Classic. Do not buy continuation solely for this check.

## 3. Check subscription exclusion in the sandbox

1. With a Sandbox User that has no subscription, open subscription checkout. Confirm that the provider UI identifies the purchase as no-charge sandbox billing. If that confirmation is missing, stop and mark checkout **BLOCKED**.
2. Leave the sandbox confirmation unresolved. In another tab of the same account and browser profile, attempt a second subscription checkout. A second provider checkout must not start while the first remains open.
3. Cancel the first sandbox checkout. The game returns to a usable shop without claiming a new purchase.
4. Repeat checkout and complete one subscription only after confirming the no-charge sandbox UI again. After backend verification, the account has active access and no alternative payable subscription offer.
5. Reload and reopen the shop. Active access remains recognized without another checkout or duplicate grant. Selecting an already-active plan must not start another provider checkout. An existing Sandbox User with active access can also supply this check.

These checks cover the game's active-offer and same-browser exclusion. They do not establish cross-device atomic checkout or the freshness of historical provider tokens. The [subscription audit records those limits](../evidence/jest-api-alignment-2026-10-18.md).

## 4. Wait for a public human opponent

1. With A, open Multiplayer, choose a category, and start a public search. Leave B out of matchmaking for at least ten seconds. A remains waiting for a human and must not receive the former automatic bot fallback.
2. Reload A while the search is open. The account returns to its acknowledged waiting journey. Reload must not create an additional seat or a private friend lobby.
3. Briefly disconnect A. Start B's public search with the same language and category, then reconnect A. The two accounts reach the same countdown and race. A must not enter two matches or lose the journey to an unrelated replacement seat.
4. Submit an answer on each account and observe the opponent's progress. Scores reflect confirmed gameplay. If the host permits rotation, confirm that the wider keyboard still leaves the answer grid and actions usable in landscape.
5. Close the active journeys through the game before starting the private-lobby checks. If testing a forfeit without any correct answer, expect no win coins or competitive progress grant merely for waiting or leaving.

## 5. Check the private SMS lobby and its two seats

1. With A, select **Challenge a friend** inside Multiplayer. The game creates a private lobby showing one occupied seat out of two. The profile's general invitation control is outside this multiplayer check.
2. Cancel the share dialog once. A remains in the same waiting lobby. Reopen sharing, then have the authorized tester send the test SMS to B. Sending the invitation does not itself fill the second seat.
3. Reload A before B opens the invitation. A returns to its private lobby. If A opens its own invitation, the game restores that lobby instead of joining as the opponent or creating another invitation.
4. Open the SMS as B. Complete any required registered-player entry. B joins A's lobby, both players see two occupied seats, and both reach the same countdown and race.
5. After B has accepted, open that invitation as C. C cannot take a third seat, replace B, or recover either participant's private journey. A and B remain matched together.
6. Create a separate private lobby, close it through the game, then open its link as B. The closed invitation cannot start a race. For the expiry check, create a fresh lobby and leave it unaccepted until its fifteen-minute invitation window has passed. The expired link cannot admit a new recipient.

Keep C out of an unclaimed invitation until B has accepted. The invitation is a bearer link: the first eligible recipient can claim its second seat. Third-account isolation applies after the two participants are committed. Do not post a live invitation URL publicly.

## Record the result

Attach the build version, account aliases, content language, category, device, browser, local time, and the failed step. Include a screenshot or recording that shows the observed outcome. Exclude authentication tokens, phone numbers, payment details, and live invitation URLs.

Record access failures or unavailable no-charge sandbox billing as **BLOCKED**, rather than counting an unrun check as passed. If an existing account has already completed its Daily or earned its first-win achievement, use the fresh Sandbox User for that check. Leave publication and review submission unchanged.

Local checks already passed before this handoff:

- [Keyboard evidence](../evidence/keyboard-hit-targets-2026-10-20.md): 24 touch cases, 2,016 key taps, 360 editable answer-cell taps, and 165 final control-isolation checks.
- [Multiplayer evidence](../evidence/human-wait-difficulty-security-2026-10-18.md): 399 backend tests and six local browser suites. Relevant performance changes subsequently passed targeted regressions.
- [Completion and checkout evidence](../evidence/current-task-performance-2026-10-19.md): 44 completion tests, 64 checkout tests, and thirteen notification browser scenarios.

Those checks used local fixtures or emulators. Hosted Jest identity, App Check, production callable journeys, actual SMS delivery, sandbox checkout, physical devices, and a fifteen-minute wall-clock wait remain to be recorded by the hosted test session. The deployed difficulty policy affects newly authored single-player content. Existing questions are preserved, so a short manual session cannot prove a difficulty increase.
