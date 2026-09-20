const fixtureRoot = new URL("./fixtures/data-plugin/templates/data-app/base/", import.meta.url);
const starterFiles = new Set([
  "data.json", "theme.css", "content/dashboard/DashboardContent.jsx",
  "content/dashboard/dashboard.css", "content/report/ReportContent.jsx", "content/report/report.css",
]);

// Starter composition contracts require their original synthetic evidence and layout.
// Every other reference still points at this application's real protected runtime.
export function templateTestUrl(path, base) {
  if (path.startsWith("../src/") && starterFiles.has(path.slice("../src/".length))) {
    return new URL(path.slice(3), fixtureRoot);
  }
  return new URL(path, base);
}
