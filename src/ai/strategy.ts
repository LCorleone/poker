import { GameState, GameAction, Player } from '../engine/types';
import { evaluateHand, estimateEquity } from '../engine/evaluate';

export function makeAIDecision(state: GameState, playerIndex: number): GameAction {
  const player = state.players[playerIndex];
  const toCall = state.currentBet - player.currentBet;

  // Get hand evaluation
  const allCards = [...player.holeCards, ...state.communityCards];
  let handScore = 0;
  let equity = 0;

  if (state.communityCards.length >= 3) {
    const hand = evaluateHand(allCards);
    handScore = hand.rank;
    const opponents = state.players.filter(p => !p.isEliminated && !p.isFolded && p.id !== player.id).length;
    equity = estimateEquity(player.holeCards, state.communityCards, opponents, 50);
  } else {
    // Pre-flop: evaluate hole cards quality
    handScore = preflopStrength(player.holeCards);
    equity = handScore / 10;
  }

  // Add randomness (±0.1)
  const rand = (Math.random() - 0.5) * 0.2;
  const adjustedEquity = Math.max(0, Math.min(1, equity + rand));

  // Pot odds
  const potOdds = state.pot > 0 ? toCall / (state.pot + toCall) : 0;

  // Decision making
  if (toCall === 0) {
    // Can check for free
    if (adjustedEquity > 0.7) {
      // Strong hand: raise
      const raiseAmount = Math.min(
        player.currentBet + player.chips,
        state.currentBet + state.pot * (0.5 + Math.random() * 0.5)
      );
      const minRaise = state.currentBet + state.minRaise;
      if (raiseAmount >= minRaise && player.chips > 0) {
        return { type: 'raise', amount: Math.floor(Math.max(raiseAmount, minRaise)) };
      }
    }
    return { type: 'check' };
  }

  // Need to pay to continue
  if (adjustedEquity < potOdds - 0.1) {
    // Weak hand relative to pot odds: fold
    return { type: 'fold' };
  }

  if (adjustedEquity > 0.75 && player.chips > toCall * 2) {
    // Very strong: raise
    const raiseAmount = Math.min(
      player.currentBet + player.chips,
      state.currentBet + state.pot * (0.5 + Math.random() * 1)
    );
    const minRaise = state.currentBet + state.minRaise;
    if (raiseAmount >= minRaise) {
      return { type: 'raise', amount: Math.floor(Math.max(raiseAmount, minRaise)) };
    }
  }

  // Medium strength: call
  if (adjustedEquity >= potOdds) {
    return { type: 'call' };
  }

  // Bluff occasionally (5%)
  if (Math.random() < 0.05 && player.chips > toCall * 2) {
    const minRaise = state.currentBet + state.minRaise;
    const raiseAmount = Math.min(
      player.currentBet + player.chips,
      Math.floor(minRaise + state.pot * 0.5)
    );
    if (raiseAmount >= minRaise) {
      return { type: 'raise', amount: raiseAmount };
    }
  }

  // Default: fold if not worth it, call if close
  if (adjustedEquity >= potOdds - 0.05) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}

// Pre-flop hand strength: 0-10 scale
function preflopStrength(cards: { rank: number; suit: string }[]): number {
  if (cards.length !== 2) return 3;

  const r1 = cards[0].rank;
  const r2 = cards[1].rank;
  const suited = cards[0].suit === cards[1].suit;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const gap = high - low;

  let score = 0;

  // Pocket pairs
  if (r1 === r2) {
    if (r1 >= 12) return 9;    // QQ+
    if (r1 >= 9) return 7;     // 99-JJ
    if (r1 >= 5) return 5.5;   // 55-88
    return 4;                   // 22-44
  }

  // Ace-x
  if (high === 14) {
    if (low >= 12) score = 8;      // AK, AQ
    else if (low >= 10) score = 6.5; // AJ, AT
    else score = 4;                  // A9-
    if (suited) score += 1;
    return Math.min(score, 10);
  }

  // Broadway cards (10+)
  if (high >= 12 && low >= 10) {
    score = 6;
    if (suited) score += 1;
    if (gap <= 2) score += 0.5; // connected
    return score;
  }

  // Connected cards
  if (gap <= 2) {
    score = 4;
    if (suited) score += 1.5;
    if (high >= 9) score += 1;
    return score;
  }

  // Suited
  if (suited) {
    score = 3;
    if (high >= 10) score += 1;
    return score;
  }

  // Random trash
  return 2;
}
