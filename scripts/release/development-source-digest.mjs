import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat, readFile, readlink} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';

const execute = promisify(execFile);

export const developmentSourcePathspecs = Object.freeze([
  '.',
  ':(exclude).codex/**',
  ':(exclude)artifacts/**',
]);

/** Hash repository source files and link identities without reading external link targets. */
export async function developmentSourceDigest(repository) {
  const {stdout} = await execute('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...developmentSourcePathspecs],
  {cwd: repository, maxBuffer: 32 * 1024 * 1024});
  const files = stdout.split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file).update('\0');
    const filename = path.join(repository, file);
    try {
      const stats = await lstat(filename);
      hash.update(stats.isSymbolicLink() ? `symlink:${await readlink(filename)}` : await readFile(filename));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('deleted');
    }
  }
  return hash.digest('hex');
}
