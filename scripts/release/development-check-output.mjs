import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

/** Exact named selection used by Jest, including the split CLI option. */
function namedPattern(check) {
  const index = check.args.findIndex(argument => /^--testNamePattern(?:=|$)/u.test(argument));
  if (index < 0) return null;
  const pattern = check.args[index] === "--testNamePattern" ? check.args[index + 1] : check.args[index].slice("--testNamePattern=".length);
  if (!pattern) throw new Error(`Required check ${check.id} has an empty named test pattern`);
  return pattern;
}

/** Separates explicit scenario alternatives without splitting grouped or escaped regex expressions. */
function scenarioPatterns(pattern) {
  const parts = [];
  let start = 0, depth = 0, characterClass = false, escaped = false;
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (escaped) {escaped = false; continue;}
    if (character === "\\") {escaped = true; continue;}
    if (character === "[" && !characterClass) {characterClass = true; continue;}
    if (character === "]" && characterClass) {characterClass = false; continue;}
    if (characterClass) continue;
    if (character === "(") depth++;
    else if (character === ")") depth--;
    else if (character === "|" && depth === 0) {parts.push(pattern.slice(start, index)); start = index + 1;}
  }
  parts.push(pattern.slice(start));
  if (parts.some(part => !part)) throw new Error("Empty named scenario alternative cannot prove coverage");
  return parts;
}

/** Every named scenario must have a passing assertion before a development receipt can claim success. */
export function assertDevelopmentCheckOutput(check, result) {
  const pattern = namedPattern(check);
  if (pattern === null) return;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/gu, "");
  const summaries = [...output.matchAll(/^Tests:\s*(.+)$/gmu)];
  if (!summaries.some(([, summary]) => /\b[1-9][0-9]* passed\b/u.test(summary))) {
    throw new Error(`Required check ${check.id} executed no passing named tests; update the scenario binding instead of recording skipped coverage.`);
  }
  if (!Array.isArray(result.passedAssertionNames) || !result.passedAssertionNames.length) {
    throw new Error(`Required check ${check.id} is missing its named assertion report`);
  }
  const missing = scenarioPatterns(pattern).filter(part => !result.passedAssertionNames.some(name => new RegExp(part, "i").test(name)));
  if (missing.length) throw new Error(`Required check ${check.id} did not execute these named scenarios: ${missing.join(" | ")}`);
}

/** Captures structured assertion names while preserving the declared command's behavior and output. */
export async function executeDevelopmentCheck(check, execute, options) {
  const pattern = namedPattern(check);
  if (pattern === null) return execute(check.executable, check.args, options);
  const directory = await mkdtemp(path.join(tmpdir(), "development-check-report-"));
  const file = path.join(directory, "jest.json");
  let result;
  try {
    result = await execute(check.executable, [...check.args, "--json", "--outputFile", file], options);
    const raw = await readFile(file, "utf8");
    const report = JSON.parse(raw);
    result.passedAssertionNames = (report.testResults ?? []).flatMap(suite => (suite.assertionResults ?? [])
      .filter(assertion => assertion.status === "passed").map(assertion => assertion.fullName));
    result.stdout += `\nNamed assertion report:\n${raw}\nEnd named assertion report.\n`;
    assertDevelopmentCheckOutput(check, result);
    return result;
  } catch (error) {
    if (result) {error.stdout = result.stdout; error.stderr = result.stderr;}
    throw error;
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}
