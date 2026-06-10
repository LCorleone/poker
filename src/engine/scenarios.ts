import { Card } from './types';

export interface QuizScenario {
  id: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  holeCards: Card[];
  communityCards: Card[];
  position: string;
  potSize: number;
  currentBet: number;
  playerCurrentBet: number;
  options: QuizOption[];
  correctAction: string;
  explanation: string;
}

export interface QuizOption {
  label: string;
  action: 'fold' | 'check' | 'call' | 'raise';
}

export const QUIZ_SCENARIOS: QuizScenario[] = [
  // === Preflop Basics ===
  {
    id: 1,
    category: '翻牌前基础',
    difficulty: 'easy',
    description: '你在枪口位(UTG)拿到AA，前面没人行动，你该怎么做？',
    holeCards: [
      { suit: 'spades', rank: 14 },
      { suit: 'hearts', rank: 14 },
    ],
    communityCards: [],
    position: 'UTG',
    potSize: 30,
    currentBet: 20,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'raise',
    explanation: 'AA是翻牌前最强的手牌，从任何位置都应该加注。在UTG位置加注可以构建底池并隔离对手。',
  },
  {
    id: 2,
    category: '翻牌前基础',
    difficulty: 'easy',
    description: '你在庄位(BTN)拿到7♠2♥，前面所有人都弃牌了，你该怎么做？',
    holeCards: [
      { suit: 'spades', rank: 7 },
      { suit: 'hearts', rank: 2 },
    ],
    communityCards: [],
    position: 'BTN',
    potSize: 30,
    currentBet: 20,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'fold',
    explanation: '72杂色是德州扑克中最差的手牌之一。即使在庄位也不值得玩，果断弃牌。',
  },
  {
    id: 3,
    category: '翻牌前基础',
    difficulty: 'medium',
    description: '你在关煞位(CO)拿到A♥K♠，前面有玩家加注到60，你该怎么做？',
    holeCards: [
      { suit: 'hearts', rank: 14 },
      { suit: 'spades', rank: 13 },
    ],
    communityCards: [],
    position: 'CO',
    potSize: 90,
    currentBet: 60,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'raise',
    explanation: 'AK杂色是翻牌前第三强的非对子手牌。在CO位置面对一个加注，3-bet（加注）是标准打法，既能获取价值又能建立主导地位。',
  },
  // === Post-flop: Value Betting ===
  {
    id: 4,
    category: '翻牌后·价值下注',
    difficulty: 'easy',
    description: '翻牌: K♠ 7♦ 2♣，你手持K♥ Q♦有一对K(顶对)。底池100，没人下注。你该怎么做？',
    holeCards: [
      { suit: 'hearts', rank: 13 },
      { suit: 'diamonds', rank: 12 },
    ],
    communityCards: [
      { suit: 'spades', rank: 13 },
      { suit: 'diamonds', rank: 7 },
      { suit: 'clubs', rank: 2 },
    ],
    position: 'BTN',
    potSize: 100,
    currentBet: 0,
    playerCurrentBet: 0,
    options: [
      { label: '过牌', action: 'check' },
      { label: '下注', action: 'raise' },
    ],
    correctAction: 'raise',
    explanation: '干燥面上有顶对+好踢脚，应该下注获取价值。下注1/2到2/3底池是合适的。',
  },
  {
    id: 5,
    category: '翻牌后·价值下注',
    difficulty: 'medium',
    description: '翻牌: A♥ T♥ 5♦，你手持A♣ K♣有顶对最大踢脚。对手下注50，底池100。你该怎么做？',
    holeCards: [
      { suit: 'clubs', rank: 14 },
      { suit: 'clubs', rank: 13 },
    ],
    communityCards: [
      { suit: 'hearts', rank: 14 },
      { suit: 'hearts', rank: 10 },
      { suit: 'diamonds', rank: 5 },
    ],
    position: 'CO',
    potSize: 100,
    currentBet: 50,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'raise',
    explanation: 'AK在A高翻牌面有绝对优势（顶对+最大踢脚）。但要注意同花听牌，加注既能获取价值又能保护底池。',
  },
  // === Post-flop: Pot Odds ===
  {
    id: 6,
    category: '底池赔率',
    difficulty: 'medium',
    description: '翻牌: Q♠ J♠ 5♥，你手持T♠ 9♠有同花听牌+顺子听牌。底池200，对手下注100。你需要跟注100。你该怎么做？',
    holeCards: [
      { suit: 'spades', rank: 10 },
      { suit: 'spades', rank: 9 },
    ],
    communityCards: [
      { suit: 'spades', rank: 12 },
      { suit: 'spades', rank: 11 },
      { suit: 'hearts', rank: 5 },
    ],
    position: 'BTN',
    potSize: 200,
    currentBet: 100,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'call',
    explanation: '你有9张黑桃成同花+8张成顺子的出牌（排除重叠约15张出牌）。底池赔率=100/400=25%，而你的赢率约60%（15出牌×4规则=60%）。这是一个非常有利可图的跟注。',
  },
  {
    id: 7,
    category: '底池赔率',
    difficulty: 'hard',
    description: '转牌: A♠ K♦ 7♥ 3♣，你手持J♥ T♥什么都没中。底池300，对手下注250。你该怎么做？',
    holeCards: [
      { suit: 'hearts', rank: 11 },
      { suit: 'hearts', rank: 10 },
    ],
    communityCards: [
      { suit: 'spades', rank: 14 },
      { suit: 'diamonds', rank: 13 },
      { suit: 'hearts', rank: 7 },
      { suit: 'clubs', rank: 3 },
    ],
    position: 'BB',
    potSize: 300,
    currentBet: 250,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注诈唬', action: 'raise' },
    ],
    correctAction: 'fold',
    explanation: '你什么都没中，面对2/3底池的下注，底池赔率=250/800≈31%。你需要一张Q成顺子(4张出牌≈8%赢率)，远远不够。弃牌是唯一正确的选择。',
  },
  // === Bluffing ===
  {
    id: 8,
    category: '诈唬技巧',
    difficulty: 'hard',
    description: '河牌: K♠ Q♦ 7♣ 4♥ 2♠，你手持J♥ T♥没中任何牌。你一直在下注，对手一路跟注。底池400，你该怎么做？',
    holeCards: [
      { suit: 'hearts', rank: 11 },
      { suit: 'hearts', rank: 10 },
    ],
    communityCards: [
      { suit: 'spades', rank: 13 },
      { suit: 'diamonds', rank: 12 },
      { suit: 'clubs', rank: 7 },
      { suit: 'hearts', rank: 4 },
      { suit: 'spades', rank: 2 },
    ],
    position: 'BTN',
    potSize: 400,
    currentBet: 0,
    playerCurrentBet: 0,
    options: [
      { label: '过牌', action: 'check' },
      { label: '下注诈唬', action: 'raise' },
    ],
    correctAction: 'check',
    explanation: '对手一路跟注说明有中等牌力。干燥的河牌面不太可能让他弃牌。诈唬需要有弃牌率支撑——这里对手的跟注范围太宽，诈唬不划算。',
  },
  // === Position Awareness ===
  {
    id: 9,
    category: '位置意识',
    difficulty: 'medium',
    description: '你在枪口位(UTG)拿到A♦ 9♦。前面没人行动。你该怎么做？',
    holeCards: [
      { suit: 'diamonds', rank: 14 },
      { suit: 'diamonds', rank: 9 },
    ],
    communityCards: [],
    position: 'UTG',
    potSize: 30,
    currentBet: 20,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'fold',
    explanation: 'A9同花在UTG位置太弱。UTG是最差的位置（后面还有4个人行动），很容易被主导（AT+, AJ+都比你强）。在有位置优势时再考虑这手牌。',
  },
  {
    id: 10,
    category: '位置意识',
    difficulty: 'easy',
    description: '你在庄位(BTN)拿到J♠ T♠。前面有玩家加注到40，另一个玩家跟注。底池已有100，你该怎么做？',
    holeCards: [
      { suit: 'spades', rank: 11 },
      { suit: 'spades', rank: 10 },
    ],
    communityCards: [],
    position: 'BTN',
    potSize: 100,
    currentBet: 40,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'call',
    explanation: 'JTs同花是投机牌中的好牌，在有位置优势的BTN位可以跟注。翻牌后你有位置优势，可以灵活决策。多人底池也增加了隐含赔率。',
  },
  {
    id: 11,
    category: '翻牌后·价值下注',
    difficulty: 'medium',
    description: '转牌: 8♠ 8♦ 5♣ K♥，你手持8♥ 7♥中了三条。底池150，对手下注100。你该怎么做？',
    holeCards: [
      { suit: 'hearts', rank: 8 },
      { suit: 'hearts', rank: 7 },
    ],
    communityCards: [
      { suit: 'spades', rank: 8 },
      { suit: 'diamonds', rank: 8 },
      { suit: 'clubs', rank: 5 },
      { suit: 'hearts', rank: 13 },
    ],
    position: 'SB',
    potSize: 150,
    currentBet: 100,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注(慢玩)', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'call',
    explanation: '三条8非常强，但K的出现可能给了对手一对K。慢玩（跟注）可以让对手继续投入，在河牌再加注获取最大价值。不过如果对手很松，直接加注也可以。',
  },
  {
    id: 12,
    category: '底池赔率',
    difficulty: 'easy',
    description: '翻牌: A♥ 5♦ 2♣，你手持A♠ K♠有顶对+最大踢脚。底池80，对手下注20。你该怎么做？',
    holeCards: [
      { suit: 'spades', rank: 14 },
      { suit: 'spades', rank: 13 },
    ],
    communityCards: [
      { suit: 'hearts', rank: 14 },
      { suit: 'diamonds', rank: 5 },
      { suit: 'clubs', rank: 2 },
    ],
    position: 'MP',
    potSize: 80,
    currentBet: 20,
    playerCurrentBet: 0,
    options: [
      { label: '弃牌', action: 'fold' },
      { label: '跟注', action: 'call' },
      { label: '加注', action: 'raise' },
    ],
    correctAction: 'raise',
    explanation: 'AK在A高翻牌面有绝对优势。对手的小额下注可能是试探或弱A。加注可以获取价值，同时保护底池免受听牌的威胁。',
  },
];
