import assert from 'node:assert/strict';
import {test} from 'node:test';
import {protectContent, readProtectedContent, contentProtectionRequest} from '@qwordly/core/contentProtection';

test('protects Unicode answers, complete decks, and hints with a fresh IV without altering gameplay data', async () => {
  const content = {preloadedRiddles:[{evaluation:{answer:'café',locale:'fr'},hint:{index:3,letter:'é'}}], answer:'時計', hints:['क','👩‍👩‍👧‍👦']};
  const first = await protectContent(content), second = await protectContent(content);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.data, second.data);
  assert.doesNotMatch(JSON.stringify(first), /café|時計|evaluation|preloadedRiddles|hints/);
  assert.deepEqual(await readProtectedContent(first), content);
  assert.deepEqual(await readProtectedContent(second), content);
  assert.equal(await readProtectedContent(content), content);
});

test('rejects ciphertext edits, mismatched IVs, malformed encodings, and unsupported envelopes', async () => {
  const envelope = await protectContent({answer:'secret'});
  await assert.rejects(readProtectedContent({...envelope, data:(envelope.data[0] === 'a' ? 'b' : 'a') + envelope.data.slice(1)}));
  await assert.rejects(readProtectedContent({...envelope, iv:'00'.repeat(12)}));
  for (const bad of [{...envelope, data:'zz'}, {...envelope, iv:'00'}, {...envelope, contentProtection:2}, {...envelope, answer:'plain'}])
    await assert.rejects(readProtectedContent(bad));
});

test('transport negotiation preserves strict domain payloads and legacy callers', () => {
  assert.deepEqual(contentProtectionRequest({riddleId:'r1',contentProtection:1}), {data:{riddleId:'r1'},protected:true});
  assert.deepEqual(contentProtectionRequest(undefined), {data:undefined,protected:false});
  assert.deepEqual(contentProtectionRequest({riddleId:'r1'}), {data:{riddleId:'r1'},protected:false});
  assert.throws(() => contentProtectionRequest({contentProtection:2}));
});
