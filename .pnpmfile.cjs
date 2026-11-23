/**
 * `@firebase/auth` declares React Native's AsyncStorage as an optional peer for its
 * react-native entry point. No Web Target imports that entry, and linking the peer
 * would pull the Android app's React Native graph into the web notice and audits.
 */
function readPackage(pkg) {
  if (pkg.name === "@firebase/auth") {
    delete pkg.peerDependencies?.["@react-native-async-storage/async-storage"];
    delete pkg.peerDependenciesMeta?.["@react-native-async-storage/async-storage"];
  }
  return pkg;
}

module.exports = {hooks: {readPackage}};
