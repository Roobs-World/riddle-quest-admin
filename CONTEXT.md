# Riddle Quest

Riddle Quest is one game delivered through provider-specific web surfaces. This glossary distinguishes globally authoritative accounts from deliberately platform-local play and provider-scoped state.

## Delivery

**Web Target**:
A compile-time game artifact containing exactly one platform integration and only the capabilities permitted for that platform.
_Avoid_: Platform build, universal build

**Reddit App**:
A versioned Reddit package containing an interactive-post client and its trusted server boundary.
_Avoid_: Reddit ZIP, Reddit web build

**YouTube Playable**:
A self-contained Web Target hosted by YouTube whose play state belongs only to that Playable surface.
_Avoid_: YouTube app, YouTube account

**Bundled Content Pack**:
A versioned, reviewed set of canonical riddles and aligned localizations shipped inside a Web Target.
_Avoid_: Live catalog, remote content

**Interactive Post**:
A Reddit post that hosts an installed Reddit App experience; its post identity may scope social play but never the global player account.
_Avoid_: Game page, app instance

**Installation**:
One Reddit App installation in one subreddit, with its own Reddit-managed state namespace.
_Avoid_: Tenant, community account

**Capability Gap**:
A shared game feature for which the current platform has no approved, trustworthy provider capability. Its surface is absent or explicitly unavailable rather than simulated.
_Avoid_: Unsupported no-op, partial support

**Facebook Release Candidate**:
A Riddle Quest Facebook version prepared for owner approval, including verified purchases and required platform review evidence. Preparation does not authorize public publication.
_Avoid_: Published release, testing bundle

**Facebook Audience**:
Eligible Facebook players aged 13 and above; family-friendly presentation does not mean the release is directed at children under 13.
_Avoid_: All-ages Facebook release

## Identity and authority

**Provisional Play**:
Solo answers and Classic progression shown to the player before the game backend confirms them.
_Avoid_: Confirmed win, earned reward

**Confirmed Progress**:
The latest solo progression accepted by the game backend, including the entitlement to the next Classic question.
_Avoid_: Local progress, displayed level

**Issued Question Buffer**:
A bounded set of Classic questions and immutable play sessions issued from Confirmed Progress for responsive solo play.
_Avoid_: Offline catalog, unlocked levels

**Reddit Session**:
The trusted Reddit request context for a person, post, subreddit, installation, and app; it is anonymous when no Reddit user identity is present.
_Avoid_: Firebase session, Reddit account

**Global Game Account**:
The durable Riddle Quest identity, progression, economy, and safety record governed by the game backend.
_Avoid_: Reddit account, installation account

**Playable Save**:
The YouTube-owned durable record for one player's platform-local solo progress, distinct from a Global Game Account.
_Avoid_: Global profile, account cache

**Local Play Balance**:
A non-purchasable, non-transferable balance inside a Playable Save that supports local solo actions only.
_Avoid_: Global coins, wallet

**Provider Identity**:
The private binding between a platform-scoped player identifier and one generation of a Global Game Account.
_Avoid_: Profile, username

**Account Generation**:
One lifecycle of a Global Game Account for a Provider Identity; deletion closes that generation and a later fresh start creates the next one.
_Avoid_: Account version, reset

**Game-owned Identity**:
The name and avatar governed by Riddle Quest for general game surfaces, distinct from provider profile data shown only on approved provider-social surfaces.
_Avoid_: Platform profile

## Reddit state and commerce

**Devvit Gateway**:
The trusted same-origin boundary that authenticates a Reddit Session and permits narrowly defined access to the global game authority.
_Avoid_: Firebase proxy, pass-through API

**Installation State**:
Subreddit-scoped, non-canonical state belonging to one Installation, never the authority for global balances, progression, purchases, or safety decisions.
_Avoid_: Player data, global cache

**Reddit Realtime Channel**:
A transient provider stream through which the trusted server publishes live post or match events; durable state remains outside the channel.
_Avoid_: Game socket, event store

**Platform Product**:
A provider-specific sellable item and receipt contract that may grant a shared game entitlement but is not interchangeable with another provider's product.
_Avoid_: Shared SKU, universal receipt
