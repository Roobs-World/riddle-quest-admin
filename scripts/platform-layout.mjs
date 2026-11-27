/** Canonical platform application and authoritative server source roots. */
export const webApplications = Object.freeze(["facebook", "reddit", "youtube", "netflix", "yahoo", "gamesnacks"]);
export const platformServerRoots = Object.freeze([
  "platforms/native/android/server",
  ...["facebook", "reddit", "yahoo"].map(target => `platforms/web/${target}/server`),
]);
