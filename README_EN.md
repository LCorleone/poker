# 🃏 Texas Hold'em Trainer

> A Texas Hold'em poker trainer built with React 19 + TypeScript + Vite, featuring LLM-powered AI opponents and GTO strategy coaching

[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 6](https://img.shields.io/badge/Vite-6-purple?logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [LLM Configuration](#llm-configuration)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)

## Features

### 🎮 Full Poker Engine
- Hand evaluation, pot calculation, side pots, all-ins, and showdowns
- 5-player games: you vs. 4 AI opponents

### 🤖 LLM AI Opponents
- Plug in any large language model (DeepSeek / GLM / OpenAI, etc.) to let the AI genuinely "think" through its betting decisions
- Works without an LLM configured — falls back to built-in decision logic

### 🎭 5 AI Play Styles
Randomly assigned each session. Observe their behavior to figure out who you're up against:

| Style | Abbr | Description |
|-------|------|-------------|
| Tight-Aggressive | TAG | Plays few hands, bets aggressively |
| Loose-Aggressive | LAG | Plays many hands, applies constant pressure |
| Calling Station | — | Calls with almost anything |
| Rock (Nit) | NIT | Extremely tight and conservative |
| Maniac | — | Unpredictable, wild play |

### 💭 AI Thought Process Display
After each AI decision, a thought bubble reveals its reasoning — a great way to learn how different play styles approach the game.

### 📖 GTO Advisor
- Pre-flop and post-flop GTO strategy guidance
- Real-time recommendations for the current game state

### 📝 Hand Quiz Mode
- 12 curated scenarios across 5 categories: basics, value betting, pot odds, bluffing, and position play
- Test and sharpen your decision-making skills

### 📊 Statistics Tracking
- Decision accuracy, win rate, and chip history
- All data persisted in the browser's localStorage

### 🏆 Tournament Mode
- 10 blind levels with escalating blinds
- Simulates a real tournament experience

### 🎓 Beginner Tutorial
- Guided walk-through that teaches Texas Hold'em from scratch

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Build tool |

- **100 % client-side** — no backend required
- LLM configuration stored in the browser's localStorage

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser and start playing.

## LLM Configuration

1. Click the 🤖 **AI Settings** button in the top-right corner
2. Fill in your API credentials
3. Any **OpenAI-compatible API** is supported

**Defaults:**

| Setting | Default Value |
|---------|---------------|
| API Base | `https://open.bigmodel.cn/api/coding/paas/v4` |
| Model | `glm-5-turbo` |

> ⚠️ Your API key is stored locally in the browser and is never sent to any third-party server.

## Project Structure

```
src/
├── components/       # UI components
├── engine/           # Poker engine (hand evaluation, pot calculations, etc.)
├── ai/               # AI decision logic
├── hooks/            # React hooks
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
└── App.tsx           # App entry point
```

## Screenshots

<!-- Screenshot placeholders -->
```
Game Table
Hand Quiz
Statistics Dashboard
```

---

**Texas Hold'em Trainer** — Level up your poker strategy through practice 🚀
