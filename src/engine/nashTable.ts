/**
 * Nash Equilibrium Preflop Ranges for 5-max (50BB deep, 10/20 blinds)
 *
 * Based on standard GTO opening ranges. Three position categories:
 * - early: UTG, MP
 * - late: CO, BTN
 * - blinds: SB, BB
 *
 * Each entry gives: open action, vs-raise action, confidence, and reason.
 */

export type PosCategory = 'early' | 'late' | 'blinds';
export type PreflopAction = 'raise' | 'call' | 'fold';
export type Confidence = 'strong' | 'marginal' | 'weak';

export interface PreflopEntry {
  open: PreflopAction;
  vsRaise: PreflopAction;
  confidence: Confidence;
  reason: string;
  tier: string;
}

// ============ Hand sets by position ============

// --- EARLY POSITION (UTG/MP) — Open ~15% ---
const EARLY_OPEN_RAISE = new Set([
  // Pairs
  'AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22',
  // Suited
  'AKs','AQs','AJs','ATs','A5s','KQs','KJs','QJs','JTs','T9s',
  // Offsuit
  'AKo','AQo',
]);

const EARLY_3BET = new Set([
  'AA','KK','QQ','JJ','AKs','AKo',
]);

const EARLY_CALL_VS_RAISE = new Set([
  'TT','99','88','AQs','AJs','KQs',
]);

// --- LATE POSITION (CO/BTN) — Open ~28% ---
const LATE_OPEN_RAISE = new Set([
  // Pairs
  'AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22',
  // Suited
  'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
  'KQs','KJs','KTs','K9s',
  'QJs','QTs','Q9s',
  'JTs','J9s',
  'T9s','98s','87s','76s','65s',
  // Offsuit
  'AKo','AQo','AJo','ATo',
  'KQo','KJo',
  'QJo',
]);

const LATE_3BET = new Set([
  'AA','KK','QQ','JJ','TT','AKs','AKo','AQs',
]);

const LATE_CALL_VS_RAISE = new Set([
  '99','88','77','66','55','44','33','22',
  'AJs','ATs','A9s','A5s',
  'KQs','KJs','QJs','JTs','T9s','98s',
  'ATo','KQo',
]);

// --- BLINDS (SB/BB) — Open/Defend ~35% ---
// SB open (first to act)
const BLINDS_OPEN_RAISE = new Set([
  // Pairs
  'AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22',
  // Suited
  'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
  'KQs','KJs','KTs','K9s',
  'QJs','JTs','T9s','98s',
  // Offsuit
  'AKo','AQo','AJo','ATo',
  'KQo','KJo',
]);

const BLINDS_3BET = new Set([
  'AA','KK','QQ','AKs','AKo',
]);

const BLINDS_CALL_VS_RAISE = new Set([
  'JJ','TT','99','88','77','66','55','44','33','22',
  'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
  'KQs','KJs','KTs','K9s',
  'QJs','QTs','Q9s',
  'JTs','J9s',
  'T9s','T8s',
  '98s','97s',
  '87s','86s',
  '76s','75s',
  '65s','64s',
  '54s',
  'AKo','AQo','AJo','ATo',
  'KQo','QJo',
]);

// ============ Tier classification for display ============

const TIER_PREMIUM = new Set([
  'AA','KK','QQ','JJ','AKs',
]);

const TIER_STRONG = new Set([
  'TT','AQs','AJs','KQs','AKo',
]);

const TIER_MEDIUM = new Set([
  '99','88','ATs','KJs','QJs','AQo','KTs','QTs','JTs',
  'AJo','KQo',
]);

const TIER_SPECULATIVE = new Set([
  '77','66','55','44','33','22',
  'A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
  'T9s','98s','87s','76s','65s',
  'J9s','T8s','97s','86s','75s','64s','54s',
  'KJo','QJo',
]);

const TIER_MARGINAL = new Set([
  'A9o','A8o','A7o','A6o','A5o',
  'KTo','QTo','JTo','T9o',
  'K9s','Q9s','J8s','T7s','96s',
  'ATo',
]);

function classifyTier(key: string): string {
  if (TIER_PREMIUM.has(key)) return '超强牌';
  if (TIER_STRONG.has(key)) return '强牌';
  if (TIER_MEDIUM.has(key)) return '中等偏强';
  if (TIER_SPECULATIVE.has(key)) return '投机牌';
  if (TIER_MARGINAL.has(key)) return '边缘牌';
  return '弱牌';
}

// ============ Reason templates ============

function getReason(key: string, tier: string, open: PreflopAction, vsRaise: PreflopAction): string {
  const isPair = key.length === 2;
  const isSuited = key.endsWith('s');

  if (tier === '超强牌') {
    if (key === 'AA') return '翻牌前最强牌，任何位置都应加注/3-bet。';
    if (key === 'KK') return '翻牌前第二强牌，任何位置都应加注/3-bet。';
    if (key === 'QQ') return '超强口袋对，任何位置都应加注/3-bet。';
    if (key === 'JJ') return '强口袋对，有位置时积极加注，面对3-bet可跟注。';
    return '最强非对起手牌，任何位置都应加注。';
  }

  if (tier === '强牌') {
    if (isPair) return '强口袋对，翻牌前可以加注构建底池，寻找三条机会。';
    if (key === 'AKo') return '最强杂色牌，翻牌前应积极加注。';
    return '强同花牌，翻牌前应加注，有位置优势时更积极。';
  }

  if (tier === '中等偏强') {
    if (isPair) return '中等口袋对，有位置时可以加注，早期位跟注。';
    if (isSuited) return '中等同花牌，有位置时加注，无位置时谨慎。';
    return '中等偏强牌，位置好时可以加注入池。';
  }

  if (tier === '投机牌') {
    if (isPair) return '小口袋对，翻牌后主要寻找三条，利用隐含赔率。';
    if (isSuited && key[0] === 'A') return '同花A，可以便宜看翻牌，寻找同花或A高牌面。';
    if (isSuited) return '同花连牌，有位置时可以投机，寻找同花或顺子机会。';
    return '投机牌，需要位置和隐含赔率支撑。';
  }

  if (tier === '边缘牌') {
    if (isSuited) return '边缘同花牌，只有好位置时才考虑。';
    return '边缘牌，只有好位置时勉强可以玩。';
  }

  // 弱牌
  return '弱牌，GTO策略建议弃牌。';
}

// ============ Build the table ============

// All 13 rank characters for matrix generation
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];

function getOpenAction(key: string, cat: PosCategory): PreflopAction {
  const set = cat === 'early' ? EARLY_OPEN_RAISE : cat === 'late' ? LATE_OPEN_RAISE : BLINDS_OPEN_RAISE;
  return set.has(key) ? 'raise' : 'fold';
}

function getVsRaiseAction(key: string, cat: PosCategory): PreflopAction {
  const threeBet = cat === 'early' ? EARLY_3BET : cat === 'late' ? LATE_3BET : BLINDS_3BET;
  const call = cat === 'early' ? EARLY_CALL_VS_RAISE : cat === 'late' ? LATE_CALL_VS_RAISE : BLINDS_CALL_VS_RAISE;
  if (threeBet.has(key)) return 'raise';
  if (call.has(key)) return 'call';
  return 'fold';
}

function getConfidence(tier: string, action: PreflopAction): Confidence {
  if (action === 'fold') return 'strong';
  if (tier === '超强牌' || tier === '强牌') return 'strong';
  if (tier === '中等偏强' || tier === '投机牌') return 'marginal';
  return 'weak';
}

export type NashTable = Record<string, Record<PosCategory, PreflopEntry>>;

function buildNashTable(): NashTable {
  const table: NashTable = {};

  // Generate all 169 hand combos
  for (let i = 0; i < RANKS.length; i++) {
    // Pair
    const pairKey = RANKS[i] + RANKS[i];
    addEntry(table, pairKey);

    for (let j = i + 1; j < RANKS.length; j++) {
      // Non-pair: RANKS[i] > RANKS[j] in card rank
      addEntry(table, RANKS[i] + RANKS[j] + 's');
      addEntry(table, RANKS[i] + RANKS[j] + 'o');
    }
  }

  return table;
}

function addEntry(table: NashTable, key: string): void {
  const tier = classifyTier(key);
  table[key] = {
    early: buildEntry(key, tier, 'early'),
    late: buildEntry(key, tier, 'late'),
    blinds: buildEntry(key, tier, 'blinds'),
  };
}

function buildEntry(key: string, tier: string, cat: PosCategory): PreflopEntry {
  const open = getOpenAction(key, cat);
  const vsRaise = getVsRaiseAction(key, cat);
  const confidence = getConfidence(tier, open);
  const reason = getReason(key, tier, open, vsRaise);
  return { open, vsRaise, confidence, reason, tier };
}

export const nashTable: NashTable = buildNashTable();
