import type {BrowserContext} from "@playwright/test";
import {chmod, lstat, mkdir, open} from "node:fs/promises";
import {dirname} from "node:path";

const privateFileMode = 0o600;

const assertRegularOwnerFile = async (statePath: string): Promise<void> => {
  const metadata = await lstat(statePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Jest sandbox browser state must be a regular file: ${statePath}`);
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new Error(`Jest sandbox browser state must be owned by the current user: ${statePath}`);
  }
};

/** Rejects reusable authenticated browser state unless it is an owner-only file. */
export const assertPrivateJestStorageState = async (statePath: string): Promise<void> => {
  await assertRegularOwnerFile(statePath);
  const metadata = await lstat(statePath);
  if ((metadata.mode & 0o777) !== privateFileMode) {
    throw new Error(`Jest sandbox browser state must have mode 0600: ${statePath}`);
  }
};

/** Writes Playwright storage state without ever exposing authenticated bytes via a permissive mode. */
export const persistPrivateJestStorageState = async (
  context: Pick<BrowserContext, "storageState">,
  statePath: string,
): Promise<void> => {
  await mkdir(dirname(statePath), {mode: 0o700, recursive: true});
  try {
    await assertRegularOwnerFile(statePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const handle = await open(statePath, "wx", privateFileMode);
    await handle.close();
  }
  await chmod(statePath, privateFileMode);
  await context.storageState({path: statePath});
  await chmod(statePath, privateFileMode);
  await assertPrivateJestStorageState(statePath);
};
