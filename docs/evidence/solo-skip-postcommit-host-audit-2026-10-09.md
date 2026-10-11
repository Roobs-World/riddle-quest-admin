# Committed Skip versus successor-load failure

Three type-checked host-handler diagnostics use a successful authoritative Skip followed by unavailable or throwing successor loads. Two fail; the ordinary unavailable-load control passes. Each authoritative paid call occurs exactly once.

When loadAndPostRiddle returns false, the handler retains one successful Skip reply. The real host loader reports loadRiddle failure and schedules its existing bounded recovery for ordinary owned failures, so no additional payment retry should be introduced for that case.

When the successor loader rejects unexpectedly, the handler's shared catch posts a second Skip reply for the same request: a transport exception becomes retryable payment failure, and a failed-precondition exception becomes definitive payment rejection. Both occur after the successful authoritative payment reply. This conflates committed payment with subsequent content delivery.

The diagnostics inject exceptions at the loader contract; they do not establish that ordinary production outages escape the real loader's own catch. Source inspection confirms that the paid call, successful reply, telemetry and successor loading currently share one catch. A fix should separate the authoritative payment boundary from post-commit delivery and preserve the existing load recovery path, without inventing a new charge or claiming the committed action was rejected.

Executable diagnostics, Jest results and reviewed source hashes are in artifacts/solo-skip-postcommit-host-audit-2026-10-09/. No production source changed. Browser and target-build verification will be needed after implementation. Nothing was deployed or published; the broader goal remains active.
