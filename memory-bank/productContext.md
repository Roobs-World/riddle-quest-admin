# Product Context

## Why Qwordly Exists

Qwordly addresses the gap in mobile puzzle gaming by combining traditional word games with engaging riddle mechanics. While standard word games can become repetitive, Qwordly adds contextual clues that make each puzzle feel like a mini-mystery to solve.

## Core Problems It Solves

1. **Puzzle Fatigue**: Traditional word games can become monotonous. Qwordly's riddle format keeps each puzzle fresh and engaging.

2. **Lack of Progressive Challenge**: Many word games have flat difficulty curves. Qwordly's classic mode provides structured progression through increasingly challenging levels.

3. **Limited Engagement Models**: Most word games rely solely on intrinsic motivation. Qwordly combines this with extrinsic rewards (coins, stats, daily challenges) to maintain long-term engagement.

## How It Should Work

### Core Game Loop

1. **Daily Ritual**: Users start each day with a fresh daily challenge
2. **Progressive Journey**: Classic mode provides structured advancement through levels
3. **Strategic Decisions**: Coin management for hints creates meaningful choices
4. **Achievement Satisfaction**: Clear progression metrics and statistics provide accomplishment

### User Experience Goals

- **Accessibility**: Anyone should be able to pick up and play immediately
- **Depth**: Strategic elements (coin management, hint usage) reward thoughtful play
- **Monetization:** Optional coin purchases for hints, with rewarded ads as an alternative.
- **Social Proof**: Statistics and achievements provide shareable moments
- **Retention**: Daily challenges and progressive unlocks encourage return visits

## Target Experience

Users should feel they're not just playing a word game, but solving interesting puzzles that challenge both their vocabulary and reasoning skills. The game should feel rewarding whether they play for 5 minutes (daily challenge) or longer sessions (classic progression).

## 1. What is Qwordly?

Qwordly is a riddle-based Wordle-clone mobile game that challenges players to solve engaging riddles instead of guessing random words. The game combines the addictive mechanics of Wordle with the intellectual satisfaction of solving riddles.

## 2. Core Value Proposition

- **Unique Twist on Wordle:** Instead of guessing random 5-letter words, players solve riddles with answers of varying lengths.
- **Daily Engagement:** A new daily challenge keeps players coming back.
- **Progressive Difficulty:** Classic mode offers hundreds of levels with increasing complexity.
- **Rewarding Experience:** Coin system and achievements provide motivation and progression.
- It features daily challenges, a classic mode with a vast and ever-growing number of levels stored in Firestore and augmented by AI, user authentication, and a rewarding coin system.

## 3. Target User Experience

- **Accessibility:** Easy to pick up for casual players, challenging enough for puzzle enthusiasts.
- **Social Sharing:** Players can share their daily challenge results (similar to Wordle's grid sharing).
- **Progression:** Clear sense of advancement through classic mode levels and statistics.
- **Monetization:** Optional coin purchases for hints, with rewarded ads as an alternative.

## 4. Key Differentiators

- **Riddle-Based Gameplay:** More engaging than random word guessing.
- **Variable Answer Lengths:** Not limited to 5-letter words, adding complexity and variety.
- **AI-Generated Content:** Continuous content expansion through OpenAI integration.
- \*\*Levels sourced from Firestore, ensuring consistent performance and automatic scaling.
- **Comprehensive User Profiles:** Detailed statistics and customizable avatars.
- **Cross-Platform:** Available on both iOS and Android with synchronized progress.

## 5. Problem Statement

- Existing mobile puzzle games may lack a specific blend of riddle-solving and Wordle-like mechanics, or may not offer a continuously updated stream of new content.
- Users seek engaging daily challenges and longer-term progressive puzzle experiences in a single mobile game.

## 6. Proposed Solution

- Qwordly, a mobile game for iOS and Android, combines riddle-based puzzles with Wordle-style letter guessing.
- Backend powered by Firebase for reliability and scalability.

## 7. Key Features

- Riddle-based Wordle-clone gameplay.
- Daily Challenge mode with unique daily riddles.
- Classic Mode with sequential, progressively unlocked levels.
- User authentication (Google, Facebook, email/password).
- Firebase backend for data persistence (user stats, progress, levels).
- In-app purchases (coins, no-ads).
- Rewarded and interstitial ads (AppLovin MAX).
- Customizable user profiles with avatars and statistics.
- Server-side riddle generation and guess validation.
- Levels sourced from Firestore, ensuring consistent performance and automatic scaling.
- Automatic generation and appending of 25 new riddles to the Firestore when a user's remaining classic mode riddles drop to 10.

## 8. User Experience (UX) Goals

- Intuitive and engaging gameplay that is easy to learn but challenging to master.
- Seamless user onboarding and authentication process.
- Clear visual feedback for guesses and game progression.
- Including celebratory animations (e.g., 'shattering title' effect on game win) to enhance engagement.
- Motivating reward system (coins) and fair IAP options.
- Uninterrupted gameplay with new content regularly available.
- Visually appealing interface with smooth animations and haptic feedback.
- Dynamic and immersive audio experience with fading based on user progress or game state.
- Stable and performant application on both iOS and Android.
