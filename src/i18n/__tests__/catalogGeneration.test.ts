import fs from "fs";
import path from "path";
import {execFileSync} from "child_process";

import {SUPPORTED_LOCALES, localeCatalogs} from "../generated/catalogs";
import {translationSchema} from "../generated/types";

const localesDir = path.resolve(__dirname, "../../locales");
const repoRoot = path.resolve(__dirname, "../../../");

describe("catalog generation", () => {
  it("re-runs the generation script successfully", () => {
    execFileSync("node", ["scripts/generate-i18n.js"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
  });

  it("fails fast if legacy translation artifacts are reintroduced", () => {
    execFileSync("node", ["scripts/check-legacy-i18n-usage.js"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
  });

  it("runs the locale quality audit and respects the non-translatable allowlist", () => {
    execFileSync("node", ["scripts/check-i18n-quality.js"], {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const result = execFileSync("node", ["scripts/check-i18n-quality.js", "--json"], {
      cwd: repoRoot,
      stdio: "pipe",
      encoding: "utf8",
    });
    const payload = JSON.parse(result) as {
      totalIssues: number;
      allowlist: string[];
      issues: Record<string, string[]>;
    };

    expect(payload.totalIssues).toBe(0);
    expect(payload.allowlist).toContain("auth.AuthStrings.Landing.MADE_BY_ROOBS_WORLD");
    expect(payload.issues.es ?? []).not.toContain("auth.AuthStrings.Landing.MADE_BY_ROOBS_WORLD");
  });

  it("writes namespace JSON files for every locale", () => {
    const englishNamespaces = Object.keys(localeCatalogs.en).sort();

    for (const locale of SUPPORTED_LOCALES) {
      const localeDir = path.join(localesDir, locale);
      const files = fs
        .readdirSync(localeDir)
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => entry.replace(/\.json$/u, ""))
        .sort();

      expect(files).toEqual(englishNamespaces);
    }
  });

  it("keeps generated English schema in sync with the catalog root", () => {
    const stitchedEnglish = Object.values(localeCatalogs.en as Record<string, Record<string, unknown>>).reduce<
      Record<string, unknown>
    >((acc, namespaceValue) => {
      return {...acc, ...namespaceValue};
    }, {});

    expect(translationSchema).toEqual(stitchedEnglish);
  });
});
