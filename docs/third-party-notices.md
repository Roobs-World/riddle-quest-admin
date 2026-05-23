# Third-Party Notices

Last updated: 2026-05-23

This project uses third-party open-source packages listed in `package.json` and `firebase-functions/package.json`. Generate the final production notice file from the locked dependency graph before release and publish it at the in-app Licenses URL.

Core third-party services and SDKs used by the app include:

- Expo and React Native for the mobile runtime and build tooling.
- Firebase Authentication, Firestore, Cloud Functions, Storage, Analytics, Crashlytics, Messaging, and App Check.
- Sentry for error monitoring.
- OpenAI API for server-side riddle generation.
- Google Sign-In, Facebook SDK, Google Mobile Ads, and React Native IAP.
- Three.js and React Three Fiber for 3D rendering.

Release checklist:

1. Run a license report against the production dependency graph.
2. Review copyleft, notice, attribution, and trademark obligations.
3. Publish the generated notices at `https://www.roobsworld.com/licenses`.
4. Confirm the in-app Settings link opens the published notices.
