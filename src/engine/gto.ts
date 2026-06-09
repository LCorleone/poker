import { Card, Rank } from './types';

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
type PosCategory = 'early' | 'late' | 'blinds';

function posCategory(pos: Position): PosCategory {
  if (pos === 'UTG' || pos === 'MP') return 'early';
  if (pos === 'CO' || pos === 'BTN') return 'late';
  return 'blinds';
}

// ========== GTO Starting Hand Chart ==========
// We define hands that are raise-able and call-able by position category.

// Tier 1 (Premium): Raise from any position
const TIER1_PREMIUM = new Set([
  'AA', 'KK', 'QQ', 'JJ', 'AKs',
]);
const TIER1_NAME = '超强牌';

// Tier 2 (Strong): Raise from any position
const TIER2_STRONG = new Set([
  'TT', 'AQs', 'AJs', 'KQs', 'AKo',
]);
const TIER2_NAME = '强牌';

// Tier 3 (Playable): Raise in late, call in early/blinds
const TIER3_PLAYABLE = new Set([
  '99', '88', 'ATs', 'KJs', 'QJs', 'AQo', 'KTs', 'QTs', 'JTs',
]);
const TIER3_NAME = '中等偏强';

// Tier 4 (Speculative): Call in late/blinds, fold in early
const TIER4_SPECULATIVE = new Set([
  '77', '66', '55', '44', '33', '22',
  'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'T9s', '98s', '87s', '76s', '65s',
  'KTs', 'J9s', 'T8s', '97s', '86s',
  'KJo', 'QJo', 'JTo',
]);
const TIER4_NAME = '投机牌';

// Extra hands playable from late position or blinds
const TIER5_LATE_ONLY = new Set([
  'A9o', 'A8o', 'A7o', 'A6o', 'A5o',
  'KTo', 'QTo', 'JTo', 'T9o',
  'K9s', 'Q9s', 'J8s', 'T7s', '96s',
]);
const TIER5_NAME = '边缘牌';

function classifyHand(key: string): { tier: number; name: string } | null {
  if (TIER1_PREMIUM.has(key)) return { tier: 1, name: TIER1_NAME };
  if (TIER2_STRONG.has(key)) return { tier: 2, name: TIER2_NAME };
  if (TIER3_PLAYABLE.has(key)) return { tier: 3, name: TIER3_NAME };
  if (TIER4_SPECULATIVE.has(key)) return { tier: 4, name: TIER4_NAME };
  if (TIER5_LATE_ONLY.has(key)) return { tier: 5, name: TIER5_NAME };
  return null;
}

// Friendly hand name for display
function friendlyHandName(key: string): string {
  if (key.length === 2) return key; // pair like "AA"
  const base = key.slice(0, 2);
  const suffix = key[2] === 's' ? '同花' : '杂色';
  return base + suffix;
}

export function getGTOAdvice(holeCards: Card[], position: Position): GTOAdvice {
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
  const classification = classifyHand(key);

  // Unrecognized hand = fold
  if (!classification) {
    return {
      action: 'fold',
      confidence: 'strong',
      explanation: `${friendlyHandName(key)}太弱，GTO策略建议从${POSITION_NAMES[position]}弃牌。`,
      handTier: '弱牌',
    };
  }

  const { tier, name } = classification;
  const friendly = friendlyHandName(key);

  // Tier 1 & 2: Raise from anywhere with strong confidence
  if (tier <= 2) {
    return {
      action: 'raise',
      confidence: 'strong',
      explanation: `${friendly}是${name}，任何位置都应加注。${tier === 1 ? '这是翻牌前最优质的手牌之一。' : '这手牌有很强的胜率，值得加注构建底池。'}`,
      handTier: name,
    };
  }

  // Tier 3: Playable
  if (tier === 3) {
    if (cat === 'late') {
      return {
        action: 'raise',
        confidence: 'strong',
        explanation: `${friendly}是${name}，在${POSITION_NAMES[position]}有位置优势，建议加注。`,
        handTier: name,
      };
    }
    if (cat === 'blinds') {
      return {
        action: 'call',
        confidence: 'marginal',
        explanation: `${friendly}是${name}，在盲位可以跟注看翻牌，但要小心没有位置优势。`,
        handTier: name,
      };
    }
    // early
    return {
      action: 'call',
      confidence: 'marginal',
      explanation: `${friendly}是${name}，在${POSITION_NAMES[position]}位置偏早，建议跟注入池，避免被3-bet。`,
      handTier: name,
    };
  }

  // Tier 4: Speculative
  if (tier === 4) {
    if (cat === 'early') {
      return {
        action: 'fold',
        confidence: 'marginal',
        explanation: `${friendly}是${name}，在${POSITION_NAMES[position]}位置不利，建议弃牌。等待更好的位置再玩这类牌。`,
        handTier: name,
      };
    }
    if (cat === 'late') {
      return {
        action: 'call',
        confidence: 'marginal',
        explanation: `${friendly}是${name}，在${POSITION_NAMES[position]}有位置优势，可以跟注看翻牌，寻找成牌机会。`,
        handTier: name,
      };
    }
    // blinds
    return {
      action: 'call',
      confidence: 'marginal',
      explanation: `${friendly}是${name}，在盲位可以便宜跟注，利用隐含赔率。`,
      handTier: name,
    };
  }

  // Tier 5: Late-only hands
  if (tier === 5) {
    if (cat === 'late') {
      return {
        action: 'call',
        confidence: 'weak',
        explanation: `${friendly}是${name}，只有在${POSITION_NAMES[position]}这样的好位置才能考虑跟注。`,
        handTier: name,
      };
    }
    if (cat === 'blinds') {
      return {
        action: 'call',
        confidence: 'weak',
        explanation: `${friendly}是${name}，在盲位可以便宜看翻牌，但要小心翻牌后没有位置。`,
        handTier: name,
      };
    }
    // early - fold
    return {
      action: 'fold',
      confidence: 'strong',
      explanation: `${friendly}是${name}，在${POSITION_NAMES[position]}建议弃牌，太弱且没有位置优势。`,
      handTier: name,
    };
  }

  // Fallback (should not reach)
  return {
    action: 'fold',
    confidence: 'strong',
    explanation: `${friendly}建议弃牌。`,
    handTier: '弱牌',
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
