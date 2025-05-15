# Active Context: Riddle Wordle Clone

## 1. Current Work Focus

- **Project Initiation:** Setting up the initial project structure, development environment, and core Memory Bank documentation.
- **Technology Stack Confirmation:** Finalizing choices for state management (Context vs. Zustand) and client-side caching (AsyncStorage vs. MMKV) if not already implicitly decided by common practice or ease of initial setup.
- **Firebase Project Setup:** Creating and configuring the Firebase project, including enabling Authentication, Firestore, Storage, and setting up initial security rules.

## 2. Recent Changes & Decisions

- **Memory Bank Established:** Core documentation (`projectbrief.md`, `productContext.md`, `techContext.md`, `systemPatterns.md`, `activeContext.md`, `progress.md`) has been created based on the initial project requirements.
- **Architectural Outline:** A client-server architecture using React Native and Firebase has been defined.
- **Feature Prioritization (Implicit):** The MVP scope is defined by the project brief, focusing on core gameplay, auth, IAP, profile, and settings within a 2-week timeline.

## 3. Next Steps & Immediate Goals

1.  **Detailed MVP Feature Breakdown:** Further break down MVP features into smaller, manageable tasks.
2.  **Environment Setup:**
    - Initialize React Native project with TypeScript.
    - Install and configure NativeWind.
    - Set up Firebase SDK in the React Native project.
    - Configure navigation (e.g., React Navigation).
3.  **Authentication Module:** Implement basic email/password and Google Sign-In.
4.  **Core Game Screen UI:** Develop the static UI for the main game screen (riddle display, guess grid, keyboard).
5.  **Basic Game Logic (Client-Side):** Implement letter evaluation and feedback for guesses (without backend persistence initially for rapid prototyping).
6.  **Google Sheets & Apps Script:**
    - Set up the Google Sheet for the initial 100+ riddles.
    - Develop the initial Apps Script for one-way sync to Firestore (manual trigger initially).

## 4. Active Decisions & Considerations

- **State Management Choice:** While both React Context and Zustand are options, for the MVP, React Context might be simpler to start with for global states like auth status and user profile. If complexity grows significantly, migrate parts to Zustand.
- **Client-Side Caching:** AsyncStorage is generally simpler to integrate. MMKV could be considered later if performance with AsyncStorage becomes an issue for specific data (e.g., large lists of riddles if fetched in bulk for offline classic mode).
- **Error Handling Strategy:** Define a consistent approach for handling and displaying errors (API errors, validation errors, etc.).
- **Testing Strategy - Initial Focus:** Start with Jest unit tests for utility functions and core game logic. Detox E2E tests will be set up once basic navigation and core screens are in place.

## 5. Key Patterns & Preferences (Emerging)

- **Modular Development:** Features will be developed in a modular fashion (auth, game, profile, etc.).
- **Iterative Approach:** Build core functionality first, then layer on enhancements and additional features.
- **Clear Communication:** Regular updates to `progress.md` and `activeContext.md` to track status and decisions.

## 6. Learnings & Project Insights (To be populated as project progresses)

- _(This section will capture insights gained during development, challenges faced, and solutions implemented.)_
