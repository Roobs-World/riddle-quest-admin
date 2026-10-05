const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const portal = path.join(root, 'packages/portal');
const scripts = JSON.parse(fs.readFileSync(path.join(portal, 'package.json'))).scripts;
const excluded = new Set(process.env.READINESS_BROWSER_SKIP?.split(',') ?? []);
const selected = process.env.READINESS_BROWSER_ONLY ? new Set(process.env.READINESS_BROWSER_ONLY.split(',')) : null;
const names = [...scripts['test:game-browser:playwright'].matchAll(/&& pnpm (\S+)/g)]
  .map(match => match[1]).filter(name => !excluded.has(name) && (!selected || selected.has(name)));
const results = [];
const directory = path.join(__dirname, process.env.READINESS_BROWSER_REPORT ?? 'browser-matrix');
fs.mkdirSync(directory, {recursive: true});
const snapshot = () => {
  const hash = createHash('sha256');
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '__tests__') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else {hash.update(path.relative(root, file)); hash.update(fs.readFileSync(file));}
    }
  };
  visit(path.join(portal, 'src'));
  visit(path.join(root, 'packages/core/src'));
  visit(path.join(root, 'src/locales'));
  return hash.digest('hex');
};
const save = () => fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify({
  updatedAt: new Date().toISOString(), scripts: names, results,
}, null, 2) + '\n');
async function worker() {
  while (namesToRun.length) {
    const name = namesToRun.shift();
    const log = path.join(directory, name.replaceAll(':', '-') + '.log');
    const output = fs.openSync(log, 'w');
    const before = snapshot();
    const started = Date.now();
    console.log(`START ${name}`);
    const child = spawn('pnpm', ['run', name], {cwd: portal, env: {
      ...process.env, PORTAL_USE_EXISTING_BUILD: '1',
    }, stdio: ['ignore', output, output]});
    const exitCode = await new Promise(resolve => {
      child.once('error', error => {fs.writeSync(output, String(error)); resolve(-1);});
      child.once('exit', (code, signal) => resolve(code ?? signal));
    });
    fs.closeSync(output);
    const after = snapshot();
    const row = {name, exitCode, durationSeconds: (Date.now() - started) / 1000,
      sourceSha256Before: before, sourceSha256After: after, sourceStable: before === after, log};
    results.push(row); save();
    console.log(`${exitCode === 0 ? 'PASS' : 'FAIL'} ${name} (${row.durationSeconds}s; stable=${row.sourceStable})`);
  }
}
const namesToRun = [...names];
Promise.all(Array.from({length: 3}, worker)).then(() => {
  console.log(`${results.filter(row => row.exitCode === 0).length}/${results.length} browser scripts passed.`);
  if (results.some(row => row.exitCode !== 0 || !row.sourceStable)) process.exitCode = 1;
});
