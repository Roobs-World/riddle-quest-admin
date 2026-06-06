import fs from "fs";
import path from "path";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "App.tsx"), "utf8");

describe("App QA gate coverage", () => {
  it("keeps the QA surface gate outside the startup and language branches", () => {
    expect(appSource).toContain("<QASurfaceGate>");
    expect(appSource).toContain("startupError ? (");
    expect(appSource).toContain("isInitialized ? (");
    expect(appSource).toContain("<AppShell />");
    expect(appSource).toContain("<PulsingSpinner visible={true} size={120} opacity={0.8} />");
    expect(appSource).not.toMatch(/<AppShell>\s*<QASurfaceGate>/);
  });
});
