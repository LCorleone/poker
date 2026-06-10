import { Card, HandRank, EvaluatedHand } from './types';

// Chinese names for hand ranks
const HAND_NAMES: Record<HandRank, string> = {
  [HandRank.HIGH_CARD]: '高牌',
  [HandRank.ONE_PAIR]: '一对',
  [HandRank.TWO_PAIR]: '两对',
  [HandRank.THREE_OF_A_KIND]: '三条',
  [HandRank.STRAIGHT]: '顺子',
  [HandRank.FLUSH]: '同花',
  [HandRank.FULL_HOUSE]: '葫芦',
  [HandRank.FOUR_OF_A_KIND]: '四条',
  [HandRank.STRAIGHT_FLUSH]: '同花顺',
  [HandRank.ROYAL_FLUSH]: '皇家同花顺',
};

// Generate all C(n,k) combinations
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// Evaluate exactly 5 cards
function evaluate5(cards: Card[]): EvaluatedHand {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
      straightHigh = uniqueRanks[0];
    }
    // Wheel: A-2-3-4-5
    if (uniqueRanks[0] === 14 && uniqueRanks[1] === 5 && uniqueRanks[2] === 4 && uniqueRanks[3] === 3 && uniqueRanks[4] === 2) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  // Count ranks
  const rankCounts: Record<number, number> = {};
  for (const r of ranks) {
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }

  const counts = Object.entries(rankCounts)
    .map(([rank, count]) => ({ rank: Number(rank), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Determine hand rank
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return { rank: HandRank.ROYAL_FLUSH, kickers: [14], name: HAND_NAMES[HandRank.ROYAL_FLUSH] };
    }
    return { rank: HandRank.STRAIGHT_FLUSH, kickers: [straightHigh], name: HAND_NAMES[HandRank.STRAIGHT_FLUSH] };
  }

  if (counts[0].count === 4) {
    return {
      rank: HandRank.FOUR_OF_A_KIND,
      kickers: [counts[0].rank, counts[1].rank],
      name: HAND_NAMES[HandRank.FOUR_OF_A_KIND],
    };
  }

  if (counts[0].count === 3 && counts[1].count === 2) {
    return {
      rank: HandRank.FULL_HOUSE,
      kickers: [counts[0].rank, counts[1].rank],
      name: HAND_NAMES[HandRank.FULL_HOUSE],
    };
  }

  if (isFlush) {
    return {
      rank: HandRank.FLUSH,
      kickers: ranks,
      name: HAND_NAMES[HandRank.FLUSH],
    };
  }

  if (isStraight) {
    return {
      rank: HandRank.STRAIGHT,
      kickers: [straightHigh],
      name: HAND_NAMES[HandRank.STRAIGHT],
    };
  }

  if (counts[0].count === 3) {
    const kickers = counts.filter(c => c.count === 1).map(c => c.rank).sort((a, b) => b - a);
    return {
      rank: HandRank.THREE_OF_A_KIND,
      kickers: [counts[0].rank, ...kickers],
      name: HAND_NAMES[HandRank.THREE_OF_A_KIND],
    };
  }

  if (counts[0].count === 2 && counts[1].count === 2) {
    const pairRanks = [counts[0].rank, counts[1].rank].sort((a, b) => b - a);
    const kicker = counts[2].rank;
    return {
      rank: HandRank.TWO_PAIR,
      kickers: [...pairRanks, kicker],
      name: HAND_NAMES[HandRank.TWO_PAIR],
    };
  }

  if (counts[0].count === 2) {
    const kickers = counts.filter(c => c.count === 1).map(c => c.rank).sort((a, b) => b - a);
    return {
      rank: HandRank.ONE_PAIR,
      kickers: [counts[0].rank, ...kickers],
      name: HAND_NAMES[HandRank.ONE_PAIR],
    };
  }

  return {
    rank: HandRank.HIGH_CARD,
    kickers: ranks,
    name: HAND_NAMES[HandRank.HIGH_CARD],
  };
}

// Evaluate best hand from up to 7 cards
export function evaluateHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    // Not enough cards yet, return a low evaluation
    return { rank: HandRank.HIGH_CARD, kickers: cards.map(c => c.rank).sort((a, b) => b - a), name: '牌不足' };
  }

  if (cards.length === 5) {
    return evaluate5(cards);
  }

  // Get best 5-card hand from combinations
  const combos = combinations(cards, 5);
  let best: EvaluatedHand | null = null;

  for (const combo of combos) {
    const ev = evaluate5(combo);
    if (!best || compareHands(ev, best) > 0) {
      best = ev;
    }
  }

  return best!;
}

// Compare: >0 means a wins, <0 means b wins, 0 means tie
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

// Get Chinese name for hand strength
export function getHandStrength(holeCards: Card[], communityCards: Card[]): string {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    // Pre-flop or partial: describe hole cards
    return describeHoleCards(holeCards);
  }
  const ev = evaluateHand(allCards);
  return ev.name;
}

function describeHoleCards(cards: Card[]): string {
  if (cards.length !== 2) return '未知';
  const [a, b] = cards;
  const rA = a.rank;
  const rB = b.rank;
  const suited = a.suit === b.suit;

  if (rA === rB) {
    if (rA >= 12) return '超强口袋对';
    if (rA >= 9) return '中等口袋对';
    return '小口袋对';
  }
  const high = Math.max(rA, rB);
  const low = Math.min(rA, rB);
  if (high === 14) {
    if (low >= 12) return suited ? '同花强牌' : '强牌';
    if (low >= 10) return suited ? '同花中等牌' : '中等牌';
    return suited ? '同花Ax' : '弱Ax';
  }
  if (high >= 12 && low >= 10) return suited ? '同花连牌' : '连牌';
  return suited ? '同花杂牌' : '杂牌';
}

// Count outs: cards that improve hand to likely winner
export function countOuts(holeCards: Card[], communityCards: Card[]): number {
  if (holeCards.length !== 2 || communityCards.length < 3) return 0;

  const allCards = [...holeCards, ...communityCards];
  const currentHand = evaluateHand(allCards);

  // If already have a strong hand (two pair+), fewer meaningful outs needed
  if (currentHand.rank >= HandRank.TWO_PAIR) return 0;

  const known = new Set(allCards.map(c => `${c.suit}-${c.rank}`));
  let outs = 0;

  for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as const) {
    for (let r = 2; r <= 14; r++) {
      if (known.has(`${suit}-${r}`)) continue;

      // Test if this card improves our hand
      const testCards = [...allCards, { suit, rank: r as Card['rank'] }];
      const newHand = evaluateHand(testCards);

      if (newHand.rank > currentHand.rank) {
        outs++;
      }
    }
  }

  return outs;
}

// Simple equity estimation via Monte Carlo (lightweight)
export function estimateEquity(
  holeCards: Card[],
  communityCards: Card[],
  numOpponents: number,
  iterations: number = 200
): number {
  if (holeCards.length === 0) return 0;

  const known = new Set([...holeCards, ...communityCards].map(c => `${c.suit}-${c.rank}`));
  const remaining: Card[] = [];

  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  for (const s of suits) {
    for (let r = 2; r <= 14; r++) {
      if (!known.has(`${s}-${r}`)) {
        remaining.push({ suit: s, rank: r as Card['rank'] });
      }
    }
  }

  let wins = 0;
  const cardsNeeded = 5 - communityCards.length;

  for (let i = 0; i < iterations; i++) {
    // Shuffle remaining
    const shuffled = [...remaining];
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
    }

    let idx = 0;
    const simCommunity = [...communityCards];
    for (let c = 0; c < cardsNeeded; c++) {
      simCommunity.push(shuffled[idx++]);
    }

    const myHand = evaluateHand([...holeCards, ...simCommunity]);
    let iWin = true;

    for (let opp = 0; opp < numOpponents; opp++) {
      const oppCards = [shuffled[idx++], shuffled[idx++]];
      const oppHand = evaluateHand([...oppCards, ...simCommunity]);
      if (compareHands(oppHand, myHand) > 0) {
        iWin = false;
        break;
      }
    }

    if (iWin) wins++;
  }

  return wins / iterations;
}
