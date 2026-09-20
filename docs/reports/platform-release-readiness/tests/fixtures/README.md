# Starter contract fixtures

The copied Data app suite includes contracts for the original starter's example
dashboard, report, theme and synthetic dataset. Riddle Quest replaces that authored
content. These fixtures keep those assertions reproducible without making the
production dashboard display sample data or depend on a developer's plugin cache.

Files originate from Data Analytics plugin 1.0.9 and the matching repository starter.
Original hashes, version compatibility and helper adaptations are recorded in
`data-plugin/provenance.json`.
Runtime imports and assertions still exercise this application's actual protected
runtime. `template-test-fixtures.mjs` redirects only the six customizable starter
files, never runtime source. Layout-integrity mutation tests start with default
starter CSS so the intentional wide layout cannot mask an invalid-width mutation.

The actual release dashboard is tested separately by
`release-dashboard-content.test.mjs` and the deployment-monitoring tests. Do not
use these fictional measurements in the dashboard or its monitoring pipeline.
