# Package modernization

Last reviewed: 2026-08-09.

The workspace uses current direct releases from the npm registry, with one compatibility family documented below. New package capabilities are adopted when they improve production behavior, development feedback, security, or maintainability without changing game semantics.

## Adopted capabilities

- React 19.2 with the stable React Compiler 1.0, wired through the official `@vitejs/plugin-react` v6 preset for automatic component and hook memoization.
- Vite 8's Rolldown build pipeline, native TypeScript path resolution, integrated DevTools, and browser error/warning forwarding during development.
- OpenAI SDK 7's Responses API with Zod structured outputs, stable prompt-cache routing keys, concise output, current reasoning configuration, and `store: false` for stateless riddle generation and review.
- Jest 30 global cleanup in every workspace to reduce cross-suite memory retention. The scalability refactor retains its mandatory 100% coverage gate.
- Zod 4's current `.check()` refinement API instead of deprecated `.superRefine()` usage.
- Firebase's modular browser SDK, Firestore Lite for client reads, second-generation callable functions, App Check enforcement, and Node 22—the newest runtime currently supported by Firebase Functions.
- Sentry 10's current span API, explicit PII disabling, encrypted DSN validation, and application-specific telemetry redaction.
- TypeScript 6 strict checking with explicit environment types and options that prepare the project for the native TypeScript 7 compiler.

## Compatibility constraint

The React Compiler pipeline uses Babel 7.29 rather than Babel 8. Babel 8 is the registry's newest major, but `ts-jest` 29—the current TypeScript transformer compatible with Jest 30—declares Babel `<8`. Babel 7.29 is also explicitly supported by `@rolldown/plugin-babel`. Keeping this compatible set avoids unresolved peers and preserves the repository's mock-hoisting semantics. Revisit when the Jest TypeScript transformer supports Babel 8 or Vite provides a non-Babel React Compiler path.

## Deliberate non-adoptions

- React `Activity` and `useEffectEvent` are semantic APIs, not global optimizations. They should be introduced only where a specific UI lifecycle requires them.
- Sentry log forwarding remains disabled because Firebase logging is already authoritative; duplicating every log would add telemetry volume and cost.
- Firebase Functions remains on Node 22 because Node 24 is not currently offered as a Firebase Functions runtime, even though local tooling uses Node 24.

`pnpm check:modern-packages` prevents the adopted configuration from silently regressing. Run `pnpm outdated -r`, `pnpm peers check`, and `pnpm audit --prod` during each package review.
