// ===================== Card Types =====================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

// 2–14, where 14 = Ace
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
}

// ===================== Hand Evaluation =====================

export enum HandRank {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

export interface EvaluatedHand {
  rank: HandRank;
  kickers: number[]; // tiebreaker values, descending
  name: string; // Chinese name
}

// ===================== Player =====================

export interface Player {
  id: number;
  name: string;
  chips: number;
  holeCards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  currentBet: number;
  totalBetThisHand: number;
  isHuman: boolean;
  isEliminated: boolean;
  seatIndex: number;
}

// ===================== Game State =====================

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface GameAction {
  type: 'fold' | 'check' | 'call' | 'raise';
  amount?: number;
}

export interface ActionRecord {
  playerId: number;
  action: GameAction;
  phase: GamePhase;
}

export interface GameState {
  players: Player[];
  communityCards: Card[];
  pot: number;
  phase: GamePhase;
  dealerIndex: number;
  currentPlayerIndex: number;
  smallBlind: number;
  bigBlind: number;
  currentBet: number;
  minRaise: number;
  deck: Card[];
  isHandComplete: boolean;
  actionHistory: ActionRecord[];
  // indices of players who have already acted this betting round
  actedThisRound: Set<number>;
  // track last aggressor index for determining action order on new street
  lastAggressorIndex: number;
}

// ===================== Feedback =====================

export interface DecisionFeedback {
  handStrength: string;     // Chinese name of your hand
  potOdds: number;          // e.g. 0.25
  equityEstimate: number;   // e.g. 0.60
  recommendation: string;   // Chinese: "跟注", "弃牌", etc.
  wasCorrect: boolean;
  explanation: string;      // Chinese explanation
}
