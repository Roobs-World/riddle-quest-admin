# Startup work reduction, November 26, 2026

Jest now starts its first incomplete-purchase queue read alongside signed identity
and saved-state reads. The initialization and deletion gates run first. All reads
must succeed before startup continues, and urgent purchase reconciliation still
finishes before profile lookup and identity exchange. Async wrappers ensure that
synchronous adapter failures cannot leave another read's rejection unobserved.
The SDK purchase recovery contract is documented in [Jest Payments](https://docs.jest.com/sdk/html5/payments).

The shared mobile capability reader now checks existing decoration eligibility
before creating a temporary WebGL context. Reduced motion, data saving, low memory,
low core count and slow connections already disable the optional scene; these
devices no longer allocate and release a graphics context just to reach that
decision. Eligible devices still probe support and release the probe context.

Bundled-content validation segments each answer once instead of twice. This
retains the same grapheme limits and validation error while reducing repeated
work when YouTube, Netflix, Yahoo and GameSnacks load a locale pack.

TypeScript and platform-boundary checks passed. YouTube, Netflix and Yahoo
production builds and artifact audits passed; GameSnacks built and packaged
successfully. The Jest production release gate passed, including hosted-target
builds and audits. The exact uploaded Jest build is confirmed ready and active
in the [release evidence](../../../jest/evidence/jest-startup-work-reduction-2026-11-26.json).
No tests or browser harnesses were requested or run. These changes remove
identifiable work and a sequential SDK wait; no measured time-to-play or
frame-rate improvement is claimed.
