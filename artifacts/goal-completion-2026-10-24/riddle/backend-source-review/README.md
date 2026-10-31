# Backend source comparison

Reviewed on 24 October 2026 against the source archive recorded by the verified 20 October deployment. The exact retained source is `gs://gcf-v2-sources-329028367192-us-central1/joinLiveRace/function-source.zip#1792466179351345`. The archive was downloaded read-only into a private temporary directory and is not included here.

Eight compiled JavaScript files differed from the prior staging receipt. Four live-race files have identical parsed JavaScript syntax trees, with only comments and formatting changed. The comparison excludes source positions, comments and the source file's full-text field. Results are in `syntax-review.json`; individual textual diffs are retained here.

The four functional changes bind Facebook and Reddit referral settlements to the completion receipt that first earned them, restrict a completion's displayed referral reward to that matching receipt, and preserve valid anonymized receipt attribution when an account is deleted. The settlement transaction still creates a single canonical reward grant. Legacy settlements without attribution are not assigned to a later win. The new attribution accepts only a 64-character lowercase hexadecimal receipt hash.

Manual review found no additional deployment blocker in these changes. This comparison is independent of dependency vulnerability checks, backend tests, deployment success and live verification. Those gates must pass separately before the new backend can be reported delivered.
