import {readProtectedContent} from '@qwordly/core/contentProtection';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {playableContentModule, playableContentPlugin} from '../playableContentPlugin.ts';

test('keeps every locale in local assets while the production entry contains only metadata and loaders', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'playable-packs-'));
  try {
    const file = path.join(directory, 'content.json');
    await writeFile(file, JSON.stringify({contentVersion:'test-v1', locales:['en','fr'], packs:{en:{answer:'english'}, fr:{answer:'french'}}}));
    const plugin = playableContentPlugin(file);
    const watched = [], assets = [];
    const context = {addWatchFile:file => watched.push(file), emitFile:asset => {assets.push(asset);return `asset${assets.length}`;}};
    const entryId = plugin.resolveId(playableContentModule);
    assert.match((await plugin.load.call(context, entryId)), /english/);
    assert.equal(assets.length, 0, 'development must not emit build assets');
    plugin.configResolved({command:'build'});
    const source = await plugin.load.call(context, entryId);
    assert.match(source, /test-v1/);
    assert.doesNotMatch(source, /english|french/);
    assert.deepEqual(assets.map(asset => asset.name), ['playable-pack-en', 'playable-pack-fr']);
    assert.equal(assets[1].type, 'chunk');
    const packSource = await plugin.load.call(context, plugin.resolveId(assets[1].id));
    assert.doesNotMatch(packSource, /french|answer/);
    const envelope = JSON.parse(packSource.slice('export default '.length, -1));
    assert.deepEqual(await readProtectedContent(envelope), {answer:'french'});
    assert.equal(plugin.resolveId('another-module'), null);
    assert.ok(watched.every(item => item === file));
  } finally { await rm(directory, {recursive:true, force:true}); }
});
