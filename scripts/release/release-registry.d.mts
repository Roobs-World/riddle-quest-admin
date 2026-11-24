/** Target build declarations consumed by build tooling. */
export function getWebBuildPaths(target: string): Readonly<{
  projectDirectory: string;
  buildDirectory: string;
  outputDirectory: string;
}>;
export const webBuildFacts: Readonly<Record<string, Readonly<ReturnType<typeof getWebBuildPaths> & {
  runtimePackages: readonly string[];
}>>>;
