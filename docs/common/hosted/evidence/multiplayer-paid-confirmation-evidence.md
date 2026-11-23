# Paid confirmation evidence

Two public-session reproductions failed before the fix: genuine hint and skip results were tampered to remove their recorded charge and paid event while preserving their revealed/advanced question. The client accepted those malformed confirmations instead of preserving its rollback checkpoint and entering recovery.

RaceSessionAuthority now verifies paid confirmation against the private original authority snapshot, excluding immediate local projection. The confirmed penalty must include at least the action's rule-based charge, and events added after that snapshot must contain the matching hint/skip charge at the original question position. Concurrent later actions remain allowed; the check does not require this event to be the final event. Validation occurs before consuming paid checkpoints.

Four public-session cases cover missing charges and charges attributed to a different question for both hint and skip. The complete client race suite passes 456 tests across 33 suites. The new injected browser harness renders the real RaceTo10Game at desktop and mobile sizes, performs each action, injects the missing-charge response, verifies the original question and recovery error, then resumes the genuine committed snapshot. It asserts exactly one paid action and one resume, no browser errors and restored gameplay. The mobile recovered skip view was visually inspected.

No UI text or translations change. The completion task verifies full backend coverage, core/client regressions, all seven isolated artifacts, dependency/security gates and this browser harness before recording current-source completion. Server scoring remains authoritative. Jest activation remains authorized; publication/review stay held. Firebase Functions deployment is authorized, but this verification performs no deployment. The broader reliability audit remains active.

## Subsequent verification correction

The skip browser fixture in the initial run omitted required penaltyAddedMs, so its rejection established response shape recovery rather than the intended missing-charge semantic rejection. Public-session unit reproductions used genuine complete authority responses and remain valid. The skip-transition follow-up adds the required field, reruns missing-charge and unchanged-question UI cases, and verifies both semantic failures through the real UI. Its current-source completion record supersedes the earlier browser inference.
