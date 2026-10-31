The current Simulator startup failure matches a cold CORS preflight exceeding the client's 15-second backend deadline. It does not reproduce the prior immediate Google Frontend HTTP 500 in this checked window.

Read-only Cloud Logging window: 2026-10-22 23:51:45.217559 UTC through 2026-10-23 00:01:45.217559 UTC. Function: grantJestPurchase, unchanged revision grantjestpurchase-00051-num.

- OPTIONS began 00:00:48.084197 UTC and returned HTTP 204 with recorded latency 16.455872914 seconds.
- A new instance started 00:00:48.150086 UTC.
- Its startup TCP probe succeeded 00:01:04.887423 UTC.
- No purchase POST or 4xx/5xx request appears in the checked window.

The current frontend backend deadline is 15,000ms (packages/portal/src/jest/backend.ts). Pending purchases are reconciled before completing identity startup. The client only calls completePurchase after the authoritative grant succeeds, so the preflight failure leaves recovery pending rather than acknowledging an ungranted purchase. Root's Simulator observation of one pending purchase followed by startup failure is consistent with this sequence; this diagnostic did not inspect signed purchase contents or send any purchase request.

This establishes a transport timeout for the observed attempt. It does not establish successful signed grant recovery; root is checking the already-authorized single native Simulator retry separately. Logs can arrive with ingestion delay, and this extract stops at the explicit window end.

Sanitized evidence: grant-startup-logs-20261023T000145Z.json. Only request method/status/latency and platform startup messages are retained. No request URLs, headers, IP addresses, player/purchase payloads or credentials are saved. No runtime, configuration or deployment changes were made, and no health or purchase request was issued by this diagnostic.
