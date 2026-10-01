# Skip transition confirmation

A public-session reproduction failed before the fix: a genuine skip response retained its charge and original skip event, but its active question was replaced with the original question. The client accepted the charged response without advancing the attempt.

Paid confirmation now also requires an active skip's question position to advance beyond the original authority question. Terminal completed and timed_out responses still omit an editable successor and are accepted. Explicit positive public-session cases cover both terminal phases with valid charged events; malformed active skip recovery resumes the genuine committed authority snapshot instead of resending a skip.

The complete client suite passes 459 tests across 33 suites. The real UI browser harness passes six cases: desktop/mobile hint missing-charge, skip missing-charge and skip unchanged-question. Each verifies rollback to the original question, recovery error, one resume to the committed state, no repeated paid request and no browser errors. The mobile recovered unchanged-question skip view was inspected.

Verification correction: the earlier skip browser fixture omitted required penaltyAddedMs, so its rejection was due to shape validation. This pass corrects that fixture; both semantic skip cases now carry every required response field. The earlier evidence document records this limitation. The original public-session missing-charge reproduction was unaffected because it used genuine full authority responses.

No UI text or locale changes. The development task runs full backend coverage, core/client checks, seven isolated builds, dependency/security gates and the corrected browser harness before recording current-source completion. Jest activation is authorized; publication and review remain held. Firebase Functions deployment is authorized, but this verification performs no deployment. The overall reliability audit remains active.
