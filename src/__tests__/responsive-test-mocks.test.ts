import fs from "fs";
import path from "path";

const root = process.cwd();
const testFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return testFiles(fullPath);
    return /\.(test|spec)\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
};

describe("responsive test mocks", () => {
  it("keeps mocked responsive modules aligned with the production dimensions shape", () => {
    const offenders = testFiles(path.join(root, "src"))
      .map((filePath) => ({
        filePath,
        relativePath: path.relative(root, filePath).replace(/\\/g, "/"),
        source: fs.readFileSync(filePath, "utf8"),
      }))
      .filter(({ source }) => source.includes("utils/responsive"))
      .filter(({ source }) => /jest\.mock\(["'](?:src\/)?(?:\.\.\/)*utils\/responsive/.test(source))
      .filter(({ source }) => !/dimensions:\s*\{[\s\S]*?isPhone[\s\S]*?isTablet[\s\S]*?isLargeTablet[\s\S]*?isDesktop/.test(source));

    expect(offenders.map(({ relativePath }) => relativePath)).toEqual([]);
  });
});
