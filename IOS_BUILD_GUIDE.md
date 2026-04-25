# iOS Build and Testing Guide for Windows

This guide explains how to build and test your Riddle Quest iOS app from Windows using EAS Build.

## Prerequisites

1. **Apple Developer Account** (Required for device testing)

   - Sign up at https://developer.apple.com ($99/year)
   - You'll need this for:
     - Creating provisioning profiles
     - Testing on real devices
     - Publishing to App Store

2. **EAS CLI** (Already installed ✓)

   - You're logged in as: craigbeswetherick

3. **Expo Account** (Already set up ✓)
   - Project ID: c587e97f-f71b-4258-a34c-98a2df4a6508

## Building for iOS

### 1. Development Build (For Testing on Devices)

This build can be installed on registered iOS devices:

```bash
eas build --profile development --platform ios
```

### 2. Simulator Build (For Testing on Mac)

If you have access to a Mac with Xcode, build for simulator:

```bash
eas build --profile simulator --platform ios
```

### 3. Preview Build (For TestFlight)

For beta testing via TestFlight:

```bash
eas build --profile preview --platform ios
```

### 4. Production Build (For App Store)

For App Store submission:

```bash
eas build --profile production --platform ios
```

## First-Time Setup

When you run your first iOS build, EAS will:

1. **Ask for Apple Developer credentials**

   - Apple ID (email)
   - App-specific password (generate at appleid.apple.com)

2. **Create necessary certificates and profiles**

   - EAS handles all certificate management
   - No need for a Mac!

3. **Register your app's bundle identifier**
   - Current: `com.roobsworld.Riddle Quest`

## Testing Your iOS App from Windows

### Option 1: Physical Device Testing (Recommended)

1. **Register your device**:

   ```bash
   eas device:create
   ```

   - Follow the QR code/link on your iPhone
   - Install the profile when prompted

2. **Build for development**:

   ```bash
   eas build --profile development --platform ios
   ```

3. **Install on device**:
   - Once build completes, you'll get a QR code
   - Scan with your iPhone's camera
   - Install the app directly

### Option 2: TestFlight Testing

1. **Build for preview**:

   ```bash
   eas build --profile preview --platform ios
   ```

2. **Submit to TestFlight**:

   ```bash
   eas submit --platform ios
   ```

3. **Test via TestFlight**:
   - Invite testers via App Store Connect
   - They install via TestFlight app

### Option 3: Remote Mac Testing

Services like:

- **MacStadium** - Rent a Mac in the cloud
- **MacinCloud** - Pay-per-hour Mac access
- **AWS EC2 Mac instances** - For larger teams

### Option 4: Expo Go (Limited Testing)

For basic testing without native modules:

```bash
npx expo start
```

- Scan QR code with Expo Go app on iOS
- Note: Limited functionality (no native modules)

## Debugging iOS Issues from Windows

### 1. Build Logs

```bash
eas build:list --platform ios
eas build:view [BUILD_ID]
```

### 2. Crash Reports

- Use Sentry or Bugsnag integration
- Check App Store Connect for crash logs

### 3. Remote Debugging

- Use Flipper for React Native debugging
- Safari DevTools (requires Mac access)

## Common iOS Build Issues

### 1. Missing GoogleService-Info.plist

If you haven't added it yet:

1. Download from Firebase Console
2. Place in project root
3. Update app.config.js:

```javascript
ios: {
  googleServicesFile: "./GoogleService-Info.plist",
  // ... other config
}
```

### 2. Facebook SDK Configuration

Already configured in your app.config.js ✓

### 3. Push Notifications

Add to app.config.js if needed:

```javascript
ios: {
  infoPlist: {
    NSUserTrackingUsageDescription: "This identifier will be used to deliver personalized ads to you.";
  }
}
```

## Build Commands Summary

```bash
# Development (physical devices)
eas build --profile development --platform ios

# Simulator (requires Mac to run)
eas build --profile simulator --platform ios

# TestFlight
eas build --profile preview --platform ios

# App Store
eas build --profile production --platform ios

# Check build status
eas build:list --platform ios

# View specific build
eas build:view [BUILD_ID]

# Submit to App Store
eas submit --platform ios
```

## Next Steps

1. **Start with development build**:

   ```bash
   eas build --profile development --platform ios
   ```

2. **Register your iPhone for testing**:

   ```bash
   eas device:create
   ```

3. **Monitor build progress**:
   - Watch the terminal
   - Or check https://expo.dev/accounts/[YOUR_ACCOUNT]/projects/Riddle Quest/builds

## Tips for Windows iOS Development

1. **Use EAS Update** for quick iterations:

   ```bash
   eas update --branch preview
   ```

2. **Test on multiple iOS versions**:

   - Use TestFlight for broader testing
   - Consider different iPhone models

3. **Automate with GitHub Actions**:

   - Set up CI/CD for automatic builds
   - Trigger builds on push to main

4. **Keep certificates safe**:
   - Let EAS manage certificates
   - Don't share credentials

## Troubleshooting

- **Build fails**: Check logs with `eas build:view`
- **Can't install on device**: Ensure device is registered
- **App crashes**: Use crash reporting service
- **Missing features**: Some features need development builds

Remember: EAS Build handles all the complex iOS certificate and provisioning profile management, making it possible to build iOS apps without a Mac!


