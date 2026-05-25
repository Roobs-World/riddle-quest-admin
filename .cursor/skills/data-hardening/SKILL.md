---
name: data-hardening
description: Harden the data layer by normalizing API responses, separating DTOs from domain models, validating all inputs/outputs, and introducing typed API clients. Use when asked to improve data handling, fix API types, harden validation, or review the data layer.
---

# Data Hardening

## Steps

1. Normalize API responses — consistent shape, no `undefined` fields, nulls handled explicitly.
2. Separate DTOs from domain models — raw API types must not leak into business logic.
3. Validate all inputs and outputs with Zod schemas at boundaries.
4. Introduce typed API clients — no raw `fetch` calls without return type assertions.
5. Ensure predictable error handling — typed error variants, no swallowed errors.
6. Reference memorybank (`memory-bank/`) for previously identified API/data layer issues.
7. Log new drift and generate follow-up tasks in memorybank.

## Output format

For each issue:

- **File**: path
- **Type**: `unnormalized-response` | `dto-leak` | `missing-validation` | `untyped-fetch` | `swallowed-error`
- **Detail**: what was found
- **Fix**: specific remediation step
