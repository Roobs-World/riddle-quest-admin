// Local isolated builds only; this script never uploads or deploys.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const reports = path.resolve(__dirname, '..');
const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riddle-provider-readiness-20261002-'));
const results = [];
for (const target of ['facebook', 'reddit', 'youtube', 'netflix', 'yahoo']) {
  const output = path.join(buildRoot, target);
  const log = fs.openSync(path.join(reports, 'build-'+target+'.log'), 'w');
  const result = spawnSync('pnpm', ['--filter', '@qwordly/portal', 'build:'+target], {
    cwd: root, env: {...process.env, [target.toUpperCase()+'_BUILD_OUT_DIR']: output},
    stdio: ['ignore', log, log],
  });
  fs.closeSync(log);
  results.push({target, output, exitCode: result.status});
  fs.writeFileSync(path.join(reports, 'other-build-results.json'), JSON.stringify(results, null, 2)+'\n');
  process.stdout.write(target+': '+result.status+'\n');
}
process.exit(results.every(row=>row.exitCode===0)?0:1);
