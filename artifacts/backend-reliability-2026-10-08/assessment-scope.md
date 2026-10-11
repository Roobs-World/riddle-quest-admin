Current backend reliability assessment: all unit behavior and all 87 .it.test.ts real emulator suites, pinned Node 22.23.1, actual canonical/current copied core files, TypeScript/ESLint/module cycles/scalability audit, and deployment-validation script tests.

Owned Firestore/RTDB/Storage emulators use project demo-riddle-quest-current-audit and loopback ports allocated by the launcher. The Jest demo guard excludes operator dotenv overrides. Suites run serially in one worker with the existing 1536MB recycling setting, because transaction fixtures share their demo namespace. No deploy or live data action is authorized or attempted.

Test selection comes from current filesystem tests, not the older 38-suite partial selection. Current source is frozen after normal core preparation. Source manifest adds actual runtime/config inputs to the previous client manifest. Each copied core directory must have the exact canonical file set and byte-identical content/package manifest.

Limitations: demo transaction/rule behavior and structural work bounds do not certify production latency, deployed revisions, real external SDK/provider outages, or rollout/TTL installation. Existing retirement-aware client release ordering still requires the matching server and Devvit/TTL rollout. No live deployment evidence is inferred.
