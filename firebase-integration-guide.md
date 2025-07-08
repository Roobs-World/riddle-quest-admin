# Firebase Functions Integration Guide - Qwordly

## 📊 **Complete Statistics Support**

All requested statistics are **fully implemented and tracked** in the Firebase functions:

### **✅ Required Stats - All Supported**

| Stat                        | Firebase Field                | Tracking Method                                   | Client Display                             |
| --------------------------- | ----------------------------- | ------------------------------------------------- | ------------------------------------------ |
| **Daily Puzzles Completed** | `stats.dailyPuzzlesCompleted` | Incremented on challenge mode wins                | `playerData.progress?.dailyChallengeIndex` |
| **Best Streak**             | `stats.bestStreak`            | Updated when current streak exceeds previous best | `stats?.bestStreak`                        |
| **Words Guessed**           | `stats.totalWordsGuessed`     | Incremented on every guess attempt                | `stats?.totalWordsGuessed`                 |
| **Win Rate %**              | `stats.winRate`               | Calculated as `(totalWins / gamesPlayed) * 100`   | `stats?.winRate`                           |
| **Highest Level (Classic)** | `stats.highestLevelClassic`   | Updated when classic level increases              | `stats?.highestLevelClassic`               |
| **Games Played**            | `stats.gamesPlayed`           | Incremented on every game session                 | `stats?.gamesPlayed`                       |

### **🎯 Streak Logic**

**Streak continues when**: User solves the riddle correctly (regardless of attempts used)  
**Streak resets when**: User exhausts all attempts without solving the riddle

**Max Attempts by Game Mode**:

- Challenge: 5 attempts
- Classic: 5 attempts
- Tutorial: 3 attempts

---

## 🚀 **Firebase Functions Available**

### **1. submitGuess** (Enhanced)

**Purpose**: Handles all game logic and stat tracking  
**Tracks**: All 6 required stats automatically  
**Client Usage**: Already integrated via `RiddleService.submitGuess()`

```typescript
// Already implemented in RiddleService.ts
const result = await RiddleService.submitGuess({
  guess: "word",
  riddleId: "riddle-123",
  gameMode: "classic", // or "challenge" or "tutorial"
  attempts: 3,
});
```

### **2. initializeUser** (New)

**Purpose**: Create new user documents with complete default stats  
**Client Usage**: Call during user registration

```typescript
// New method in UserDataService
const userDataService = new UserDataService();
const result = await userDataService.initializeNewUser({
  email: "user@example.com",
  username: "username",
  displayName: "Display Name", // optional
  avatarUrl: "https://...", // optional
});
```

### **3. ensureUserComplete** (New)

**Purpose**: Fix incomplete user documents (defensive programming)  
**Client Usage**: Call on app startup for existing users

```typescript
// New method in UserDataService
const userDataService = new UserDataService();
const result = await userDataService.ensureUserDocumentComplete();
```

### **4. updateUserStats** (New)

**Purpose**: Manual stat management for admin operations  
**Client Usage**: Admin tools, data fixes

```typescript
// New method in UserDataService
const userDataService = new UserDataService();
const result = await userDataService.updateUserStats("userId123", {
  dailyPuzzlesCompleted: 10,
  bestStreak: 5,
  totalWordsGuessed: 100,
  // ... other stats
});
```

---

## 🔧 **Client Integration Points**

### **1. User Registration Flow**

```typescript
// When new user registers
try {
  // 1. Create Firebase Auth account (existing)
  const userCredential = await createUserWithEmailAndPassword(...);

  // 2. Initialize user document with complete stats (NEW)
  const userDataService = new UserDataService();
  const result = await userDataService.initializeNewUser({
    email: userCredential.user.email!,
    username: username,
    displayName: displayName,
    avatarUrl: avatarUrl
  });

  console.log("User initialized:", result.message);
} catch (error) {
  console.error("Registration failed:", error);
}
```

### **2. App Startup Flow**

```typescript
// When existing user logs in
try {
  // 1. Sign in user (existing)
  await signInWithEmailAndPassword(...);

  // 2. Ensure user document completeness (NEW)
  const userDataService = new UserDataService();
  await userDataService.ensureUserDocumentComplete();

  // 3. Load user data (existing)
  const playerData = await userDataService.loadUserProgress(userId);
} catch (error) {
  console.error("Login failed:", error);
}
```

### **3. Game Play Flow**

```typescript
// When user submits a guess (EXISTING - Enhanced)
try {
  const result = await RiddleService.submitGuess({
    guess: userGuess,
    riddleId: currentRiddle.riddleId,
    gameMode: gameMode, // "classic", "challenge", or "tutorial"
    attempts: currentAttempts,
  });

  // All 6 required stats are automatically tracked!
  // - dailyPuzzlesCompleted (if challenge mode)
  // - bestStreak (if new best achieved)
  // - totalWordsGuessed (always)
  // - winRate (calculated)
  // - highestLevelClassic (if classic mode)
  // - gamesPlayed (always)
} catch (error) {
  console.error("Guess submission failed:", error);
}
```

### **4. Admin Operations**

```typescript
// For admin tools and data management (NEW)
try {
  const userDataService = new UserDataService();

  // Fix user stats manually
  await userDataService.updateUserStats("problematicUserId", {
    dailyPuzzlesCompleted: 15,
    bestStreak: 8,
    totalWordsGuessed: 200,
    winRate: 75.5,
    highestLevelClassic: 25,
    gamesPlayed: 30,
  });
} catch (error) {
  console.error("Admin update failed:", error);
}
```

---

## 📱 **Profile Display Integration**

All stats are properly displayed in `FullProfileDetailsModal.tsx`:

```typescript
// Daily Puzzles (from progress)
{
  (playerData.progress?.dailyChallengeIndex || 0).toString();
}

// Best Streak
{
  (stats?.bestStreak || 0).toString();
}

// Words Guessed
{
  (stats?.totalWordsGuessed || 0).toString();
}

// Win Rate %
{
  `${(stats?.winRate || 0).toString()}%`;
}

// Highest Level (Classic)
{
  (stats?.highestLevelClassic || 0).toString();
}

// Games Played
{
  (stats?.gamesPlayed || 0).toString();
}
```

---

## 🛡️ **Data Safety & Reliability**

### **Defensive Programming**

- `submitGuess` automatically calls `ensureUserDocumentComplete()`
- Missing stat fields are added with default values
- All stats have fallback defaults in case of missing data

### **Server-Side Authority**

- All stat calculations happen server-side for security
- Client cannot manipulate stats directly
- Firestore rules enforce proper access control

### **Error Handling**

- Comprehensive error logging in Firebase functions
- Graceful fallbacks for missing data
- Type safety with TypeScript throughout

---

## 🎯 **Implementation Checklist**

### **Firebase Functions** ✅

- [x] `submitGuess` - Enhanced with all stat tracking
- [x] `initializeUser` - New user account setup
- [x] `ensureUserComplete` - Document completeness verification
- [x] `updateUserStats` - Admin stat management

### **Client Services** ✅

- [x] `RiddleService.submitGuess()` - Already implemented
- [x] `UserDataService.initializeNewUser()` - **NEW**
- [x] `UserDataService.ensureUserDocumentComplete()` - **NEW**
- [x] `UserDataService.updateUserStats()` - **NEW**

### **Stats Display** ✅

- [x] All 6 required stats shown in profile modal
- [x] Proper fallback values for missing data
- [x] Real-time updates after game completion

### **Integration Points** ✅

- [x] User registration flow
- [x] App startup flow
- [x] Game play flow
- [x] Admin operations

---

## 🎉 **Result**

**All 6 required statistics are fully supported:**

1. ✅ Daily puzzles completed
2. ✅ Best streak
3. ✅ Words guessed
4. ✅ Win rate %
5. ✅ Highest level (classic mode)
6. ✅ Games played

**The Firebase functions provide complete coverage** for user management, stat tracking, and game logic with proper client integration points ready for immediate use!
