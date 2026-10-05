import assert from 'node:assert/strict';
import test from 'node:test';
import {assertTargetDependency, runtimePackage, targetDependencyEvidencePath} from '../webTargetDependencies.ts';
const targets = ['jest', 'facebook', 'reddit', 'youtube', 'netflix', 'yahoo', 'gamesnacks'];
test('each target rejects every other provider module, including resolved aliases and dynamic imports', () => {
  for (const target of targets) for (const owner of targets) {
    const id = `/workspace/packages/portal/src/${owner}/adapter.ts`;
    if (target === owner) assert.doesNotThrow(() => assertTargetDependency(target, id));
    else assert.throws(() => assertTargetDependency(target, id), /owned module/u);
  }
});
test('transitive SDK packages and tooling fail closed on every artifact', () => {
  for (const target of targets) {
    assert.throws(() => assertTargetDependency(target, '/node_modules/jest/build/index.js'), /undeclared runtime/u);
    assert.throws(() => assertTargetDependency(target, '/node_modules/another-provider-sdk/index.js'), /undeclared runtime/u);
    assert.throws(() => assertTargetDependency(target, '/workspace/packages/portal/src/test/harness.ts'), /test code/u);
    assert.doesNotThrow(() => assertTargetDependency(target, '/node_modules/.pnpm/react@19/node_modules/react/index.js'));
    if (!['jest','facebook'].includes(target)) assert.throws(() => assertTargetDependency(target,
      '/node_modules/.pnpm/@firebase+app@1/node_modules/@firebase/app/index.js'), /undeclared runtime/u);
  }
  assert.equal(runtimePackage('/node_modules/.pnpm/@firebase+app@1/node_modules/@firebase/app/index.js'), '@firebase/app');
});

test('real bundler rejects aliased and lazy provider imports plus SDK packages before minification', async t => {
  const {mkdtemp,mkdir,writeFile,rm,access}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const path=await import('node:path');
  const {createRequire}=await import('node:module');
  const {pathToFileURL}=await import('node:url');
  const {build}=await import(pathToFileURL(createRequire(new URL('../package.json',import.meta.url)).resolve('vite')).href);
  const {webTargetDependencyPlugin}=await import('../webTargetDependencies.ts');
  const root=await mkdtemp(path.join(tmpdir(),'target-dependency-build-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const evidence=path.join(root,'evidence');
  const entry=path.join(root,'packages/portal/src/shared/main.js');
  await mkdir(path.dirname(entry),{recursive:true});
  const sdk=path.join(root,'node_modules/jest-gaming-sdk');await mkdir(sdk,{recursive:true});
  await writeFile(path.join(sdk,'package.json'),JSON.stringify({name:'jest-gaming-sdk',main:'index.js'}));
  await writeFile(path.join(sdk,'index.js'),'export default function sdk(){return 1}');
  for(const [index,target] of targets.entries()){
    const foreign=target==='facebook'?'jest':targets[(index+1)%targets.length];
    const adapter=path.join(root,`packages/portal/src/${foreign}/adapter.js`);await mkdir(path.dirname(adapter),{recursive:true});
    await writeFile(adapter,'export const provider=()=>1');
    const config={configFile:false,root,logLevel:'silent',resolve:{alias:{'other-adapter':adapter}},
      plugins:[webTargetDependencyPlugin(target,{evidenceDirectory:evidence})],
      build:{outDir:path.join(root,'dist'),rolldownOptions:{input:entry}}};
    await writeFile(entry,"import('other-adapter').then(console.log)");
    await assert.rejects(build(config),/owned module/u);
    await assert.rejects(access(targetDependencyEvidencePath(target,path.join(root,'dist'),evidence)),{code:'ENOENT'});
    await writeFile(entry,"import sdk from 'jest-gaming-sdk';console.log(sdk())");
    await assert.rejects(build(config),/undeclared runtime package jest-gaming-sdk/u);
    await writeFile(entry,"console.log('isolated runtime')");
    const publicDirectory=path.join(root,'copied');
    await mkdir(publicDirectory,{recursive:true});
    for(const file of ['jest-provider.js','provider.js.map']){
      await writeFile(path.join(publicDirectory,file),'provider code');
      await assert.rejects(build({...config,publicDir:publicDirectory}),/untracked copied script/u);
      await assert.rejects(access(targetDependencyEvidencePath(target,path.join(root,'dist'),evidence)),{code:'ENOENT'});
      await rm(path.join(publicDirectory,file));
    }
  }
});

async function buildFixture(t) {
  const {mkdtemp, mkdir, writeFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const path = await import('node:path');
  const {createRequire} = await import('node:module');
  const {pathToFileURL} = await import('node:url');
  const {build} = await import(pathToFileURL(createRequire(new URL('../package.json', import.meta.url)).resolve('vite')).href);
  const root = await mkdtemp(path.join(tmpdir(), 'target-evidence-lifecycle-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const entry = path.join(root, 'main.js');
  await writeFile(entry, "console.log('isolated artifact')");
  const evidence = path.join(root, 'evidence');
  await mkdir(evidence, {recursive: true});
  const {webTargetDependencyPlugin} = await import('../webTargetDependencies.ts');
  const config = output => ({configFile: false, root, publicDir: false, logLevel: 'silent',
    plugins: [webTargetDependencyPlugin('facebook', {evidenceDirectory: evidence})],
    build: {outDir: output, rolldownOptions: {input: entry}}});
  return {root, evidence, build, config, path};
}

test('concurrent custom outputs retain separate complete inventories and preserve canonical release evidence', async t => {
  const {readFile, writeFile} = await import('node:fs/promises');
  const {root, evidence, build, config, path} = await buildFixture(t);
  const canonical = path.join(evidence, 'facebook.json');
  await writeFile(canonical, 'existing canonical inventory');
  const outputs = [path.join(root, 'first-output'), path.join(root, 'second-output')];
  await Promise.all(outputs.map(output => build(config(output))));
  const inventories = await Promise.all(outputs.map(async output => {
    const file = targetDependencyEvidencePath('facebook', output, evidence);
    const inventory = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(inventory.outputDirectory, output);
    assert.ok(inventory.files.length > 0);
    for (const row of inventory.files) {
      const {createHash} = await import('node:crypto');
      assert.equal(row.sha256, createHash('sha256').update(await readFile(path.join(output, row.file))).digest('hex'));
    }
    return file;
  }));
  assert.notEqual(inventories[0], inventories[1]);
  assert.equal(await readFile(canonical, 'utf8'), 'existing canonical inventory');
  assert.throws(() => targetDependencyEvidencePath('unknown', outputs[0], evidence), /Unknown dependency target/u);
});

test('later generation/write failures and generate-only builds cannot leave successful evidence', async t => {
  const {access} = await import('node:fs/promises');
  const {root, evidence, build, config, path} = await buildFixture(t);
  const output = path.join(root, 'output');
  const inventory = targetDependencyEvidencePath('facebook', output, evidence);
  const reused = config(output);
  for (const stage of ['generateBundle', 'writeBundle', 'closeBundle']) {
    await build(reused);
    await access(inventory);
    const failure = {name: 'late-build-failure', enforce: 'post', [stage]() {throw new Error(`failed during ${stage}`);}};
    await assert.rejects(build({...reused, plugins: [...reused.plugins, failure]}), /failed during/u);
    await assert.rejects(access(inventory), {code: 'ENOENT'});
  }
  await build(reused);
  await access(inventory);
  await build({...reused, build: {...reused.build, write: false}});
  await assert.rejects(access(inventory), {code: 'ENOENT'});
});

test('published inventory reflects final chunk bytes after private map cleanup', async t => {
  const {readFile, writeFile, rm} = await import('node:fs/promises');
  const {createHash} = await import('node:crypto');
  const {root, evidence, build, config, path} = await buildFixture(t);
  const output = path.join(root, 'postprocessed-output');
  const privateMap = path.join(output, 'private.js.map');
  const cleanup = {name: 'private-map-postprocessing',
    async writeBundle(_options, bundle) {
      const chunk = Object.values(bundle).find(item => item.type === 'chunk');
      assert.ok(chunk);
      await writeFile(path.join(output, chunk.fileName), `${chunk.code}\nconsole.log('postprocessed');\n`);
      await writeFile(privateMap, 'private build source');
    },
    async closeBundle() {await rm(privateMap);},
  };
  const selected = config(output);
  await build({...selected, plugins: [...selected.plugins, cleanup]});
  const inventory = JSON.parse(await readFile(targetDependencyEvidencePath('facebook', output, evidence), 'utf8'));
  assert.equal(inventory.files.some(row => row.file.endsWith('.map')), false);
  for (const chunk of inventory.chunks) {
    const bytes = await readFile(path.join(output, chunk.file));
    assert.match(bytes.toString(), /postprocessed/u);
    assert.equal(chunk.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(inventory.files.find(row => row.file === chunk.file).sha256, chunk.sha256);
  }
});

 test('release evidence root is shared by builds and verification without changing canonical source inventories', async t => {
  const path = await import('node:path');
  const {fileURLToPath} = await import('node:url');
  const repository = fileURLToPath(new URL('../../..', import.meta.url));
  const output = path.join(repository, 'builds/facebook');
  const original = process.env.RIDDLE_QUEST_TARGET_DEPENDENCY_EVIDENCE_DIR;
  t.after(() => {
    if (original === undefined) delete process.env.RIDDLE_QUEST_TARGET_DEPENDENCY_EVIDENCE_DIR;
    else process.env.RIDDLE_QUEST_TARGET_DEPENDENCY_EVIDENCE_DIR = original;
  });
  delete process.env.RIDDLE_QUEST_TARGET_DEPENDENCY_EVIDENCE_DIR;
  const canonical = targetDependencyEvidencePath('facebook', output);
  const isolated = path.join(repository, 'temporary-release-evidence');
  process.env.RIDDLE_QUEST_TARGET_DEPENDENCY_EVIDENCE_DIR = isolated;
  assert.equal(targetDependencyEvidencePath('facebook', output), path.join(isolated, 'facebook.json'));
  assert.notEqual(targetDependencyEvidencePath('facebook', output), canonical);
  assert.equal(targetDependencyEvidencePath('facebook', output, path.join(repository, 'explicit')), path.join(repository, 'explicit/facebook.json'));
  assert.notEqual(targetDependencyEvidencePath('facebook', output), targetDependencyEvidencePath('facebook', path.join(repository, 'custom-output')));
  process.env.RIDDLE_QUEST_TARGET_DEPENDENCY_EVIDENCE_DIR = 'relative-path';
  assert.throws(() => targetDependencyEvidencePath('facebook', output), /must be absolute/u);
});

 test('frozen license inventory preserves exact notices and fails closed without requerying the package store', async t => {
  const {execFileSync} = await import('node:child_process');
  const {mkdtemp,writeFile,rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const path = await import('node:path');
  const {fileURLToPath} = await import('node:url');
  const {createNotice} = await import('./generate-third-party-licenses.mjs');
  const repository = fileURLToPath(new URL('../../..', import.meta.url));
  const directory = await mkdtemp(path.join(tmpdir(), 'frozen-license-test-'));
  t.after(() => rm(directory,{recursive:true,force:true}));
  const original = process.env.RIDDLE_QUEST_LICENSE_INVENTORY_PATH;
  const originalPath = process.env.PATH;
  t.after(() => {
    process.env.PATH = originalPath;
    if(original === undefined) delete process.env.RIDDLE_QUEST_LICENSE_INVENTORY_PATH;
    else process.env.RIDDLE_QUEST_LICENSE_INVENTORY_PATH = original;
  });
  delete process.env.RIDDLE_QUEST_LICENSE_INVENTORY_PATH;
  const expected = createNotice(new Set(['react']));
  const inventory = execFileSync('pnpm',['--filter','@qwordly/portal','licenses','list','--json'],{cwd:repository,encoding:'utf8',maxBuffer:32*1024*1024});
  const file = path.join(directory,'inventory.json');
  await writeFile(file,inventory,{mode:0o400});
  process.env.RIDDLE_QUEST_LICENSE_INVENTORY_PATH = file;
  process.env.PATH = directory;
  assert.equal(createNotice(new Set(['react'])),expected);
  assert.throws(() => createNotice(new Set(['missing-runtime-package'])),/Emitted package has no notice/u);
  process.env.RIDDLE_QUEST_LICENSE_INVENTORY_PATH = path.join(directory,'missing.json');
  assert.throws(() => createNotice(new Set(['react'])),/ENOENT/u);
  process.env.RIDDLE_QUEST_LICENSE_INVENTORY_PATH = 'relative.json';
  assert.throws(() => createNotice(new Set(['react'])),/must be absolute/u);
});
