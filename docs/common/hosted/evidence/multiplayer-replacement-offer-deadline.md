# Replacement offer deadline

The real Firestore emulator reproduced two failures: an initial recording established a 30-second offer deadline, then the player blocked its creator and retried after 10 seconds. Replacement recordings expiring in 40 seconds or 10 minutes incorrectly extended the original intent to 40 or 70 seconds while retaining the original createdAtMs and request identity.

Offer commit now uses the earlier of the existing receipt expiry and replacement recording expiry. A genuinely new intent still receives its normal initial window. Re-selection cannot extend the original request lifetime; a sooner-expiring replacement can shorten it.

Three emulator cases cover long-lived, intermediate and shorter-lived replacements. They verify the replacement challenge and same offer ID, preserved createdAtMs, the minimum expiry, and intent-expired recovery at the exact resulting deadline. Existing concurrent winners, direct replay and explicit new-intent recovery remain in the full matchmaking suite.

No UI copy or translations change. The completion task runs backend coverage, core/client regressions, seven isolated builds, dependency and security gates, and existing desktop/mobile discovery UI compatibility checks. Server transaction correctness is established by the emulator cases, not inferred from browser rendering. Jest activation remains authorized; publication/review stay held. Firebase Functions deployment is authorized, but this verification performs no external deployment.
