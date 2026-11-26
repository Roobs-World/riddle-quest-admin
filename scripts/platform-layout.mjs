/** Canonical platform application and authoritative server source roots. */
export const webApplications = Object.freeze(["jest"]);
export const platformServerRoots = Object.freeze([
  "platforms/native/android/server",
  ...["jest", "facebook", "reddit", "yahoo"].map(target => `platforms/web/${target}/server`),
]);
