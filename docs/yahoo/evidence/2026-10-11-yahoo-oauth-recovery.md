# Yahoo OAuth recovery — 11 October 2026

The repository-review finding `review-riddle-quest-yahoo-oauth-timeout` is locally verified. Token exchange now uses an eight-second abort signal, including response-body consumption. Expired signed state, provider/network failures, malformed responses and invalid tokens return a fixed page linking to a fresh OAuth flow. The response never includes the provider error, authorization code or tokens. Cookie/state, signature, issuer, audience, expiry, nonce and algorithm rejection remain enforced.

Verification:

- `NODE_OPTIONS=--experimental-vm-modules pnpm exec jest --config jest.config.js --runInBand src/__tests__/yahooOAuthEndpoints.test.ts`: 18 tests passed with mocked exchange transport and real cryptographic keys.
- ESLint on the changed handler and regression suite: passed.
- Backend `pnpm check:types`, including its required shared-package preparation: passed.

The initial direct TypeScript invocation reported stale shared-package exports. The standard repository preparation resolved those errors without changing product code or weakening checks.

This source change has not been deployed. Hosted Yahoo sign-in must be accepted against the separately authorized backend release. Fresh Jest provider evidence still reports the 8 October rejection and no published/in-review revision; it does not establish acceptance of newer local changes.
