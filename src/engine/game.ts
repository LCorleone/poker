import {
  GameState,
  GamePhase,
  GameAction,
  Player,
  Card,
  EvaluatedHand,
  DecisionFeedback,
  AIPersona,
} from './types';
import { createDeck, shuffleDeck, dealCards } from './deck';
import { evaluateHand, compareHands, getHandStrength, estimateEquity } from './evaluate';
import { selectRandomPros } from './pros';

const STARTING_CHIPS = 5000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

const BLIND_SCHEDULE = [
  { small: 10, big: 20 },
  { small: 15, big: 30 },
  { small: 25, big: 50 },
  { small: 50, big: 100 },
  { small: 75, big: 150 },
  { small: 100, big: 200 },
  { small: 150, big: 300 },
  { small: 200, big: 400 },
  { small: 300, big: 600 },
  { small: 500, big: 1000 },
];

const HANDS_PER_LEVEL = 10;

function makePlayer(id: number, name: string, isHuman: boolean, seatIndex: number): Player {
  return {
    id,
    name,
    chips: STARTING_CHIPS,
    holeCards: [],
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    totalBetThisHand: 0,
    isHuman,
    isEliminated: false,
    seatIndex,
  };
}

export function createGameState(): GameState {
  // Randomly select 4 poker pros from the pool
  const pros = selectRandomPros(4);
  const players = [
    makePlayer(0, 'July', true, 0),
    ...pros.map((pro, i) => {
      const p = makePlayer(i + 1, pro.name, false, i + 1);
      p.proInfo = pro;
      return p;
    }),
  ];

  return {
    players,
    communityCards: [],
    pot: 0,
    phase: 'waiting',
    dealerIndex: 0,
    currentPlayerIndex: -1,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    currentBet: 0,
    minRaise: BIG_BLIND,
    deck: [],
    isHandComplete: false,
    actionHistory: [],
    actedThisRound: new Set(),
    lastAggressorIndex: -1,
    handNumber: 0,
    blindLevel: 0,
    handsPerLevel: HANDS_PER_LEVEL,
  };
}

// ===================== Competition Mode (AI vs AI, no human) =====================

export interface CompetitionConfig {
  startingChips: number;
  handsPerLevel: number;
}

/**
 * Create a game state for an AI-only competition.
 * - No human player (all isHuman: false)
 * - Players named after the supplied names, seated in order (seatIndex = index)
 * - Player at index i maps 1:1 to competitors[i] (stable even after elimination,
 *   since eliminated players stay in the array)
 * - Configurable starting chips and hands-per-blind-level
 * Returns a 'waiting' state; the caller invokes startNewHand() to begin.
 */
export function createCompetitionGameState(
  competitorNames: string[],
  config: CompetitionConfig,
): GameState {
  const players: Player[] = competitorNames.map((name, i) => ({
    id: i,
    name,
    chips: config.startingChips,
    holeCards: [],
    isFolded: false,
    isAllIn: false,
    currentBet: 0,
    totalBetThisHand: 0,
    isHuman: false,
    isEliminated: false,
    seatIndex: i,
  }));

  return {
    players,
    communityCards: [],
    pot: 0,
    phase: 'waiting',
    dealerIndex: 0,
    currentPlayerIndex: -1,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    currentBet: 0,
    minRaise: BIG_BLIND,
    deck: [],
    isHandComplete: false,
    actionHistory: [],
    actedThisRound: new Set(),
    lastAggressorIndex: -1,
    handNumber: 0,
    blindLevel: 0,
    handsPerLevel: config.handsPerLevel,
  };
}

// Get active (non-folded, non-eliminated) players
function activePlayers(state: GameState): Player[] {
  return state.players.filter(p => !p.isFolded && !p.isEliminated);
}

// Get players still in the hand (not folded, not eliminated, may be all-in)
function handPlayers(state: GameState): Player[] {
  return state.players.filter(p => !p.isFolded && !p.isEliminated);
}

// Can a player still act (not folded, not all-in, not eliminated, has chips)?
function canAct(p: Player): boolean {
  return !p.isFolded && !p.isAllIn && !p.isEliminated && p.chips > 0;
}

// Find next player index who can act
export function findNextCanAct(state: GameState, fromIndex: number): number {
  const n = state.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    const p = state.players[idx];
    if (!p.isEliminated && !p.isFolded && !p.isAllIn) {
      return idx;
    }
  }
  return -1; // no one can act
}

function isBettingRoundComplete(state: GameState): boolean {
  const canActPlayers = state.players.filter(p => canAct(p));
  if (canActPlayers.length === 0) return true;
  if (canActPlayers.length === 1 && canActPlayers[0].currentBet >= state.currentBet) {
    // Only one person can act and they've matched the bet
    // They may still want to check, but if they've already acted...
    if (state.actedThisRound.has(canActPlayers[0].id)) return true;
  }
  // All who can act have acted and matched current bet
  for (const p of canActPlayers) {
    if (!state.actedThisRound.has(p.id)) return false;
    if (p.currentBet < state.currentBet) return false;
  }
  return true;
}

export function startNewHand(state: GameState): GameState {
  let s = structuredClone(state) as GameState;

  // Reset hand-specific state
  s.communityCards = [];
  s.pot = 0;
  s.phase = 'preflop';
  s.isHandComplete = false;
  s.actionHistory = [];
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.actedThisRound = new Set();
  s.lastAggressorIndex = -1;

  // Advance blind level
  s.handNumber = state.handNumber + 1;
  const newLevel = Math.min(Math.floor((s.handNumber - 1) / s.handsPerLevel), BLIND_SCHEDULE.length - 1);
  s.blindLevel = newLevel;
  s.smallBlind = BLIND_SCHEDULE[newLevel].small;
  s.bigBlind = BLIND_SCHEDULE[newLevel].big;

  // Move dealer to next non-eliminated player
  const n = s.players.length;
  let nextDealer = s.dealerIndex;
  do {
    nextDealer = (nextDealer + 1) % n;
  } while (s.players[nextDealer].isEliminated);
  s.dealerIndex = nextDealer;

  // Reset players
  for (const p of s.players) {
    p.holeCards = [];
    p.isFolded = p.isEliminated;
    p.isAllIn = false;
    p.currentBet = 0;
    p.totalBetThisHand = 0;
  }

  // Shuffle & deal
  s.deck = shuffleDeck(createDeck());

  // Count active (non-eliminated) players for heads-up rule
  const activeCount = s.players.filter(p => !p.isEliminated).length;
  let sbIndex: number;
  let bbIndex: number;
  if (activeCount === 2) {
    // Heads-up: dealer is SB
    sbIndex = s.dealerIndex;
    bbIndex = findNextCanAct(s, s.dealerIndex);
  } else {
    sbIndex = findNextCanAct(s, s.dealerIndex);
    bbIndex = findNextCanAct(s, sbIndex);
  }

  const sbPlayer = s.players[sbIndex];
  const bbPlayer = s.players[bbIndex];

  const sbAmount = Math.min(s.smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalBetThisHand = sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

  const bbAmount = Math.min(s.bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalBetThisHand = bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;

  s.pot = sbAmount + bbAmount;
  s.currentBet = bbAmount;
  s.minRaise = s.bigBlind;

  // Deal hole cards
  for (const p of s.players) {
    if (!p.isEliminated) {
      const [cards, remaining] = dealCards(s.deck, 2);
      p.holeCards = cards;
      s.deck = remaining;
    }
  }

  // First to act preflop: left of big blind
  s.currentPlayerIndex = findNextCanAct(s, bbIndex);

  return s;
}

export function performAction(state: GameState, action: GameAction): GameState {
  const s = structuredClone(state) as GameState;
  const player = s.players[s.currentPlayerIndex];

  // Record action
  s.actionHistory.push({
    playerId: player.id,
    action,
    phase: s.phase,
  });

  switch (action.type) {
    case 'fold':
      player.isFolded = true;
      break;

    case 'check':
      // No chip movement
      break;

    case 'call': {
      const toCall = Math.min(s.currentBet - player.currentBet, player.chips);
      player.chips -= toCall;
      player.currentBet += toCall;
      player.totalBetThisHand += toCall;
      s.pot += toCall;
      if (player.chips === 0) player.isAllIn = true;
      break;
    }

    case 'raise': {
      const raiseTotal = action.amount ?? 0;
      // Invalid raise: not exceeding current bet, or can't afford it
      if (raiseTotal <= s.currentBet || raiseTotal > player.currentBet + player.chips) {
        // Fallback to call or check
        const toCall = Math.min(s.currentBet - player.currentBet, player.chips);
        player.chips -= toCall;
        player.currentBet += toCall;
        player.totalBetThisHand += toCall;
        s.pot += toCall;
        if (player.chips === 0) player.isAllIn = true;
        break;
      }
      const toAdd = raiseTotal - player.currentBet;
      const actualAdd = Math.min(toAdd, player.chips);
      player.chips -= actualAdd;
      player.currentBet += actualAdd;
      player.totalBetThisHand += actualAdd;
      s.pot += actualAdd;

      // Only a full raise (>= min raise) updates minRaise; a short all-in does not
      if (raiseTotal - s.currentBet >= s.minRaise) {
        s.minRaise = raiseTotal - s.currentBet;
      }
      s.currentBet = player.currentBet;
      s.lastAggressorIndex = s.currentPlayerIndex;

      // Reset actedThisRound: everyone else needs to act again
      s.actedThisRound = new Set();
      s.actedThisRound.add(player.id);

      if (player.chips === 0) player.isAllIn = true;
      break;
    }
  }

  if (action.type !== 'raise') {
    s.actedThisRound.add(player.id);
  }

  // Check if hand is over (only one active player)
  const active = activePlayers(s);
  if (active.length <= 1) {
    s.isHandComplete = true;
    s.phase = 'showdown';
    return s;
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(s)) {
    return advancePhase(s);
  }

  // Move to next player who can act
  s.currentPlayerIndex = findNextCanAct(s, s.currentPlayerIndex);

  return s;
}

export function advancePhase(state: GameState): GameState {
  const s = structuredClone(state) as GameState;

  // Reset bets for new round
  for (const p of s.players) {
    p.currentBet = 0;
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  s.actedThisRound = new Set();
  s.lastAggressorIndex = -1;

  const active = activePlayers(s);
  const canActPs = s.players.filter(p => canAct(p));

  switch (s.phase) {
    case 'preflop':
      s.phase = 'flop';
      const [flop, deck1] = dealCards(s.deck, 3);
      s.communityCards = [...s.communityCards, ...flop];
      s.deck = deck1;
      break;

    case 'flop':
      s.phase = 'turn';
      const [turn, deck2] = dealCards(s.deck, 1);
      s.communityCards = [...s.communityCards, ...turn];
      s.deck = deck2;
      break;

    case 'turn':
      s.phase = 'river';
      const [river, deck3] = dealCards(s.deck, 1);
      s.communityCards = [...s.communityCards, ...river];
      s.deck = deck3;
      break;

    case 'river':
      s.phase = 'showdown';
      s.isHandComplete = true;
      return s;
  }

  // If only one person can act (or zero), skip to next phase
  if (canActPs.length <= 1) {
    // Check if we need more cards or can go to showdown
    if (s.phase !== 'showdown') {
      // If all remaining players are all-in, run out the board
      if (canActPs.length === 0) {
        return advancePhase(s);
      }
      // Only one can act, they've won by default or it's a check situation
      if (canActPs.length === 1 && canActPs[0].currentBet === 0) {
        // This person can check, but it's trivially done
        s.actedThisRound.add(canActPs[0].id);
        if (isBettingRoundComplete(s)) {
          return advancePhase(s);
        }
      }
    }
  }

  // First to act post-flop: first active player left of dealer
  const firstToAct = findNextCanAct(s, s.dealerIndex);
  if (firstToAct === -1) {
    // No one can act, auto-advance
    return advancePhase(s);
  }
  s.currentPlayerIndex = firstToAct;

  return s;
}

export interface HandResult {
  winners: { playerId: number; amount: number; hand: EvaluatedHand }[];
  eliminatedPlayerIds: number[];
}

export function getWinners(state: GameState): { result: HandResult; updatedPlayers: Player[] } {
  // Clone players to avoid mutating original state
  const updatedPlayers = state.players.map(p => ({ ...p }));
  const active = updatedPlayers.filter(p => !p.isFolded && !p.isEliminated);

  if (active.length === 1) {
    const winner = active[0];
    winner.chips += state.pot;
    const eliminated = checkEliminationsOn(updatedPlayers);
    return {
      result: {
        winners: [{ playerId: winner.id, amount: state.pot, hand: state.communityCards.length >= 3
          ? evaluateHand([...winner.holeCards, ...state.communityCards])
          : { rank: 0, kickers: [], name: '对手弃牌' } }],
        eliminatedPlayerIds: eliminated,
      },
      updatedPlayers,
    };
  }

  // Side pot calculation
  // 1. Collect all-in amounts from active players
  const uniqueBets = [...new Set(active.map(p => p.totalBetThisHand).sort((a, b) => a - b))];

  interface PotLevel {
    amount: number;  // total pot at this level
    eligible: Player[];  // players eligible for this pot
  }
  const pots: PotLevel[] = [];

  let prevBet = 0;
  for (const betLevel of uniqueBets) {
    let potAtThisLevel = 0;
    for (const p of updatedPlayers) {
      if (p.isEliminated && !p.totalBetThisHand) continue;
      const contrib = Math.min(p.totalBetThisHand, betLevel) - Math.min(p.totalBetThisHand, prevBet);
      potAtThisLevel += contrib;
    }
    if (potAtThisLevel > 0) {
      const eligible = active.filter(p => p.totalBetThisHand >= betLevel);
      pots.push({ amount: potAtThisLevel, eligible });
    }
    prevBet = betLevel;
  }

  const allWinners: HandResult['winners'] = [];

  for (const pot of pots) {
    const evaluations = pot.eligible.map(p => ({
      player: p,
      hand: evaluateHand([...p.holeCards, ...state.communityCards]),
    }));
    evaluations.sort((a, b) => compareHands(b.hand, a.hand));

    const best = evaluations[0].hand;
    const winners = evaluations.filter(e => compareHands(e.hand, best) === 0);

    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;

    for (let i = 0; i < winners.length; i++) {
      const existing = allWinners.find(w => w.playerId === winners[i].player.id);
      const amount = share + (i === 0 ? remainder : 0);
      if (existing) {
        existing.amount += amount;
      } else {
        allWinners.push({
          playerId: winners[i].player.id,
          amount,
          hand: winners[i].hand,
        });
      }
    }
  }

  // Distribute chips
  for (const r of allWinners) {
    const p = updatedPlayers.find(pl => pl.id === r.playerId)!;
    p.chips += r.amount;
  }

  const eliminated = checkEliminationsOn(updatedPlayers);
  return { result: { winners: allWinners, eliminatedPlayerIds: eliminated }, updatedPlayers };
}

function checkEliminationsOn(players: Player[]): number[] {
  const eliminated: number[] = [];
  for (const p of players) {
    if (p.chips <= 0 && !p.isEliminated) {
      p.isEliminated = true;
      eliminated.push(p.id);
    }
  }
  return eliminated;
}

export function getAvailableActions(state: GameState): GameAction[] {
  const player = state.players[state.currentPlayerIndex];
  if (!player || player.isFolded || player.isAllIn || player.isEliminated) return [];

  const actions: GameAction[] = [];
  const toCall = state.currentBet - player.currentBet;

  if (toCall === 0) {
    actions.push({ type: 'check' });
  } else {
    actions.push({ type: 'fold' });
    actions.push({ type: 'call' });
  }

  // Can raise if they have chips beyond the call amount
  const minRaiseTotal = state.currentBet + state.minRaise;
  if (player.chips > toCall) {
    const allInTotal = player.currentBet + player.chips;
    if (minRaiseTotal <= player.chips + player.currentBet) {
      actions.push({ type: 'raise', amount: minRaiseTotal });
    } else {
      // Short stack: can't make a full min-raise, but can shove all-in
      actions.push({ type: 'raise', amount: allInTotal });
    }
  }

  return actions;
}

export function getRaiseRange(state: GameState): { min: number; max: number } {
  const player = state.players[state.currentPlayerIndex];
  const min = Math.max(state.currentBet + state.minRaise, state.currentBet + 1);
  const max = player.currentBet + player.chips; // all-in amount as total bet
  if (min > max) return { min: max, max };
  return { min, max };
}

export function getBlindInfo(state: GameState): { level: number; small: number; big: number; handsUntilNext: number; totalLevels: number } {
  const level = state.blindLevel;
  const schedule = BLIND_SCHEDULE[level];
  const handsInLevel = state.handNumber % state.handsPerLevel;
  const isMaxLevel = level >= BLIND_SCHEDULE.length - 1;
  return {
    level: level + 1,
    small: schedule.small,
    big: schedule.big,
    handsUntilNext: isMaxLevel ? 0 : state.handsPerLevel - handsInLevel,
    totalLevels: BLIND_SCHEDULE.length,
  };
}

// Generate feedback for the human player's last action
export function generateFeedback(
  state: GameState,
  humanAction: GameAction,
  phase: GamePhase
): DecisionFeedback | null {
  const human = state.players.find(p => p.isHuman);
  if (!human || human.holeCards.length === 0) return null;

  const allCards = [...human.holeCards, ...state.communityCards];
  const handStrength = getHandStrength(human.holeCards, state.communityCards);

  const toCall = state.currentBet - human.currentBet;
  const potOdds = state.pot > 0 ? toCall / (state.pot + toCall) : 0;

  const opponentsActive = handPlayers(state).filter(p => !p.isHuman).length;
  const equity = estimateEquity(human.holeCards, state.communityCards, opponentsActive, 150);

  let recommendation: string;
  let wasCorrect: boolean;
  let explanation: string;

  if (toCall === 0) {
    // Can check for free
    if (equity > 0.65) {
      recommendation = '加注';
      wasCorrect = humanAction.type === 'raise';
      explanation = `你的赢率约${Math.round(equity * 100)}%，手牌较强，建议加注获取更多价值。`;
    } else {
      recommendation = '过牌';
      wasCorrect = humanAction.type === 'check';
      explanation = `你的赢率约${Math.round(equity * 100)}%，建议过牌看免费牌。`;
    }
  } else {
    if (equity > potOdds) {
      recommendation = '跟注或加注';
      wasCorrect = humanAction.type !== 'fold';
      explanation = `你的赢率(${Math.round(equity * 100)}%)高于底池赔率(${Math.round(potOdds * 100)}%)，跟注是正期望值的决定。`;
    } else if (equity > potOdds - 0.08) {
      recommendation = '可以跟注';
      wasCorrect = humanAction.type !== 'fold';
      explanation = `你的赢率(${Math.round(equity * 100)}%)接近底池赔率(${Math.round(potOdds * 100)}%)，跟注是边缘决定。`;
    } else {
      recommendation = '弃牌';
      wasCorrect = humanAction.type === 'fold';
      explanation = `你的赢率(${Math.round(equity * 100)}%)远低于底池赔率(${Math.round(potOdds * 100)}%)，建议弃牌。`;
    }
  }

  return {
    handStrength,
    potOdds,
    equityEstimate: equity,
    recommendation,
    wasCorrect,
    explanation,
  };
}
