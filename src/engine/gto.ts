import { Card, Rank, HandRank } from './types';
import { evaluateHand } from './evaluate';
import { nashTable } from './nashTable';

export type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export interface GTOAdvice {
  action: 'raise' | 'call' | 'fold';
  confidence: 'strong' | 'marginal' | 'weak';
  explanation: string;
  handTier: string;
}

export const POSITION_NAMES: Record<Position, string> = {
  BTN: '庄位(BTN)',
  SB: '小盲(SB)',
  BB: '大盲(BB)',
  UTG: '枪口位(UTG)',
  MP: '中间位(MP)',
  CO: '关煞位(CO)',
};

// Convert a rank to a short string
function rankKey(r: Rank): string {
  if (r === 14) return 'A';
  if (r === 13) return 'K';
  if (r === 12) return 'Q';
  if (r === 11) return 'J';
  if (r === 10) return 'T';
  return String(r);
}

// Returns a canonical hand key like "AKs", "AKo", "AA", "72o" etc.
function handKey(c1: Card, c2: Card): string {
  const r1 = rankKey(c1.rank);
  const r2 = rankKey(c2.rank);
  const suited = c1.suit === c2.suit;

  // Pairs: "AA", "KK", etc.
  if (c1.rank === c2.rank) return r1 + r2;

  // Non-pairs: higher rank first, then 's' or 'o'
  if (c1.rank > c2.rank) return r1 + r2 + (suited ? 's' : 'o');
  return r2 + r1 + (suited ? 's' : 'o');
}

// Position categories for simplified GTO chart:
// - early: UTG, MP
// - late: CO, BTN
// - blinds: SB, BB
type PosCat = 'early' | 'late' | 'blinds';

function posCategory(pos: Position): PosCat {
  if (pos === 'UTG' || pos === 'MP') return 'early';
  if (pos === 'CO' || pos === 'BTN') return 'late';
  return 'blinds';
}

// Friendly hand name for display
function friendlyHandName(key: string): string {
  if (key.length === 2) return key; // pair like "AA"
  const base = key.slice(0, 2);
  const suffix = key[2] === 's' ? '同花' : '杂色';
  return base + suffix;
}

export function getGTOAdvice(
  holeCards: Card[],
  position: Position,
  facingRaise: boolean = false
): GTOAdvice {
  if (holeCards.length !== 2) {
    return {
      action: 'fold',
      confidence: 'weak',
      explanation: '无法识别手牌',
      handTier: '未知',
    };
  }

  const key = handKey(holeCards[0], holeCards[1]);
  const cat = posCategory(position);
  const entry = nashTable[key]?.[cat];

  // If not in table, it's a fold
  if (!entry) {
    return {
      action: 'fold',
      confidence: 'strong',
      explanation: `${friendlyHandName(key)}太弱，GTO策略建议从${POSITION_NAMES[position]}弃牌。`,
      handTier: '弱牌',
    };
  }

  const action = facingRaise ? entry.vsRaise : entry.open;
  const friendly = friendlyHandName(key);
  const posName = POSITION_NAMES[position];

  // Build explanation
  let explanation: string;
  if (facingRaise) {
    if (action === 'raise') {
      explanation = `${friendly}：面对加注应3-bet。${entry.reason}`;
    } else if (action === 'call') {
      explanation = `${friendly}：面对加注可以跟注。${entry.reason}`;
    } else {
      explanation = `${friendly}：面对加注建议弃牌，${posName}位置牌力不足。`;
    }
  } else {
    if (action === 'raise') {
      explanation = `${friendly}：${entry.reason}`;
    } else {
      explanation = `${friendly}：在${posName}建议弃牌，等待更好的手牌。${entry.reason}`;
    }
  }

  return {
    action,
    confidence: entry.confidence,
    explanation,
    handTier: entry.tier,
  };
}

/**
 * Calculate position for a player given the dealer index in a 5-player game.
 * For 5 players: BTN, SB, BB, UTG, MP
 */
export function calculatePosition(
  playerSeatIndex: number,
  dealerIndex: number,
  allPlayers: { seatIndex: number; isEliminated: boolean }[]
): Position {
  const n = allPlayers.length;

  // Get active (non-eliminated) player seat indices in order
  const activeSeats: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (dealerIndex + i) % n;
    if (!allPlayers[idx].isEliminated) {
      activeSeats.push(idx);
    }
  }

  const posOrder: Position[] = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];

  // Map active seats to positions
  const seatToPos: Map<number, Position> = new Map();
  for (let i = 0; i < activeSeats.length; i++) {
    const posIdx = i % posOrder.length;
    // If fewer than 6 players, we trim positions
    // For exactly 5: BTN, SB, BB, UTG, MP (no CO)
    // For 4: BTN, SB, BB, UTG
    // etc.
    seatToPos.set(activeSeats[i], posOrder[posIdx]);
  }

  return seatToPos.get(playerSeatIndex) ?? 'UTG';
}

export interface PostFlopAdvice {
  action: 'bet' | 'check' | 'call' | 'fold' | 'raise';
  confidence: 'strong' | 'marginal' | 'weak';
  explanation: string;
  handStrength: string;
  boardTexture: string;
}

export function getPostFlopAdvice(
  holeCards: Card[],
  communityCards: Card[],
  position: Position,
  potSize: number,
  currentBet: number,
  playerCurrentBet: number
): PostFlopAdvice {
  if (holeCards.length !== 2 || communityCards.length < 3) {
    return {
      action: 'check',
      confidence: 'weak',
      explanation: '牌不足，无法分析',
      handStrength: '未知',
      boardTexture: '未知',
    };
  }

  const allCards = [...holeCards, ...communityCards];
  const hand = evaluateHand(allCards);
  const toCall = currentBet - playerCurrentBet;

  // Board texture analysis
  const boardTexture = analyzeBoardTexture(communityCards);
  const handStr = hand.name;
  const isStrong = hand.rank >= HandRank.TWO_PAIR;
  const isMedium = hand.rank >= HandRank.ONE_PAIR && hand.rank < HandRank.TWO_PAIR;
  const isWeak = hand.rank < HandRank.ONE_PAIR;

  const potOdds = potSize > 0 && toCall > 0 ? toCall / (potSize + toCall) : 0;
  const isWetBoard = boardTexture.includes('湿润') || boardTexture.includes('极湿');
  const isDryBoard = boardTexture.includes('干燥');

  if (toCall === 0) {
    // We can check for free
    if (hand.rank >= HandRank.THREE_OF_A_KIND) {
      return {
        action: 'bet',
        confidence: 'strong',
        explanation: `${handStr}很强，在${isWetBoard ? '湿润面' : '干燥面'}上应该下注获取价值。建议下注${Math.round(potSize * 0.5)}-${Math.round(potSize * 0.75)}。`,
        handStrength: handStr,
        boardTexture,
      };
    }
    if (hand.rank >= HandRank.ONE_PAIR) {
      if (isWetBoard) {
        return {
          action: 'bet',
          confidence: 'marginal',
          explanation: `${handStr}在湿润面上建议下注保护底池，防止对手免费看牌。`,
          handStrength: handStr,
          boardTexture,
        };
      }
      return {
        action: 'check',
        confidence: 'marginal',
        explanation: `${handStr}在干燥面上可以过牌控池，保持底池小一些。`,
        handStrength: handStr,
        boardTexture,
      };
    }
    // Weak hand, can bluff or check
    const pos = posCategory(position);
    const cardSeed = holeCards.reduce((s, c) => s + c.rank * 17 + (c.suit.charCodeAt(0) || 0), 0) + communityCards.reduce((s, c) => s + c.rank * 31, 0);
    if (pos === 'late' && (cardSeed % 10) < 4) {
      return {
        action: 'bet',
        confidence: 'weak',
        explanation: `没有成牌但在好位置，可以考虑持续下注诈唬。湿润面更适合诈唬。`,
        handStrength: handStr,
        boardTexture,
      };
    }
    return {
      action: 'check',
      confidence: 'strong',
      explanation: `没有成牌，过牌看免费牌。`,
      handStrength: handStr,
      boardTexture,
    };
  }

  // Need to call
  if (hand.rank >= HandRank.THREE_OF_A_KIND) {
    return {
      action: 'raise',
      confidence: 'strong',
      explanation: `${handStr}很强，面对下注应该加注获取最大价值。`,
      handStrength: handStr,
      boardTexture,
    };
  }

  if (hand.rank >= HandRank.ONE_PAIR) {
    if (isWetBoard && toCall > potSize * 0.5) {
      return {
        action: 'fold',
        confidence: 'marginal',
        explanation: `${handStr}在湿润面上面对大额下注，可能已经落后，建议弃牌。`,
        handStrength: handStr,
        boardTexture,
      };
    }
    return {
      action: 'call',
      confidence: 'marginal',
      explanation: `${handStr}面对下注可以跟注，但要注意湿润面上的听牌可能。`,
      handStrength: handStr,
      boardTexture,
    };
  }

  // Weak hand facing bet
  if (toCall <= potSize * 0.3 && potOdds < 0.25) {
    return {
      action: 'call',
      confidence: 'weak',
      explanation: `底池赔率很好(${Math.round(potOdds * 100)}%)，可以用小代价看下一张牌。`,
      handStrength: handStr,
      boardTexture,
    };
  }

  return {
    action: 'fold',
    confidence: 'strong',
    explanation: `没有成牌，面对下注建议弃牌。底池赔率${Math.round(potOdds * 100)}%不够好。`,
    handStrength: handStr,
    boardTexture,
  };
}

function analyzeBoardTexture(communityCards: Card[]): string {
  if (communityCards.length < 3) return '未知';

  const suits = communityCards.map(c => c.suit);
  const ranks = communityCards.map(c => c.rank);

  // Check flush draw potential
  const suitCounts: Record<string, number> = {};
  for (const s of suits) suitCounts[s] = (suitCounts[s] || 0) + 1;
  const maxSuit = Math.max(...Object.values(suitCounts));

  // Check straight draw potential
  const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b);
  let maxGap = 0;
  let connected = 0;
  for (let i = 1; i < sortedRanks.length; i++) {
    const gap = sortedRanks[i] - sortedRanks[i - 1];
    if (gap <= 2) connected++;
    maxGap = Math.max(maxGap, gap);
  }

  // Check paired
  const rankCounts: Record<number, number> = {};
  for (const r of ranks) rankCounts[r] = (rankCounts[r] || 0) + 1;
  const hasPair = Object.values(rankCounts).some(c => c >= 2);

  let texture = '';
  if (maxSuit >= 3) texture += '同花面·';
  else if (maxSuit >= 2) texture += '听花面·';

  if (connected >= 2 && maxGap <= 3) texture += '连牌面·';

  if (!texture) {
    if (hasPair) texture = '对子面·干燥';
    else texture = '干燥面';
  }

  if (texture.endsWith('·')) texture = texture.slice(0, -1);

  if (maxSuit >= 3 || connected >= 2) texture = '极湿·' + texture;

  return texture;
}
