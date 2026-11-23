# braces 3.0.3 recursion backport

The npm registry still publishes 3.0.3 as latest. CVE-2026-93687 has no released
fix as of 2026-10-04. The installed package is patched through pnpm, with its
patch hash recorded in the lockfile.

Source: [upstream PR72](https://github.com/micromatch/braces/pull/72), exact commit
`28d440b5dd449dbf1fe6f3506cf94ecca4d02660`, compared against tag `3.0.3`.
Only the security changes in `lib/parse.js`, `lib/constants.js`,
`lib/compile.js`, `lib/expand.js`, and `lib/stringify.js` were backported.
Unrelated quote parsing, comma handling, workflow, package and test-shim changes
were excluded.

The patch caps brace and parenthesis nesting at 100, honors stricter requested
limits, guards caller-supplied AST depth, and rejects cyclic parent chains.
Ordinary glob compilation, expansion, ranges and escaping retain their behavior.

`pnpm check:braces-security` exercises the actual package resolved through
Devvit's CLI and chokidar, including excessive input, ASTs, cycles, boundary and
compatibility cases. Production verification runs this check before its audits.
The advisory exception is limited to GHSA-vfj7-8cjw-p6xm and is conditional on
those installed-patch checks; it does not exempt unpatched braces.

Compatibility evidence on 2026-10-04: all 764 tests in the 12 unmodified
upstream 3.0.3 test files passed against the installed patched library using a
`node:test` describe/it bridge and the real system Bash. This supplements the six
security checks; it does not claim a run under upstream Mocha or game E2E.

Replace the backport with a verified upstream fixed release when available,
then remove the patch registration and this audit exception. A successful audit
with the backport is a local mitigation check, not evidence of an upstream fix or
of full application E2E completion.
