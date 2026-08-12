import {afterEach, describe, expect, it, jest} from "@jest/globals";
import {mkdtemp, readFile, rm, stat, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  assertPrivateJestStorageState,
  persistPrivateJestStorageState,
} from "./deployedJestStorageState";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})));
});

describe("deployed Jest sandbox browser state", () => {
  it("creates and retains authenticated state with owner-only permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "riddle-quest-jest-state-"));
    temporaryDirectories.push(directory);
    const statePath = join(directory, "nested", "state.json");
    const context = {
      storageState: jest.fn(async ({path}: {path?: string}) => {
        await writeFile(path!, JSON.stringify({cookies: [{name: "session"}]}));
        return {cookies: [], origins: []};
      }),
    };

    await persistPrivateJestStorageState(context, statePath);

    expect(context.storageState).toHaveBeenCalledWith({path: statePath});
    expect((await stat(statePath)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(statePath, "utf8"))).toEqual({cookies: [{name: "session"}]});
    await expect(assertPrivateJestStorageState(statePath)).resolves.toBeUndefined();
  });

  it("rejects a symbolic-link destination before writing authentication data", async () => {
    const directory = await mkdtemp(join(tmpdir(), "riddle-quest-jest-state-"));
    temporaryDirectories.push(directory);
    const targetPath = join(directory, "target.json");
    const statePath = join(directory, "state.json");
    await writeFile(targetPath, "unchanged", {mode: 0o600});
    await symlink(targetPath, statePath);
    const context = {storageState: jest.fn()};

    await expect(persistPrivateJestStorageState(context, statePath)).rejects.toThrow(/regular file/);
    expect(context.storageState).not.toHaveBeenCalled();
    expect(await readFile(targetPath, "utf8")).toBe("unchanged");
  });
});
