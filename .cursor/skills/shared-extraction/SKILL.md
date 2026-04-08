---
name: shared-extraction
description: Extract framework-agnostic shared logic from app code into packages/core/. Identifies React-coupled logic that should be pure, removes React imports from shared modules, and ensures strict typing. Use when asked to extract shared logic, move code to packages/core, or reduce framework coupling.
---

# Shared Extraction

## Steps

1. Identify framework-agnostic logic — utilities, transforms, validators, constants with React imports or JSX.
2. Move the logic to `packages/core/` — create the module if it doesn't exist.
3. Remove all React imports from the extracted module.
4. Ensure strict typing — no `any`, explicit return types, generics where appropriate.
5. Update all consuming apps and packages to import from `packages/core/`.
6. Check memorybank (`memory-bank/`) for previously extracted shared modules to avoid duplication.
7. Log drift and create tasks in memorybank for any missing extractions found.

## Output format

For each extraction:
- **Source file**: where the logic lives now
- **Target**: `packages/core/<module-name>`
- **Logic description**: what is being extracted
- **Consumers to update**: list of files that need import path changes
