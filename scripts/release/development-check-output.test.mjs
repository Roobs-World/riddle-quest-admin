import test from "node:test";
import assert from "node:assert/strict";
import {assertDevelopmentCheckOutput, executeDevelopmentCheck} from "./development-check-output.mjs";
const check = {id: "required-browser", executable: "pnpm", args: ["test", "--testNamePattern=retained recovery"]};
test("rejects all-skipped named scenarios despite a successful process exit", () => {
  assert.throws(() => assertDevelopmentCheckOutput(check, {stdout: "", stderr: "Test Suites: 1 skipped, 0 of 1 total\nTests:       46 skipped, 46 total\n"}), /no passing named tests/u);
});
test("requires a named test summary even when unrelated build output says passed", () => {
  assert.throws(() => assertDevelopmentCheckOutput(check, {stdout: "Build passed; 10 passed", stderr: ""}), /no passing named tests/u);
});
test("accepts real named assertions with optional skipped tests and ANSI color", () => {
  assert.doesNotThrow(() => assertDevelopmentCheckOutput(check, {stdout: "", stderr: "Tests:       44 skipped, \x1b[32m2 passed\x1b[0m, 46 total\n", passedAssertionNames: ["Retained recovery restores the owned run"]}));
});
test("supports the split Jest pattern option and preserves non-pattern commands", () => {
  assert.throws(() => assertDevelopmentCheckOutput({...check, args: ["test", "--testNamePattern", "missing"]}, {}), /no passing named tests/u);
  assert.doesNotThrow(() => assertDevelopmentCheckOutput({id: "build", args: ["build:all-targets"]}, {}));
});

test("rejects a surviving assertion when another named scenario disappeared", () => {
  assert.throws(() => assertDevelopmentCheckOutput({...check, args: ["test", "--testNamePattern=guest identity|waiting invitation"]}, {
    stdout: "", stderr: "Tests: 1 passed, 1 total", passedAssertionNames: ["guest identity uses the signed provider"]}), /waiting invitation/u);
});
test("accepts every explicit alternative without splitting regex groups or escaped pipes", () => {
  assert.doesNotThrow(() => assertDevelopmentCheckOutput({...check, args: ["test", "--testNamePattern=(?:guest|registered) identity|literal\\|pipe|[|] character"]}, {
    stdout: "", stderr: "Tests: 3 passed, 3 total", passedAssertionNames: ["registered identity", "literal|pipe", "| character"]}));
});
test("summary-only receipts cannot prove named assertion coverage", () => {
  assert.throws(() => assertDevelopmentCheckOutput(check, {stderr: "Tests: 1 passed, 1 total"}), /missing its named assertion report/u);
});
test("captures structured passed assertions and removes its temporary report", async () => {
  const {writeFile, access} = await import("node:fs/promises");
  let outputFile;
  const result = await executeDevelopmentCheck(check, async (executable, args) => {
    assert.equal(executable, "pnpm");
    outputFile = args.at(-1);
    await writeFile(outputFile, JSON.stringify({testResults: [{assertionResults: [
      {status: "passed", fullName: "retained recovery"}, {status: "pending", fullName: "another scenario"}]}]}));
    return {stdout: "", stderr: "Tests: 1 passed, 1 skipped, 2 total"};
  }, {});
  assert.deepEqual(result.passedAssertionNames, ["retained recovery"]);
  assert.match(result.stdout, /Named assertion report/u);
  await assert.rejects(access(outputFile), {code: "ENOENT"});
});
