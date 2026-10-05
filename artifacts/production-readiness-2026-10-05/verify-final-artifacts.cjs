const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const commit = process.argv[2];
const buildRoot = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'builds');
const snapshotRoot = process.argv[4] ? path.resolve(process.argv[4]) : null;
if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw Error('Pass the verified Git commit');
function files(directory, excludeTests = false) {
  return fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (excludeTests && entry.name === '__tests__') return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file, excludeTests) : [file];
  });
}
const runtimeHash = createHash('sha256');
for (const directory of ['packages/core/src', 'packages/portal/src', 'src/locales']) {
  for (const file of files(path.join(root, directory), true)) {
    runtimeHash.update(path.relative(root, file)); runtimeHash.update(fs.readFileSync(file));
  }
}
const targets = [];
for (const target of ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo']) {
  const directory = path.join(buildRoot, target);
  const inventoryFile = buildRoot === path.join(root, 'builds')
    ? path.join(root, 'artifacts/target-dependencies', target + '.json')
    : path.join(root, 'artifacts/target-dependencies/custom', sha(directory), target + '.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryFile));
  if (['youtube', 'netflix', 'yahoo'].includes(target)) {
    const content = JSON.parse(fs.readFileSync(path.join(directory, 'youtube-content-manifest.json')));
    if (!content.releaseReady || content.fixture || content.locales.length !== 16 || content.classicRiddleCount < 180 || content.dailyScheduleEntries < 180) {
      throw Error('Incomplete release content: ' + target);
    }
  }
  if (path.resolve(inventory.outputDirectory) !== directory) throw Error('Wrong output inventory: ' + target);
  for (const row of inventory.files) {
    if (sha(fs.readFileSync(path.join(directory, row.file))) !== row.sha256) throw Error('Stale inventory: ' + target + '/' + row.file);
  }
  const rows = files(directory).map(file => ({file: path.relative(directory, file), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file))}));
  const deliveredDirectory = snapshotRoot ? path.join(snapshotRoot, target) : directory;
  if (snapshotRoot) {
    fs.cpSync(directory, deliveredDirectory, {recursive: true});
    for (const row of rows) if (sha(fs.readFileSync(path.join(deliveredDirectory, row.file))) !== row.sha256) throw Error('Copy mismatch: ' + target + '/' + row.file);
    fs.mkdirSync(path.join(__dirname, 'inventories'), {recursive: true});
    fs.copyFileSync(inventoryFile, path.join(__dirname, 'inventories', target + '.json'));
  }
  targets.push({target, directory: deliveredDirectory, builtDirectory: directory, files: rows.length, bytes: rows.reduce((total, row) => total + row.bytes, 0),
    treeSha256: sha(JSON.stringify(rows)), inventorySha256: sha(fs.readFileSync(inventoryFile)), runtimePackages: inventory.packages});
}
const report = {verifiedAt: new Date().toISOString(), commit, dirty: true, runtimeSourceSha256: runtimeHash.digest('hex'), targets};
fs.writeFileSync(path.join(__dirname, 'final-artifacts.json'), JSON.stringify(report, null, 2) + '\n');
console.log(targets.map(({target, files, bytes}) => ({target, files, bytes})));
