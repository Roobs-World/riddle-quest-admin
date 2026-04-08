---
name: scalability-review
description: Review codebase for scalability concerns including N+1 query risks, over-fetching, caching strategy gaps, memory footprint, and ISR/SSR decisions. Use when asked to review scalability, performance under load, query efficiency, or caching strategy.
---

# Scalability Review

## Steps

1. Detect N+1 query risks — loops containing database calls, missing `include`/`select` on relations.
2. Check for over-fetching — selecting more data than the UI consumes.
3. Evaluate caching strategy — missing `cache()`, no ISR where applicable, stale-while-revalidate gaps.
4. Assess memory footprint — large in-memory collections, missing pagination.
5. Simulate high-load scenarios mentally (10k → 1M users) — identify breaking points.
6. Query memorybank (`memory-bank/`) for past scalability issues.
7. Log new drift entries and tasks in memorybank.

## Output format

For each issue:
- **File**: path
- **Type**: `n-plus-one` | `over-fetching` | `cache-gap` | `memory-risk` | `pagination-missing`
- **Severity**: `high` | `medium` | `low`
- **Detail**: what was found
- **Fix**: specific remediation step
