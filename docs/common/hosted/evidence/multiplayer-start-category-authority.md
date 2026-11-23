# Accepted challenge category

Two baseline regressions showed direct and provider challenge starts accepting another category when recording identity, role and opponent still matched. Rewriting the public category to agree with the response could hide that contradiction.

Start validation now also compares the returned category with the private accepted preview supplied to authority validation. No visible copy or locale keys change. An explicit different challenge with no retained preview still uses its separate request context, as verified by retained controls.

The full client suite passes 1,745 tests across 206 suites, with 102 tests and 13 suites skipped. Twelve injected-browser cases click actual challenge acceptance for direct/provider entries at desktop/mobile widths: category mismatch, public category rewrite and valid controls. Invalid cases show the existing translated response error and send no readiness; valid cases issue readiness once. Forty-two retained cases pass across direct/provider start selection and existing attempt/opponent recovery.

All seven isolated builds, exact dependency evidence, portal types, security and scalability pass. Focused documentation and file sizes pass; global concurrent documentation and hosted E2E size failures remain. The manifest retains preceding gates and adds category authority, for 76 checks. Source, artifact and log hashes are held in `artifacts/race-start-category-authority/verification-held.json`.

The 334 captured backend source/config files remain unchanged from the preceding fresh integrated race coverage run; backend tests are not repeated for this client-only condition. No hosted draft update, Jest publication or Firebase deployment occurs. Dashboard completion remains pending stable full-source gates, and the broader multiplayer reliability audit continues.
