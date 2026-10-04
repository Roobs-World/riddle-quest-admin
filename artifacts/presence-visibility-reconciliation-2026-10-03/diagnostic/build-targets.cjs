// Owned local artifacts with explicit audits of each actual output directory. No deployment.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const portal = path.join(root, 'packages/portal');
const reports = path.resolve(__dirname, '..');
const buildRoot = path.join(os.homedir(), '.cache/riddle-quest-review/presence-visibility-reconciliation-20261003');
fs.mkdirSync(buildRoot, {recursive: true});
const results = [];
for (const target of ['reddit', 'jest', 'facebook', 'youtube', 'netflix', 'yahoo']) {
  const output = path.join(buildRoot, target);
  const log = fs.openSync(path.join(reports, 'build-'+target+'.log'), 'w');
  const result = spawnSync('pnpm', ['--filter', '@qwordly/portal', 'build:'+target], {
    cwd: root, env: {...process.env, [target.toUpperCase()+'_BUILD_OUT_DIR']: output},
    stdio: ['ignore', log, log],
  });
  fs.closeSync(log);
  const auditArgs = ['netflix','yahoo'].includes(target)
    ? ['scripts/audit-standalone-artifact.mjs', target, output]
    : ['scripts/audit-'+target+'-artifact.mjs', output];
  const auditLog = fs.openSync(path.join(reports, 'audit-'+target+'.log'), 'w');
  const audit = result.status === 0 ? spawnSync('node', auditArgs, {cwd: portal, stdio: ['ignore', auditLog, auditLog]}) : null;
  fs.closeSync(auditLog);
  results.push({target, output, buildExitCode: result.status, privateAuditExitCode: audit?.status ?? null});
  fs.writeFileSync(path.join(reports, 'build-results.json'), JSON.stringify(results, null, 2)+'\n');
  process.stdout.write(target+': build='+result.status+' private audit='+audit?.status+'\n');
}
process.exit(results.every(row=>row.buildExitCode===0 && row.privateAuditExitCode===0)?0:1);
