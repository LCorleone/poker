# Poker Trainer — Comprehensive Improvement Plan

> Brainstorm document analyzing the current app at `/opt/july/pi_tasks/poker/` and proposing improvements across all dimensions.
> Difficulty ratings: **Easy** = hours, **Medium** = 1-3 days, **Hard** = 3+ days.
> Items within each category are roughly ordered by impact (highest first).

---

## 1. Training Features

The app is currently a "play against AI" game with light feedback. A real trainer needs **structured learning exercises**, not just free play.

### 1.1 Hand Quiz Mode
Present the player with a specific hand + board + pot situation and ask "what do you do?" Compare their answer to GTO-correct play. Score accuracy over time. This is the single highest-impact training feature — it decouples learning from the randomness of being dealt good/bad hands.
- **Difficulty:** Medium
- **Impact:** Very High

### 1.2 Scenario Library with Curated Spots
A bank of 50-100 pre-built scenarios covering common poker situations: "You have AKo in the cutoff facing a UTG raise — what do you do?", "You flopped top pair weak kicker facing a pot-sized bet — call or fold?", etc. Each scenario teaches a specific concept. Start with 20 covering preflop fundamentals, then expand.
- **Difficulty:** Medium
- **Impact:** Very High

### 1.3 Post-Flop GTO Guidance (Not Just Preflop)
The current `GTOGuide` only shows preflop starting hand advice. Post-flop decisions are where most money is won/lost. Show guidance on every street: hand strength relative to the board texture, whether to bet/check, suggested sizing. Even a rough heuristic ("you have a strong hand on a dry board — bet 50% pot") would be transformative.
- **Difficulty:** Hard
- **Impact:** Very High

### 1.4 Post-Hand Review with Replay
After each hand, show a chronological replay: each player's action, the cards as they were revealed, and annotated commentary ("Villain called with a flush draw but missed — your river bet was correct"). Currently the feedback overlay vanishes as soon as you click "next hand." Let players study what happened.
- **Difficulty:** Medium
- **Impact:** High

### 1.5 "What Would You Do?" Pauses on Interesting AI Hands
When an AI faces a non-trivial decision, pause the game and ask the human what they would do in that spot. Compare to what the AI actually did (and what GTO would suggest). This doubles the training opportunities per hand without needing separate quiz content.
- **Difficulty:** Medium
- **Impact:** High

### 1.6 Drill Mode (Rapid-Fire Decisions)
Strip away the table UI. Show just hole cards + board + action context. Player picks fold/call/raise. Next hand appears instantly. Track accuracy percentage. Focus on volume — 50 hands in 5 minutes builds pattern recognition better than playing 5 full hands.
- **Difficulty:** Medium
- **Impact:** High

### 1.7 Session Summaries
At the end of a session (or on demand), show a summary: hands played, decisions correct/incorrect, biggest mistakes, areas of strength. This gives closure and a sense of progress that the current "game over" screen lacks.
- **Difficulty:** Easy
- **Impact:** Medium

---

## 2. Game Logic

The engine is solid for a basic cash game. Several poker situations are unhandled or simplified.

### 2.1 Blind Level Escalation (Tournament Mode)
The blinds are fixed at 10/20 forever. Add an optional tournament structure where blinds increase every N hands (e.g., 10/20 → 15/30 → 25/50 → ...). This creates real tournament pressure and ICM considerations. Include a blind schedule display.
- **Difficulty:** Medium
- **Impact:** High

### 2.2 Bet Sizing Quick-Select Buttons
The raise slider is clumsy. Add preset sizing buttons: "Min Raise", "1/2 Pot", "3/4 Pot", "Pot", "All-In". These are what real players use and what training should teach. The slider remains for custom amounts.
- **Difficulty:** Easy
- **Impact:** High

### 2.3 Run It Twice / Deal Repeated Board Runouts
When two players are all-in before the river, offer "run it twice" — deal two independent board runouts and split the pot. This is standard in many games and teaches variance. Lower priority but adds polish.
- **Difficulty:** Medium
- **Impact:** Low

### 2.4 Show mucked cards at showdown
Currently when a player folds but would have shown (e.g., they called a river bet and lost), their cards aren't revealed. In real poker and training, seeing what the opponent had is crucial for learning. Show all hands that reached showdown.
- **Difficulty:** Easy
- **Impact:** Medium

### 2.5 All-In Edge Cases: Run Out the Board Visually
When all players are all-in preflop or on the flop, the board should deal out one card at a time with dramatic pacing (like TV poker). Currently `advancePhase` auto-runs through all phases instantly. This is both a UX and game logic fix.
- **Difficulty:** Easy
- **Impact:** Medium

### 2.6 Straddle and Optional Blind Variants
Allow an optional UTG straddle, which is common in live games. This teaches players how straddled pots change preflop dynamics. Low priority but adds realism.
- **Difficulty:** Medium
- **Impact:** Low

### 2.7 Complete Action History Log
The `actionHistory: ActionRecord[]` exists in the engine but is never displayed to the user. Add a scrollable action log panel (sidebar or bottom drawer) showing "Pre-flop: 小明 raised to 60 → 小红 called 60 → You..." for the current hand. This is essential for understanding hand flow.
- **Difficulty:** Easy
- **Impact:** High

---

## 3. AI Opponents

The current AI uses a single `makeAIDecision` function with equity + randomness. All 4 AIs play identically except for random noise.

### 3.1 Distinct AI Personas with Playstyles
Create 4-5 AI personalities with named strategies:
- **Tight-Aggressive (TAG)**: Plays few hands, bets/raises aggressively when they do. The "correct" style to learn against.
- **Loose-Aggressive (LAG)**: Plays many hands, applies constant pressure. Tests the human's ability to stand up to aggression.
- **Calling Station**: Plays too many hands, rarely folds. Teaches value betting (no need to bluff).
- **Nit**: Only plays premium hands, folds everything else. Teaches stealing blinds and exploiting tightness.
- **Maniac**: Raises almost every hand, massive overbets. Teaches discipline and trap-play.

Each persona modifies equity thresholds, bluff frequency, and bet sizing. Label them on the table so the player knows who they're up against.
- **Difficulty:** Medium
- **Impact:** Very High

### 3.2 AI Post-Flop Board Texture Awareness
The AI doesn't consider board texture (dry vs. wet, coordinated vs. static). A flush-draw heavy board should make the AI more cautious with one-pair hands. Add a `boardTexture()` function that classifies boards and adjusts AI aggression.
- **Difficulty:** Medium
- **Impact:** High

### 3.3 AI Positional Awareness
The AI makes no adjustment for its own position. UTG should play tighter, BTN should play wider. Add position-based adjustments to `makeAIDecision`.
- **Difficulty:** Easy
- **Impact:** Medium

### 3.4 AI Memory of Opponent Tendencies
Track the human player's stats (VPIP, PFR, fold-to-cbet %) and have the AI exploit them. If the human folds too much to river bets, the AI should bluff more on the river. This creates an adversarial learning loop.
- **Difficulty:** Hard
- **Impact:** High

### 3.5 Show AI Thought Bubbles
When it's an AI's turn, briefly show what they're "thinking": "I have a strong hand on a dry board" or "Drawing to a flush — I'll call." This teaches the human how to reason about hands by observing AI logic. Currently the AI is a black box.
- **Difficulty:** Medium
- **Impact:** High

---

## 4. UI/UX

The UI is functional but has no delight, limited feedback, and some friction points.

### 4.1 Card Deal Animation
Cards should animate into place rather than appearing instantly. A simple CSS transition (slide + fade) on deal would add 90% of the polish. Community cards should flip one at a time. This is the single biggest UX upgrade for perceived quality.
- **Difficulty:** Easy
- **Impact:** High

### 4.2 Chip Movement Animation
When bets are placed, animate chips sliding from the player to the pot area. When the pot is awarded, animate chips flowing to the winner. Currently chips just teleport. This visual feedback makes the game feel real.
- **Difficulty:** Medium
- **Impact:** High

### 4.3 Player Timer with Urgency
Add a countdown timer (e.g., 15 seconds) for the human's turn. The bar changes color as time runs out (green → yellow → red). This trains time-pressure decision making and prevents the game from feeling paused.
- **Difficulty:** Easy
- **Impact:** Medium

### 4.4 Table Themes / Dark-Light Toggle
Offer 2-3 table felt colors (classic green, casino red, modern dark). Minor but adds ownership and polish. The current dark-blue gradient background works well — just let users pick their table.
- **Difficulty:** Easy
- **Impact:** Low

### 4.5 Sound Effects
Card deal sound, chip clink on bets, subtle tension music during all-in runouts. Sound is a huge part of why video poker feels engaging. Use free/open sound libraries. Make it toggleable.
- **Difficulty:** Easy
- **Impact:** Medium

### 4.6 Mobile Layout Optimization
The CSS has a single `@media (max-width: 768px)` breakpoint. On phones the table is cramped and action buttons overflow. A dedicated mobile layout with stacked vertical view (table on top, actions below, swipeable history) would make this usable as a phone training app.
- **Difficulty:** Medium
- **Impact:** High

### 4.7 Keyboard Shortcuts
Press `F` to fold, `C` to check/call, `R` to raise, number keys for quick sizing. Display shortcuts subtly near the buttons. Essential for drill mode speed.
- **Difficulty:** Easy
- **Impact:** Medium

### 4.8 Highlight Winning Cards
At showdown, visually highlight the 5 cards that make up the winning hand. Draw a subtle glow or border around the specific cards (from hole + community) that form the best hand. Currently you just see the hand name text — connecting it to specific cards is much more educational.
- **Difficulty:** Medium
- **Impact:** High

### 4.9 Toast Notifications for Game Events
Replace the static "思考中..." text with toast-style notifications: "小明 raised to 120", "小红 folds", "New card: K♥". These slide in from the side and auto-dismiss. More informative than the current blank-wait.
- **Difficulty:** Easy
- **Impact:** Medium

---

## 5. Educational Content

### 5.1 Interactive Odds Calculator
A side panel where the player can select any two hole cards and see: preflop equity vs random hands, probability of flopping each hand type (pair, flush draw, straight draw), and hand vs hand matchups. This is the most-requested poker tool feature.
- **Difficulty:** Hard
- **Impact:** Very High

### 5.2 Hand Ranking Reference Card
A persistent "reference" tab/button that shows all hand rankings from Royal Flush down to High Card with visual examples. New players constantly need this. Currently they see Chinese hand names in feedback but have no way to learn what they mean.
- **Difficulty:** Easy
- **Impact:** High

### 5.3 Strategy Tips Contextual to the Current Situation
Beyond the GTO preflop chart, show strategy concepts relevant to the current moment. Example: "You're in the small blind facing a button raise. SB is the hardest position — you need a very strong hand to 3-bet, and even calling is risky without position." These mini-lessons appear during the hand.
- **Difficulty:** Medium
- **Impact:** High

### 5.4 Pot Odds and Outs Calculator Display
During a hand, show a real-time panel: "You need to call 40 into a pot of 160. Pot odds: 20%. You have 9 outs to a flush (~35% equity). This is a profitable call." This teaches the most fundamental poker math visually rather than through abstract feedback after the fact.
- **Difficulty:** Easy
- **Impact:** Very High

### 5.5 Glossary of Poker Terms
A searchable glossary with 50-100 terms (3-bet, continuation bet, float, check-raise, set mining, etc.) with examples. Link terms that appear in feedback to their glossary entries. The app uses Chinese poker terminology — players need to understand these terms.
- **Difficulty:** Easy
- **Impact:** Medium

### 5.6 Introductory Tutorial / Guided First Hand
The first time the app loads, walk the player through one hand step-by-step with explanations of each phase: "These are your hole cards. The player to your left must post the small blind. Now it's your turn — you can fold, call, or raise." Currently the game just starts and assumes you know Texas Hold'em.
- **Difficulty:** Medium
- **Impact:** High

---

## 6. Analytics & Progress Tracking

### 6.1 Persistent Stats with localStorage
Track across sessions: hands played, win rate, VPIP (voluntarily put $ in pot), PFR (preflop raise %), aggression factor, showdown win rate, average equity when calling. Display in a "My Stats" tab. The data is generated every hand but thrown away on reload.
- **Difficulty:** Easy
- **Impact:** Very High

### 6.2 Decision Accuracy Score
Track every decision the player makes: correct (matched GTO/equity recommendation) vs incorrect. Show a running accuracy percentage and a trend graph (are they improving?). This is the core metric of a training app.
- **Difficulty:** Easy
- **Impact:** Very High

### 6.3 Leak Detection Report
After every 50 hands, analyze the player's stats and flag specific leaks: "You fold too often to flop c-bets (72% vs optimal ~45%)" or "You call too wide from early position" or "You rarely bluff the river — adding bluffs would increase your winrate." This is the killer feature that turns a game into a coach.
- **Difficulty:** Hard
- **Impact:** Very High

### 6.4 Hand Strength Distribution Chart
A pie chart or bar chart showing: "Your hands: High Card 40%, One Pair 30%, Two Pair 12%, ..." — both for hands dealt and hands won with. Helps players calibrate expectations (most hands are weak!).
- **Difficulty:** Easy
- **Impact:** Medium

### 6.5 Session History Log
Store each completed hand as a compact record (cards, actions, outcome) in localStorage. Let the player browse past hands and review their decisions. Essential for deliberate practice.
- **Difficulty:** Medium
- **Impact:** High

### 6.6 Streak and Gamification
Track consecutive correct decisions ("current streak: 7"), longest streak, daily hands played, and simple achievements ("Played 100 hands", "Got a royal flush", "10 correct decisions in a row"). These drive engagement without being the primary training value.
- **Difficulty:** Easy
- **Impact:** Medium

---

## 7. Architecture & Technical Improvements

### 7.1 Game State as a Reducer (useReducer instead of useState)
The current `useGame` hook uses `useState` with a complex object and `structuredClone` for immutability. A proper reducer with typed actions (`FOLD`, `CALL`, `RAISE`, `DEAL_HAND`, etc.) would be cleaner, more testable, and eliminate the `stateRef` / `processingRef` hack.
- **Difficulty:** Medium
- **Impact:** Medium (dev experience)

### 7.2 Unit Tests for Hand Evaluation
The hand evaluator is the most critical and subtle piece of code. Add a test suite covering edge cases: wheel straights (A-2-3-4-5), royal flushes, split pots, tiebreakers with kickers, 7-card combinations. There are zero tests currently.
- **Difficulty:** Easy
- **Impact:** High (correctness)

### 7.3 Extract Side Pot Logic into its own Module
The `getWinners` function in `game.ts` handles side pot calculation inline. This is notoriously tricky logic. Extract it into `src/engine/pots.ts` with dedicated tests covering multi-way all-in scenarios.
- **Difficulty:** Easy
- **Impact:** Medium

### 7.4 Web Worker for Equity Calculation
Monte Carlo equity estimation runs on the main thread. With 200 iterations it's fast enough, but increasing accuracy (1000+ iterations) or computing equity for multiple opponents will cause frame drops. Move to a web worker.
- **Difficulty:** Medium
- **Impact:** Low (currently)

### 7.5 State Persistence / Resume Game
Store the full game state in localStorage so the player can close the browser and resume their session. Currently everything is lost on reload.
- **Difficulty:** Easy
- **Impact:** Medium

---

## 8. i18n and Localization

### 8.1 Language Toggle (Chinese ↔ English)
The entire UI is hardcoded in Chinese. Add a simple i18n system (even just a `Record<string, string>` map) and an English translation. This doubles the potential user base. The engine's Chinese hand names can be mapped to English equivalents.
- **Difficulty:** Medium
- **Impact:** Medium

---

## Priority Roadmap (Suggested Order)

If I had to pick the highest-ROI features for a learner:

**Phase 1 — "Make It Teach" (Highest Impact)**
1. Pot Odds & Outs display during hands (5.4) — teaches the #1 skill
2. Decision accuracy tracking in localStorage (6.1, 6.2) — makes progress visible
3. Bet sizing quick-select buttons (2.2) — teaches real bet sizing
4. Hand ranking reference card (5.2) — removes the biggest beginner barrier
5. Action history log on screen (2.7) — makes hands comprehensible

**Phase 2 — "Make It Train"**
6. Hand quiz mode with curated scenarios (1.1, 1.2) — structured practice
7. Distinct AI personas (3.1) — varied practice
8. Post-flop GTO guidance (1.3) — teaches where most money is won/lost
9. AI thought bubbles (3.5) — teaches reasoning
10. Post-hand replay with annotations (1.4) — reinforces learning

**Phase 3 — "Make It Polish"**
11. Card deal + chip animations (4.1, 4.2) — delight
12. Leak detection report (6.3) — personalized coaching
13. Tournament mode with escalating blinds (2.1) — variety
14. Interactive odds calculator (5.1) — depth
15. Tutorial for first-time players (5.6) — onboarding
16. Mobile layout optimization (4.6) — accessibility

---

## Summary

The current app is a **solid playable prototype** with correct hand evaluation, basic AI, and a clean table UI. The biggest gap is the **training layer** — it plays poker at you but doesn't actively teach. The highest-impact improvements are features that show the player *why* each decision is right or wrong *in the moment*, and track whether they're getting better over time. The engine and evaluation code provide a strong foundation to build on — most of the work is in new components, AI variety, and localStorage-backed analytics.
