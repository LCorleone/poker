import { GameState, GameAction, AIPersona } from '../engine/types';
import { evaluateHand, estimateEquity } from '../engine/evaluate';

export interface AIDecision {
  action: GameAction;
  thought: string;
}

// Persona configurations
interface PersonaConfig {
  label: string;
  style: string;
  foldThreshold: number;   // equity below this minus potOdds = fold
  raiseThreshold: number;  // equity above this = raise
  bluffFreq: number;       // 0-1 probability of bluffing
  raiseSize: number;       // multiplier for pot-sized raise (0.5 = half pot)
  tightness: number;       // preflop tightness (higher = plays fewer hands)
}

const PERSONAS: Record<AIPersona, PersonaConfig> = {
  tag: {
    label: '紧凶',
    style: '稳健型玩家',
    foldThreshold: -0.08,
    raiseThreshold: 0.72,
    bluffFreq: 0.08,
    raiseSize: 0.75,
    tightness: 0.8,
  },
  lag: {
    label: '松凶',
    style: '激进型玩家',
    foldThreshold: -0.15,
    raiseThreshold: 0.65,
    bluffFreq: 0.15,
    raiseSize: 0.9,
    tightness: 0.4,
  },
  'calling-station': {
    label: '跟注站',
    style: '爱跟注的玩家',
    foldThreshold: -0.25,
    raiseThreshold: 0.85,
    bluffFreq: 0.02,
    raiseSize: 0.5,
    tightness: 0.3,
  },
  nit: {
    label: '岩石',
    style: '极保守玩家',
    foldThreshold: -0.03,
    raiseThreshold: 0.8,
    bluffFreq: 0.01,
    raiseSize: 0.6,
    tightness: 0.9,
  },
  maniac: {
    label: '疯子',
    style: '疯狂下注型',
    foldThreshold: -0.2,
    raiseThreshold: 0.5,
    bluffFreq: 0.25,
    raiseSize: 1.2,
    tightness: 0.2,
  },
};

export const PERSONA_INFO = PERSONAS;

export function makeAIDecision(state: GameState, playerIndex: number): AIDecision {
  const player = state.players[playerIndex];
  const persona = player.persona || 'tag';
  const config = PERSONAS[persona];
  const toCall = state.currentBet - player.currentBet;

  // Get hand evaluation
  const allCards = [...player.holeCards, ...state.communityCards];
  let handScore = 0;
  let equity = 0;
  let handDesc = '';

  if (state.communityCards.length >= 3) {
    const hand = evaluateHand(allCards);
    handScore = hand.rank;
    handDesc = hand.name;
    const opponents = state.players.filter(p => !p.isEliminated && !p.isFolded && p.id !== player.id).length;
    equity = estimateEquity(player.holeCards, state.communityCards, opponents, 50);
  } else {
    handScore = preflopStrength(player.holeCards);
    equity = handScore / 10;
    handDesc = describeHoleCards(player.holeCards);
  }

  // Add randomness based on persona
  const rand = (Math.random() - 0.5) * 0.15;
  const adjustedEquity = Math.max(0, Math.min(1, equity + rand));

  // Pot odds
  const potOdds = state.pot > 0 && toCall > 0 ? toCall / (state.pot + toCall) : 0;

  // Decision logic
  if (toCall === 0) {
    if (adjustedEquity > config.raiseThreshold) {
      const raiseAmount = calculateRaise(state, player, config.raiseSize);
      if (raiseAmount) {
        return {
          action: { type: 'raise', amount: raiseAmount },
          thought: `${handDesc}很强(${Math.round(adjustedEquity * 100)}%)，加注获取价值`,
        };
      }
    }
    return {
      action: { type: 'check' },
      thought: adjustedEquity > 0.5
        ? `${handDesc}还不错(${Math.round(adjustedEquity * 100)}%)，过牌看看`
        : `${handDesc}一般(${Math.round(adjustedEquity * 100)}%)，过牌免费看下一张`,
    };
  }

  // Need to pay
  if (adjustedEquity < potOdds + config.foldThreshold) {
    // Bluff check
    if (Math.random() < config.bluffFreq && player.chips > toCall * 2) {
      const raiseAmount = calculateRaise(state, player, config.raiseSize);
      if (raiseAmount) {
        return {
          action: { type: 'raise', amount: raiseAmount },
          thought: `牌力不够但在诈唬(${config.label}风格)`,
        };
      }
    }
    return {
      action: { type: 'fold' },
      thought: `赢率太低(${Math.round(adjustedEquity * 100)}%) < 底池赔率(${Math.round(potOdds * 100)}%)，弃牌`,
    };
  }

  if (adjustedEquity > config.raiseThreshold && player.chips > toCall * 2) {
    const raiseAmount = calculateRaise(state, player, config.raiseSize);
    if (raiseAmount) {
      return {
        action: { type: 'raise', amount: raiseAmount },
        thought: `${handDesc}很强(${Math.round(adjustedEquity * 100)}%)，加注!`,
      };
    }
  }

  if (adjustedEquity >= potOdds + config.foldThreshold) {
    // Bluff raise sometimes
    if (Math.random() < config.bluffFreq && player.chips > toCall * 2) {
      const raiseAmount = calculateRaise(state, player, config.raiseSize);
      if (raiseAmount) {
        return {
          action: { type: 'raise', amount: raiseAmount },
          thought: `在半诈唬，牌力边缘但加注施压`,
        };
      }
    }
    return {
      action: { type: 'call' },
      thought: adjustedEquity > potOdds
        ? `赢率(${Math.round(adjustedEquity * 100)}%) > 底池赔率(${Math.round(potOdds * 100)}%)，跟注`
        : `边缘决定，赢率接近赔率，${config.label}选择跟注`,
    };
  }

  return {
    action: { type: 'fold' },
    thought: `牌力不够，弃牌`,
  };
}

function calculateRaise(state: GameState, player: { currentBet: number; chips: number }, sizeMultiplier: number): number | null {
  const raiseAmount = Math.min(
    player.currentBet + player.chips,
    state.currentBet + state.pot * (sizeMultiplier * (0.8 + Math.random() * 0.4))
  );
  const minRaise = state.currentBet + state.minRaise;
  if (raiseAmount >= minRaise && player.chips > 0) {
    return Math.floor(Math.max(raiseAmount, minRaise));
  }
  return null;
}

function describeHoleCards(cards: { rank: number; suit: string }[]): string {
  if (cards.length !== 2) return '未知';
  const r1 = cards[0].rank;
  const r2 = cards[1].rank;
  const suited = cards[0].suit === cards[1].suit;
  if (r1 === r2) return `口袋对${r1 >= 12 ? '(强)' : ''}`;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  if (high === 14 && low >= 12) return suited ? 'AK/AQ同花' : 'AK/AQ杂色';
  if (high === 14) return suited ? `A${low}同花` : `A${low}杂色`;
  if (high >= 12 && low >= 10) return suited ? '同花大牌' : '大牌';
  return suited ? '同花连牌' : '边缘牌';
}

function preflopStrength(cards: { rank: number; suit: string }[]): number {
  if (cards.length !== 2) return 3;
  const r1 = cards[0].rank;
  const r2 = cards[1].rank;
  const suited = cards[0].suit === cards[1].suit;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const gap = high - low;

  if (r1 === r2) {
    if (r1 >= 12) return 9;
    if (r1 >= 9) return 7;
    if (r1 >= 5) return 5.5;
    return 4;
  }

  let score = 0;
  if (high === 14) {
    if (low >= 12) score = 8;
    else if (low >= 10) score = 6.5;
    else score = 4;
    if (suited) score += 1;
    return Math.min(score, 10);
  }

  if (high >= 12 && low >= 10) {
    score = 6;
    if (suited) score += 1;
    if (gap <= 2) score += 0.5;
    return score;
  }

  if (gap <= 2) {
    score = 4;
    if (suited) score += 1.5;
    if (high >= 9) score += 1;
    return score;
  }

  if (suited) {
    score = 3;
    if (high >= 10) score += 1;
    return score;
  }

  return 2;
}
