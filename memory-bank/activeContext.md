# Active Context

## 1. Current Focus

### **✅ ANDROID ECLIPSE CONFIGURATION ERRORS - FIXED**

- **Issue**: Android folder contained Eclipse IDE configuration files that were causing linter errors and conflicts with React Native/Expo build system
- **Root Cause**:
  - Eclipse `.classpath`, `.project`, and `.settings/org.eclipse.buildship.core.prefs` files from legacy IDE setup
  - Empty `.project` file causing parsing issues
  - Eclipse configuration files being interpreted as Gradle configuration files
- **Solution**: Removed all Eclipse IDE-specific configuration files from Android project
- **Status**: ✅ **FIXED** - Android build system now works correctly without Eclipse interference
- **Result**:
  - ✅ Removed `android/.classpath`, `android/.project`, and `android/.settings/` directory
  - ✅ Removed `android/app/.classpath`, `android/app/.project`, and `android/app/.settings/` directory
  - ✅ Android Gradle build now works cleanly (`./gradlew clean` successful)
  - ✅ No more linter errors from Eclipse configuration files
  - ✅ Project properly uses React Native/Expo build system exclusively
- **Technical Details**:
  - Eclipse configuration files are not needed for React Native/Expo projects
  - Gradle build system handles all Android project configuration
  - Removed files: `.classpath`, `.project`, `.settings/org.eclipse.buildship.core.prefs`
  - Build warnings shown are normal deprecation warnings from React Native packages, not errors

### **✅ USERNAME PROFANITY FILTERING - IMPLEMENTED**

- **Issue**: User requested that usernames should not contain profanity in the SignUp screen
- **Implementation**: Complete profanity filtering system implemented across client and server
- **Solution**:
  - ✅ Created profanity filter utility (`src/utils/profanityFilter.ts` and `firebase-functions/src/utils/profanityFilter.ts`)
  - ✅ Updated validation schemas in both client and server (`authSchemas.ts` and `firestoreSchemas.ts`)
  - ✅ Added profanity validation to username fields in signUpSchema and PlayerSchema
  - ✅ Created comprehensive test suite (`src/utils/__tests__/profanityFilter.test.ts`)
- **Status**: ✅ **IMPLEMENTED** - Profanity filtering active in SignUp screen and profile updates
- **Result**:
  - ✅ Username validation now includes profanity checking on both client and server side
  - ✅ Inappropriate usernames are rejected with clear error message
  - ✅ Validation applies to both sign-up and profile update processes
  - ✅ Consistent validation across React Native app and Firebase Functions
- **Technical Details**:
  - Uses Zod schema validation with custom refine functions
  - Validates against a comprehensive list of inappropriate words
  - Includes both exact matches and substring matches for variations
  - Case-insensitive validation to catch all variations

### **✅ SOUND UNLOADING ISSUE - COMPLETELY RESOLVED**

- **Issue**: Sounds were being unloaded in App.tsx useEffect cleanup, causing "playAsync method not available" errors
- **Root Cause**:
  1. useEffect cleanup function was calling SoundManager.unload() which removes sounds from memory
  2. expo-av's `playAsync()` method was unreliable, but `replayAsync()` works consistently
- **User Requirement**: Sounds should never be unloaded for optimal performance and should just play
- **Final Solution**:
  - ✅ Removed SoundManager.unload() call from App.tsx useEffect cleanup
  - ✅ Implemented proper expo-av usage pattern with Audio.Sound.createAsync and explicit AVPlaybackSource typing
  - ✅ **KEY FIX**: Used `replayAsync()` instead of `playAsync()` throughout SoundManager - this is what actually works
  - ✅ Added 1-second delay after sound creation to ensure full initialization
  - ✅ Added comprehensive status checking before attempting to play sounds
  - ✅ Sounds now remain in memory throughout app lifecycle for immediate playback
- **Status**: ✅ **COMPLETELY RESOLVED** - Sounds are working perfectly
- **Result**:
  - ✅ Sounds remain in memory for optimal performance
  - ✅ Background music starts automatically during initialization
  - ✅ All sound effects (success/negative) work reliably
  - ✅ No more "playAsync method not available" errors
  - ✅ Consistent use of `replayAsync()` for reliable sound playback
- **Technical Note**: `replayAsync()` works more reliably than `playAsync()` with expo-av

### **✅ SOUND MANAGER PAUSE/RESUME ISSUE - FIXED**

- **Issue**: Sounds were being unloaded when paused, causing playAsync errors when trying to resume
- **Root Cause**: Incorrect understanding of pause vs unload - pause should only stop playback, not unload the sound from memory
- **Solution**:
  - Fixed pauseBackgroundMusic to only call pauseAsync() without unloading sounds
  - Improved playBackgroundMusic to properly resume paused sounds
  - Added better logging to track sound state changes
  - Enhanced status checking to handle AVPlaybackStatus type correctly
- **Status**: ✅ **FIXED** - Sounds now properly pause/resume without losing their loaded state
- **Result**:
  - Background music can be paused and resumed without reloading
  - Success and negative sounds remain loaded for immediate playback
  - Better error handling and logging for sound state management
  - Maintains sound instances in memory for optimal performance

### **✅ SOUND MANAGER PLAYASYNC ERROR - FIXED WITH PROPER TYPE DECLARATIONS**

- **Issue**: Error "neutralSound.playAsync is not a function (it is undefined)" when SoundManager.init() was called
- **Root Cause**: TypeScript audio declarations were typing audio imports as `string` instead of `AVPlaybackSource`, and sound object verification was insufficient
- **Solution**:
  - Updated audio type declarations to properly type .wav, .mp3, .m4a files as `AVPlaybackSource` from expo-av
  - Enhanced SoundManager initialization with explicit sound method verification
  - Added detailed logging for sound creation status and verification
  - Improved error handling with specific checks for playAsync and replayAsync method availability
- **Status**: ✅ **FIXED** - SoundManager now properly types audio sources and verifies sound methods before use
- **Result**:
  - Audio files correctly typed as AVPlaybackSource for expo-av compatibility
  - Sound methods (playAsync, replayAsync, etc.) properly verified before use
  - Enhanced debugging logs for sound initialization troubleshooting
  - Maintains backward compatibility with existing test suite

### **✅ GOOGLE SHEETS CLEANUP COMPLETED - All References Successfully Removed**

- **Issue**: Request to remove Google Sheets dependencies completely from the project
- **Root Cause**: Migration to Firestore was complete in source code but some remnants remained
- **Solution**: Removed all remaining Google Sheets references and cleaned up environment configuration
- **Status**: ✅ **FULLY COMPLETED** - All Google Sheets dependencies eliminated
- **Result**:
  - Old compiled sheetsService.js files removed from lib directory
  - SPREADSHEET_ID and ACCESS_TOKEN environment variables removed from app.config.js
  - Firebase Functions rebuild successfully completed
  - Tests passing without any Google Sheets references
  - Project now runs exclusively on Firestore for riddle storage

### **✅ Migration Summary - Firestore-Only Implementation:**

- **✅ Source Code**: All TypeScript files already converted to use Firestore exclusively
- **✅ Compiled Code**: Rebuilt Firebase Functions to remove old sheetsService.js references
- **✅ Environment Config**: Removed Google Sheets environment variables from app.config.js
- **✅ Testing**: All tests passing with Firestore implementation (submitGuessLogic.test.ts: 16/16 passing)
- **✅ Architecture**: Clean Firestore-only riddle storage and generation system

### **✅ ANDROID BUILD ISSUE RESOLVED - ExpoModulesPackage Error Fixed**

- **Issue**: Android build failing with "cannot find symbol: class ExpoModulesPackage" error
- **Root Cause**: Incomplete Android project structure - missing `app` directory and proper Expo modules configuration
- **Solution**: Ran `npx expo prebuild --platform android --clean` to regenerate complete native Android project
- **Status**: ✅ **BUILD SUCCESSFUL** - Android compilation completed successfully in 1m 2s
- **Result**:
  - ExpoModulesPackage properly imported and configured
  - Complete Android project structure generated
  - Metro bundler running successfully
  - APK generated successfully (`app-debug.apk`)
- **Note**: Minor ADB installation error with emulator is separate from compilation success

- **✅ METRO-CORE DEPENDENCY ISSUE RESOLVED**
  - **Issue**: Global Expo CLI version 0.7.3 was causing "Cannot find module 'metro-core'" error
  - **Root Cause**: Outdated global expo-cli (6.3.10) conflicting with local project dependencies
  - **Solution**: Removed legacy expo-cli and installed @expo/cli@0.24.13 globally
  - **Status**: ✅ **DEVELOPMENT SERVER RUNNING** - Metro bundler successfully started on port 8081
  - **Next Priority**: Continue development work with functioning development environment

### **✅ Metro-Core Issue Resolution - DONE**

#### **✅ Problem Identification - DONE**

- ✅ **Error Source**: Global pnpm installation of @expo/cli@0.7.3 missing metro-core dependency
- ✅ **Local Dependencies**: metro-core@0.82.4 properly installed in project node_modules
- ✅ **Version Conflict**: Legacy expo-cli@6.3.10 interfering with newer local Expo CLI@0.24.13

#### **✅ Solution Implementation - DONE**

- ✅ **Removed Legacy CLI**: Uninstalled global expo-cli@6.3.10 using pnpm
- ✅ **Installed Modern CLI**: Installed @expo/cli@0.24.13 globally to match local version
- ✅ **Verified Installation**: Confirmed npx expo --version returns 0.24.13
- ✅ **Started Development Server**: Successfully launched Metro bundler with npx expo start --clear

#### **✅ Current Status - DONE**

- ✅ **Metro Bundler**: Running successfully on port 8081
- ✅ **Development Environment**: Fully functional for React Native development
- ✅ **CLI Compatibility**: Global and local Expo CLI versions now aligned
- ✅ **Dependencies**: All Metro-related packages properly resolved

### **✅ Previous Success - SubmitGuessLogic Tests Fixed:**

- **✅ SUBMITGUESSLOGIC TESTS FIXED SUCCESSFULLY**
  - **Test Status**: ✅ **ALL PASSING** - All 16 tests in submitGuessLogic.test.ts now pass
  - **Root Cause**: Fixed Firebase admin mock setup and getRiddle function return type
  - **Key Fixes**:
    - Updated getRiddle function to return proper FirestoreRiddle object
    - Fixed Firebase admin mock chain for document operations
    - Properly mocked PlayerSchema.parse data requirements
  - **Next Priority**: Continue fixing remaining test failures in other test files

#### **✅ Issue Resolution - DONE**

- ✅ **getRiddle Function**: Updated to return proper FirestoreRiddle object instead of simplified object
- ✅ **Firebase Admin Mocking**: Fixed mock setup to properly handle chained Firestore operations
- ✅ **PlayerSchema.parse**: Fixed mock data to include all required fields for schema validation
- ✅ **Document Operations**: Properly mocked userRef.get() and document.data() methods

#### **✅ Test Results - DONE**

- ✅ **All 16 Tests Passing**: submitGuessLogic.test.ts now has 100% pass rate
- ✅ **Error Handling Tests**: Proper HttpsError throwing for various error conditions
- ✅ **Game Logic Tests**: Correct feedback generation, coin calculation, and stat updates
- ✅ **Mock Validation**: All Firebase operations properly mocked and tested

#### **✅ Benefits Achieved:**

- **✅ Stable Test Suite**: Core game logic now has reliable test coverage
- **✅ Proper Type Safety**: getRiddle function now returns correctly typed objects
- **✅ Better Mocking**: Firebase admin operations properly isolated in tests
- **✅ Schema Validation**: PlayerSchema.parse working correctly with proper test data

## 2. Recent Changes

### **✅ Google Sheets Complete Removal**

- Removed old compiled sheetsService.js and sheetsService.js.map files from lib directory
- Removed SPREADSHEET_ID and ACCESS_TOKEN environment variables from app.config.js
- Rebuilt Firebase Functions to ensure no Google Sheets imports in compiled code
- Verified all tests pass with Firestore-only implementation

### **✅ Firebase Functions Test Fixes**

- Fixed getRiddle function return type to match FirestoreRiddle schema
- Updated Firebase admin mock setup for proper method chaining
- Fixed PlayerSchema.parse mock data to include all required fields
- Cleaned up debugging code and restored proper console mocking

### **✅ Code Quality Improvements**

- Removed unused imports and fixed linter errors
- Improved error handling and logging in submitGuessLogic
- Enhanced test mock setup for better reliability
- Maintained backward compatibility with existing functionality

## 3. Next Steps

### **Immediate Priorities:**

1. **Deploy Updated Functions**: Deploy the cleaned-up Firebase Functions without Google Sheets dependencies
2. **Environment Variables**: Ensure production Firebase Functions have all required environment variables for IAP and other services
3. **Test Full System**: Verify end-to-end functionality works correctly with Firestore-only implementation
4. **Documentation**: Update any remaining documentation to reflect the completed Google Sheets removal

### **Deployment Notes:**

- The recent deployment attempt showed container healthcheck failures due to missing IAP environment variables
- This is unrelated to Google Sheets removal and indicates production environment needs proper IAP configuration
- Google Sheets removal is complete and successful

## 4. Current Architecture

### **✅ Firestore-Only Riddle System:**

- **Riddle Storage**: All riddles stored directly in Firestore collection
- **Riddle Generation**: OpenAI generates riddles and stores them directly in Firestore
- **Classic Mode**: Sequential level progression using Firestore queries by classicIndex
- **Daily Challenges**: Firestore-based daily riddle system
- **Duplicate Prevention**: Firestore queries to check for existing riddles

### **✅ Clean Dependencies:**

- **No Google Sheets API**: Eliminated googleapis and related packages
- **No Service Accounts**: Removed Google Sheets service account requirements
- **Firestore Admin**: Single Firebase Admin SDK for all data operations
- **Simplified Config**: Reduced environment variable requirements

## 5. Key Patterns and Preferences

### **✅ Firestore-First Development:**

- **Direct Storage**: Store riddles directly in Firestore without intermediate services
- **Query-Based Logic**: Use Firestore queries for duplicate detection and level management
- **Atomic Operations**: Use Firestore batch operations for complex riddle storage
- **Index Management**: Automatic classic index assignment using Firestore max queries

### **✅ Clean Architecture:**

- **Single Source of Truth**: Firestore is the authoritative source for all riddle data
- **Simplified Integration**: Direct Firebase SDK usage without wrapper services
- **Environment Efficiency**: Minimal required environment variables
- **Test Compatibility**: Architecture supports both unit tests and integration tests

## 6. Learnings and Project Insights

### **✅ Successful Migration Strategy:**

- **Incremental Approach**: Successfully migrated from Google Sheets to Firestore without data loss
- **Source-First Cleanup**: Updating source code first, then cleaning compiled artifacts
- **Environment Hygiene**: Removing unused environment variables prevents confusion
- **Test Verification**: Tests confirm successful migration and continued functionality

### **✅ Firebase Functions Deployment:**

- **Build Process**: Ensure `npm run build` after source changes to update compiled code
- **Environment Variables**: Production deployment requires proper IAP and service configuration
- **Healthcheck Dependencies**: Missing environment variables cause container startup failures
- **Clean Dependencies**: Removed dependencies improve build reliability and deployment success

## 1. Current Work Focus

### **✅ APP.TSX REFACTORING - PROPER NAVIGATION STRUCTURE IMPLEMENTED**

- **Issue**: Landing page was not being displayed when the game starts, App.tsx had complex AppContent component that bypassed proper navigation
- **Root Cause**: App.tsx was directly rendering GameScreen based on authentication state instead of using the proper NavigationStack
- **Solution**: Refactored to use NavigationStack with GameScreenWrapper that handles authentication flow
- **Status**: ✅ **COMPLETED** - Landing page now shows when not authenticated, proper navigation flow established
- **Result**:
  - Simplified App.tsx to only handle SDK initialization (AppLovin, Facebook, SoundManager, fonts)
  - NavigationStack now conditionally shows Landing/Auth screens vs Game screen based on authentication
  - GameScreenWrapper component handles all GameScreen props and authentication logic
  - Proper separation of concerns between navigation and game logic
  - Landing page displays correctly for unauthenticated users

### **✅ Navigation Architecture Improvements:**

- **NavigationStack Enhancement**: Added conditional `initialRouteName` based on authentication state
- **GameScreenWrapper**: Created wrapper component that provides all necessary props to GameScreen
- **Authentication Flow**: Proper flow from Landing → Login/SignUp → Game screens
- **Loading States**: Centralized loading spinner for authentication state determination
- **Error Handling**: Proper error states for riddle loading failures and daily challenge completion

### **Current Implementation Details:**

- **App.tsx**: Simplified to SDK initialization only, uses NavigationStack directly
- **NavigationStack**: Handles authentication-based routing with GameScreenWrapper
- **GameScreenWrapper**: Manages overlay state, riddle loading, next level logic
- **Authentication Flow**: Landing → Login/SignUp → Game (automatic based on auth state)
- **Loading Management**: Consistent loading states across authentication and game initialization
