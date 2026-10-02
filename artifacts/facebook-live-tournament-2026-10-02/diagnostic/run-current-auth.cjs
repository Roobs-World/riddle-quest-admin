// Explicitly scoped verification; deferred recorded-race cases remain failed/unverified.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const reportRoot = path.resolve(__dirname, '..');
const pattern = fs.readFileSync(path.join(__dirname, 'current-auth-pattern.txt'), 'utf8');
const result = spawnSync('pnpm', ['exec', 'jest', '--config', 'jest.config.cjs', '--runInBand', '--runTestsByPath',
  'src/jest/__tests__/authentication.jest-playwright.test.ts', '--testNamePattern', pattern, '--verbose',
  '--reporters', 'default', '--reporters', path.join(__dirname, 'case-progress.cjs')], {
    cwd: path.join(root, 'packages/portal'), stdio: 'inherit',
    env: {...process.env, PORTAL_BROWSER_TESTS: '1', PORTAL_USE_EXISTING_BUILD: '1',
      PORTAL_JEST_BUILD_DIR: '/tmp/riddle-fb-live-tournament-20261002-vpWOVl/jest',
      AUTH_DIAGNOSTIC_LOG: path.join(reportRoot, 'current-auth-progress.jsonl')},
});
process.exit(result.status ?? 1);
