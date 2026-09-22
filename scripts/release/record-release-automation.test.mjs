import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {packageEvidence} from './record-release-automation.mjs';
const bytes = Buffer.from('verified archive');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const manifest = {artifact: 'game.zip', sha256};
test('only matching successful browser evidence verifies current archive', () => {
  const report = {verifiedAt: '2026-09-22T12:00:00Z', results: [{artifact: 'game.zip', sha256, status: 'passed'}]};
  assert.match(packageEvidence('game.zip', bytes, manifest, report).status, /gameplay verified/);
  for (const changed of [null, {...report, results: [{...report.results[0], sha256: 'old'}]}, {...report, results: [{...report.results[0], status: 'failed'}]}]) {
    const result = packageEvidence('game.zip', bytes, manifest, changed);
    assert.match(result.status, /verification pending/);
    assert.equal(result.completedAt, null);
  }
});
test('a mismatched archive or manifest cannot claim readiness', () => {
  assert.throws(() => packageEvidence('game.zip', Buffer.from('changed'), manifest, null));
  assert.throws(() => packageEvidence('other.zip', bytes, manifest, null));
});
