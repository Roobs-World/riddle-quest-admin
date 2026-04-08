---
name: boundary-audit
description: Audit Server/Client component boundaries in a Next.js app. Detects unnecessary "use client" directives, server code leaked into client components, hydration risks, cache misuse, and app/package boundary violations. Use when asked to audit boundaries, review component separation, or check for RSC violations.
---

# Boundary Audit

## Steps

1. Scan for unnecessary `"use client"` — components with no hooks, events, or browser APIs.
2. Detect server-only imports (`next/headers`, `prisma`, `server-only`) used inside client components.
3. Flag hydration risks — server/client markup mismatches, non-deterministic renders.
4. Check cache misuse — missing `cache()`, incorrect revalidation, stale data patterns.
5. Detect violations of app/package import boundaries.
6. Query memorybank (`memory-bank/`) for past boundary drift before reporting.
7. Log all new violations to memorybank as drift entries and generate follow-up tasks.

## Output format

For each violation:
- **File**: path to the offending file
- **Type**: one of `unnecessary-use-client` | `server-leak` | `hydration-risk` | `cache-misuse` | `boundary-violation`
- **Detail**: what was found
- **Fix**: specific remediation step
