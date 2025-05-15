# Product Context: Riddle Wordle Clone

## 1. Project Purpose (Why)

This project aims to create an engaging mobile game that combines the popular Wordle-style gameplay mechanic with the intellectual challenge of riddles. The goal is to offer a fresh and stimulating puzzle experience that encourages daily play and provides a sense of progression and achievement.

## 2. Problem Solved

- **Monotony of Traditional Word Puzzles:** Offers a twist on standard word games by integrating riddles, adding a layer of deductive reasoning beyond simple letter guessing.
- **Lack of Engaging Daily Challenges:** Provides a structured daily challenge mode to encourage regular engagement and habit formation.
- **Desire for Progression and Customization:** Addresses the player's desire to track progress, earn rewards (coins), and personalize their experience (avatars).
- **Limited Mobile Riddle Games with Wordle Mechanics:** Fills a niche for a well-designed mobile game that specifically merges these two popular concepts.

## 3. Functional Overview (How it Should Work)

### 3.1. Core Gameplay Loop

1.  **Riddle Presentation:** The user is presented with a riddle.
2.  **Guessing:** The user has 6 attempts to guess a 5-letter word that answers the riddle.
3.  **Feedback:** After each guess, the game provides feedback on the letters:
    - **Green:** Correct letter in the correct position.
    - **Yellow:** Correct letter in the wrong position.
    - **Gray:** Letter not in the answer.
4.  **Winning/Losing:**
    - **Win:** Guessing the correct word within 6 tries. The player earns coins (more for fewer guesses in Challenge Mode) and unlocks the next level (Classic Mode).
    - **Loss:** Failing to guess the word in 6 tries.
5.  **Progression:**
    - **Challenge Mode:** A new riddle is available each UTC day.
    - **Classic Mode:** Players progress sequentially through levels.

### 3.2. User Interaction & Navigation

- **Bottom Navigation:** Easy access to Home, Play (game modes), and Profile.
- **On-Screen Keyboard:** For entering guesses.
- **Intuitive Buttons:** For actions like submitting guesses, using hints, skipping levels, buying coins, and navigating menus.
- **Overlays:** For Profile and Settings, providing quick access without leaving the main context entirely.

### 3.3. Monetization & Rewards

- **Coin System:** Players earn coins by solving riddles (especially in Challenge Mode).
- **In-App Purchases (IAP):** Players can buy coin packs for real money.
- **Coin Spending:** Coins can be used to skip difficult levels in Classic Mode or to buy hints (reveal a letter) in any game mode.

### 3.4. Personalization

- **Avatars:** Users can choose from preloaded avatars or upload their own.
- **Stats Tracking:** Comprehensive statistics allow users to monitor their performance and progress.

## 4. User Experience (UX) Goals

- **Engaging & Addictive:** The core gameplay should be fun and challenging, encouraging daily play.
- **Intuitive & Easy to Learn:** New users should quickly understand how to play and navigate the app.
- **Visually Appealing & Clean:** A modern, polished UI that mimics the provided screenshot styling (clean cards, bold headings, clear iconography).
- **Rewarding:** Players should feel a sense of accomplishment through solving riddles, earning coins, and seeing their stats improve.
- **Smooth & Performant:** Fast load times, responsive input, and fluid animations.
- **Accessible:** The game should be usable by a wide range of players, including those with disabilities (VoiceOver/TalkBack support, color-blind friendly patterns, adjustable text size).
- **Seamless Onboarding:** Optional anonymous play to allow users to try the game before committing to full registration.
- **Non-Intrusive Monetization:** IAP should be optional and not detract from the core enjoyment for non-paying users.
