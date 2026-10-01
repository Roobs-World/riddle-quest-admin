# Multiplayer guess progression evidence

Correct-answer and automatic-skip acknowledgements previously consumed the submitted-answer checkpoint without requiring their recorded scoring or charge event. Six public-session cases failed before the fix: missing correct event, event for another question, unchanged correct score, contradictory correct/automatic-skip flags, automatic skip without a charge and automatic skip without an advanced cleared count.

The authority application now rejects contradictory flags, requires correct replies to advance the score and retain a new correct event for the submitted question, and requires an active correct reply to advance the question. Automatic skips reuse the existing paid-skip evidence validation, including its original charge, event, advanced score and question transition. Validation precedes checkpoint consumption. It uses the confirmed authority snapshot rather than the immediate local projection.

The full client race suite passes 483 tests across 37 suites. Rejection restores the original submitted answer; a subsequent valid resume accepts committed progress and restores successor input without repeating the mutation. Positive cases accept progress appended by another tab and real canonical completion at ten clears through either a correct answer or an automatic skip.

Existing lifetime, outcome and publication fixtures omitted scoring events. Clean terminal fixtures now author the complete all-correct history, a repeated-content automatic-skip fixture includes its charge event, and successor-confirmation fixtures include the accepted correct event. The recorded-result helper explicitly asserts that setup reaches the accepted result stage before testing outcome and publication behavior. Original corruption and lifetime assertions are retained.

Eight real React browser cases exercise missing correct evidence, wrong-question evidence, contradictory flags and missing automatic-skip charge at desktop and mobile sizes. Every case restores submitted input, recovers question two through one resume, and sends the guess once. There are no browser errors. The mobile automatic-skip recovery screenshot was inspected: one clear and the 45-second charge are visible with usable controls. Portal type checking passes. The documentation preflight found and corrected one missing local declaration comment.

The development manifest requires all fifteen gates, including full backend emulator coverage, client/core tests, types, lint, architecture safeguards, browser verification and seven isolated platform builds. Completion requires unchanged source and verified artifact hashes before dashboard recording.

No visible text or locale content changed. This local verification does not upload, activate or publish Jest or deploy Functions. Jest activation and Firebase Functions deployment are authorized; game publication, review submission and listing visibility remain held. The reliability audit remains active.
