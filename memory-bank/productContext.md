# Product Context

This document describes the 'why' behind the Qwordly project, the problems it solves, how it should work from a user perspective, and key user experience goals.

## Why Qwordly Exists:

Qwordly addresses the gap in mobile puzzle gaming by combining traditional word games with engaging riddle mechanics. While standard word games can become repetitive, Qwordly adds contextual clues that make each puzzle feel like a mini-mystery to solve.

## Problems Solved:

1. **Puzzle Fatigue**: Traditional word games can become monotonous. Qwordly's riddle format keeps each puzzle fresh and engaging.

2. **Lack of Progressive Challenge**: Many word games have flat difficulty curves. Qwordly's classic mode provides structured progression through increasingly challenging levels.

3. **Limited Engagement Models**: Most word games rely solely on intrinsic motivation. Qwordly combines this with extrinsic rewards (coins, stats, daily challenges) to maintain long-term engagement.

4. **Monetization Balance**: Finding the right balance between free gameplay and revenue generation. Qwordly's 3-attempt system with optional continues provides choice without forcing spending.

## How Qwordly Should Work (User Flow):

1. **App Launch** → Landing screen with sign-in options
2. **Authentication** → Email/password, Google, or Facebook sign-in
3. **First-Time User** → Welcome modal with tutorial flow
4. **Main Game Screen** → Choose Daily Challenge or Classic Mode
5. **Gameplay** → Read riddle, type guesses, receive color feedback (green/yellow/red)
6. **Hints** → Spend 50 coins to reveal a letter via bottom nav hint button
7. **Win/Loss** → Victory animation or loss modal with stats
8. **Profile/Settings** → View stats, customize avatar, manage account via bottom nav

## User Experience (UX) Goals:

- **Accessibility**: Anyone should be able to pick up and play immediately
- **Depth**: Strategic elements (coin management, hint usage, continue decisions) reward thoughtful play
- **Monetization Balance**: Fair freemium model with meaningful free options
- **Social Proof**: Statistics and achievements provide shareable moments
- **Retention**: Daily challenges and progressive unlocks encourage return visits
- **Tension & Release**: 5-guess limit creates engagement, hint system provides relief

## Target Audience:

- **Primary**: Mobile gamers aged 18-45 who enjoy word puzzles (Wordle, crosswords) and riddle-based challenges
- **Secondary**: Casual gamers looking for short daily gaming sessions (5-10 minutes)
- **Characteristics**: Enjoys intellectual challenge, appreciates progression systems, willing to engage with optional monetization for enhanced experience

## Updated Core Features

### **Gameplay Features**

- Riddle-based Wordle-clone gameplay with variable answer lengths
- 5-guess limit per riddle (Classic and Challenge modes); 3 for tutorial
- Daily Challenge mode with unique daily riddles
- Classic Mode with sequential, progressively unlocked levels
- Hint system (50 coins to reveal a letter)
- Server-side riddle generation and guess validation

### **Monetization Features**

- Interstitial ads shown between levels (unless user purchased ad removal)
- Rewarded video ads for coins/hints
- Coin purchases for hints
- In-app purchases for coin packs and ad removal

### **Progression Features**

- User authentication (Google, Facebook, email/password)
- Comprehensive user profiles with avatars and statistics
- Achievement and progression tracking
- Cross-platform progress synchronization

### **Technical Features**

- Firebase backend for data persistence and user management
- AppLovin MAX for ad serving (interstitial and rewarded)
- Automatic content generation and scaling
- Server-side validation and anti-cheat measures

## Monetization Philosophy

1. **Generous Free Play**: 5 guesses per riddle allows most puzzles to be solved without spending
2. **Meaningful Choice**: Hints cost coins, and coins can be earned through gameplay or purchased
3. **No Force**: Players are never forced to spend money or watch ads
4. **Value Perception**: Both free (rewarded ad) and paid (coin purchase) options provide clear value
5. **Pacing**: Daily challenge locks and sequential classic levels maintain engagement without enabling endless grinding

## Key Differentiators

- **Riddle-Based Gameplay**: More engaging than random word guessing
- **Variable Answer Lengths**: Not limited to 5-letter words, adding complexity and variety
- **AI-Generated Content**: Continuous content expansion through OpenAI integration
- **Firestore-Backed Levels**: Consistent performance and automatic scaling; 25 new riddles auto-generated when a user's remaining classic levels drop to 10
- **Comprehensive User Profiles**: Detailed statistics and customizable avatars
- **Cross-Platform**: Available on both iOS and Android with synchronized progress
- **Social Sharing**: Players can share daily challenge results (similar to Wordle's grid sharing)
