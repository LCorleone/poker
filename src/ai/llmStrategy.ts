import { GameState, GameAction, Card, HandRank } from '../engine/types';
import { evaluateHand } from '../engine/evaluate';
import { calculatePosition } from '../engine/gto';

// Last error for debugging (must be declared before use)
let lastError: string | null = null;
export function getLastError(): string | null { return lastError; }

// ===================== Table Chat =====================

export interface ChatMessage {
  playerId: number;
  playerName: string;
  content: string;
  handNumber: number;
  phase: string;
}

const tableChats: ChatMessage[] = [];

export function getTableChats(): ChatMessage[] {
  return [...tableChats];
}

export function clearTableChats(): void {
  tableChats.length = 0;
}

export function addPlayerChat(playerName: string, content: string, handNumber: number, phase: string): void {
  tableChats.push({
    playerId: -1,
    playerName,
    content,
    handNumber,
    phase,
  });
  if (tableChats.length > 50) tableChats.splice(0, tableChats.length - 50);
}

export function formatRecentChats(excludePlayerId: number, currentHandNumber: number): string {
  const recent = tableChats.filter(c => c.playerId !== excludePlayerId && c.handNumber === currentHandNumber);
  if (recent.length === 0) return '无';
  return recent.map(c => `${c.playerName}说: "${c.content}"`).join('\n');
}

// Per-player chat history (keyed by player ID, cleared each hand)
const chatHistories: Map<number, { role: string; content: string }[]> = new Map();
let lastHandNumber: number = -1;

export function clearChatHistory(): void {
  chatHistories.clear();
}

export function resetChatHistoryForHand(handNumber: number): void {
  if (handNumber !== lastHandNumber) {
    chatHistories.clear();
    lastHandNumber = handNumber;
  }
}

// ===================== Cross-hand Memory =====================

interface PlayerMemory {
  consecutiveFolds: number;
  consecutiveLosses: number;
  lastBadBeat: number | null;
  handsPlayed: number;
  lastNResults: ('win' | 'loss' | 'fold')[];
}

const playerMemory: Map<number, PlayerMemory> = new Map();

function getOrCreateMemory(playerId: number): PlayerMemory {
  if (!playerMemory.has(playerId)) {
    playerMemory.set(playerId, {
      consecutiveFolds: 0,
      consecutiveLosses: 0,
      lastBadBeat: null,
      handsPlayed: 0,
      lastNResults: [],
    });
  }
  return playerMemory.get(playerId)!;
}

export function updatePlayerMemory(
  playerId: number,
  handNumber: number,
  result: 'win' | 'loss' | 'fold',
  hadStrongHand?: boolean
): void {
  const mem = getOrCreateMemory(playerId);
  mem.handsPlayed++;
  mem.lastNResults.push(result);
  if (mem.lastNResults.length > 10) mem.lastNResults.shift();

  if (result === 'fold') {
    mem.consecutiveFolds++;
    mem.consecutiveLosses = 0;
  } else if (result === 'loss') {
    mem.consecutiveLosses++;
    mem.consecutiveFolds = 0;
    if (hadStrongHand) {
      mem.lastBadBeat = handNumber;
    }
  } else {
    // win
    mem.consecutiveFolds = 0;
    mem.consecutiveLosses = 0;
  }
}

export function resetPlayerMemories(): void {
  playerMemory.clear();
}

export type LLMStrategy = 'pro' | 'human';

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  strategy: LLMStrategy;
}

const LLM_CONFIG_KEY = 'poker-llm-config';

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: '',
  baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
  model: 'glm-5.1',
  enabled: false,
  strategy: 'pro',
};

export function loadLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(LLM_CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveLLMConfig(config: LLMConfig): void {
  localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
}

// Convert card to readable Chinese string
function cardStr(c: Card): string {
  const suitMap: Record<string, string> = {
    hearts: '红心', diamonds: '方块', clubs: '梅花', spades: '黑桃',
  };
  const rankMap: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A',
  };
  return `${suitMap[c.suit]}${rankMap[c.rank]}`;
}

// Get phase name in Chinese
function phaseName(phase: string): string {
  const map: Record<string, string> = {
    preflop: '翻牌前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌',
  };
  return map[phase] || phase;
}

// Build the action history summary
function buildActionSummary(state: GameState): string {
  if (state.actionHistory.length === 0) return '无';
  // Build position map
  const posOrder: string[] = ['BTN', 'SB', 'BB', 'UTG', 'MP', 'CO'];
  const posLabels: Record<string, string> = { BTN: '庄家', SB: '小盲', BB: '大盲', UTG: 'UTG', MP: 'MP', CO: 'CO' };
  const activeSeats: number[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const idx = (state.dealerIndex + i) % state.players.length;
    if (!state.players[idx].isEliminated) activeSeats.push(idx);
  }
  const seatToPos = new Map<number, string>();
  for (let i = 0; i < activeSeats.length; i++) {
    const p = posOrder[i % posOrder.length];
    seatToPos.set(activeSeats[i], posLabels[p] || p);
  }

  const lines: string[] = [];
  let currentPhase = '';
  for (const rec of state.actionHistory) {
    if (rec.phase !== currentPhase) {
      currentPhase = rec.phase;
      lines.push(`【${phaseName(currentPhase)}】`);
    }
    const p = state.players.find(pl => pl.id === rec.playerId);
    const name = p?.name || `玩家${rec.playerId}`;
    const pos = p ? seatToPos.get(p.seatIndex) || '' : '';
    let act = '';
    switch (rec.action.type) {
      case 'fold': act = '弃牌'; break;
      case 'check': act = '过牌'; break;
      case 'call': act = '跟注'; break;
      case 'raise': act = `加注到${rec.action.amount}`; break;
    }
    lines.push(`  ${name}[${pos}]: ${act}`);
  }
  return lines.join('\n');
}

export interface AIDecision {
  action: GameAction;
  thought: string;
}

function buildMessages(playerId: number, systemPrompt: string, userPrompt: string): { role: string; content: string }[] {
  const history = chatHistories.get(playerId) || [];
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userPrompt },
  ];
  return messages;
}

function buildEmotionContext(playerChips: number, handNumber: number, playerId: number): string {
  const startingChips = 5000;
  const profit = playerChips - startingChips;
  const profitStr = profit > 0 ? `+${profit}` : `${profit}`;

  const memory = playerMemory.get(playerId);

  // Base mood from P&L
  let mood: string;
  if (profit > startingChips * 0.5) {
    mood = `你目前赢了很多(+${profit}筹码)，信心爆棚，感觉自己今天运气超好。`;
  } else if (profit > startingChips * 0.2) {
    mood = `你目前盈利(${profitStr}筹码)，心情不错，打牌比较放松。`;
  } else if (profit > -startingChips * 0.2) {
    mood = `你目前大致持平(${profitStr}筹码)，心态平稳。`;
  } else if (profit > -startingChips * 0.5) {
    mood = `你亏损了不少(${profitStr}筹码)，开始有些烦躁和不甘心。`;
  } else {
    mood = `你亏损严重(${profitStr}筹码)，非常沮丧，已经有点上头了！`;
  }

  // Event-driven emotions (these layer on top of base mood)
  let eventContext = '';

  if (memory) {
    // Bad beat
    if (memory.lastBadBeat !== null && handNumber - memory.lastBadBeat <= 2) {
      eventContext += `\n⚠️ 最近的${handNumber - memory.lastBadBeat}手前，你拿着强牌被对手逆转了，你到现在还很窝火！这让你很想报复性地下一手大注。`;
    }

    // Consecutive folds
    if (memory.consecutiveFolds >= 3) {
      eventContext += `\n你已经连续${memory.consecutiveFolds}手弃牌了，感觉一直在被压制，很想找机会反击——哪怕是冒着风险。`;
    }

    // Consecutive losses
    if (memory.consecutiveLosses >= 2) {
      eventContext += `\n你连续${memory.consecutiveLosses}手输了牌，心里很不服气，想要赢回来。`;
    }

    // Recent winning streak
    if (memory.lastNResults.length >= 3) {
      const recent = memory.lastNResults.slice(-3);
      if (recent.every(r => r === 'win')) {
        eventContext += '\n你最近连赢了几手，觉得自己状态火热，运气站在你这边。';
      }
    }
  }

  // Stack pressure
  let stackPressure = '';
  if (playerChips < startingChips * 0.2 && playerChips > 0) {
    stackPressure = '\n你的筹码快没了！desperation感很强——要么翻倍要么回家！';
  } else if (playerChips > startingChips * 2) {
    stackPressure = '\n你是桌上筹码最多的，有资本欺负筹码少的对手。';
  }

  return `【你当前的心理状态】
第${handNumber}手牌 | 筹码: ${playerChips} | 盈亏: ${profitStr}
${mood}${eventContext}${stackPressure}`;
}

function buildHumanSystemPrompt(playerName: string, minRaise: number, maxRaise: number, emotionContext: string): string {
  return `你是一个真实的人类扑克玩家，名叫"${playerName}"。

你不是机器人，不是AI，不是职业选手。你是一个普通的扑克爱好者。

你有人类的弱点：
- 拿到好牌会忍不住兴奋，想让对手多投钱进来
- 面对大额下注会犹豫害怕，有时会弃掉其实该跟的牌
- 输了会不甘心，想翻本，有时会做出冲动的决定
- 赢了会觉得自己厉害，可能会变得更大胆
- 有时会诈唬，有时诈唬失败了会很尴尬
- 有时候就是凭感觉，觉得这把能赢
- 别人加注的时候你不一定会信——有时候你会觉得他在诈唬，想要抓他
- 你不是每次都能做正确的决定，有时候跟注是对的但你弃牌了，有时候弃牌是对的但你跟了

你的风格不是固定的——你的打法会随着心情、筹码量和对手表现而变化。你可能在心情好的时候打得激进，紧张的时候打得保守，上头的时候什么荒唐事都干得出来。

${emotionContext}

用中文思考。你的思考过程应该像真人内心独白，不要像分析师在写报告。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你真实的内心想法", "chat": "对其他玩家说的话(可以是诈唬、挑衅、示弱、闲聊等，空字符串就不说话)"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount必须 ≥ ${minRaise} 且 ≤ ${maxRaise}，具体多少根据你的判断和心情
- 如果可以check，不要fold
- 你可以选择对其他玩家说点什么(chat字段)，就像真人打牌时聊天一样——开玩笑、抱怨、吹牛、虚张声势
- 不要每手都说话，只在想说话的时候说`
}

export async function makeLLMDecision(
  state: GameState,
  playerIndex: number,
  config: LLMConfig,
): Promise<AIDecision> {
  console.log('🤖 makeLLMDecision called for player', playerIndex, 'enabled:', config.enabled);
  // Reset chat history when a new hand starts
  resetChatHistoryForHand(state.handNumber);

  const player = state.players[playerIndex];
  const proInfo = player.proInfo;
  const toCall = state.currentBet - player.currentBet;

  // Evaluate current hand
  const allCards = [...player.holeCards, ...state.communityCards];
  let handDesc = '';
  if (state.communityCards.length >= 3) {
    const hand = evaluateHand(allCards);
    handDesc = hand.name;
  } else {
    handDesc = describeShort(player.holeCards);
  }

  // Build available actions
  const canCheck = toCall === 0;
  const actions = ['fold'];
  if (canCheck) {
    actions.push('check');
  } else {
    actions.push('call');
  }
  // Raise range
  const minRaise = state.currentBet + state.minRaise;
  const fullStack = player.currentBet + player.chips;

  // Smart max: cap raise to discourage reckless all-in, but still allow it
  const potSizedMax = state.currentBet + state.pot;
  const normalMax = Math.min(potSizedMax, player.currentBet + player.chips * 0.8, fullStack);
  const maxRaise = fullStack;
  if (maxRaise >= minRaise && player.chips > 0) {
    if (config.strategy === 'human') {
      actions.push(`raise (min: ${minRaise}, 最大: ${maxRaise})`);
    } else {
      actions.push(`raise (min: ${minRaise}, 建议: ${normalMax}, 最大: ${maxRaise})`);
    }
  }

  // Opponents info
  const opponents = state.players
    .filter(p => p.id !== player.id && !p.isEliminated)
    .map(p => {
      const pos = calculatePosition(p.seatIndex, state.dealerIndex, state.players);
      const posLabel = { BTN: '庄家', SB: '小盲', BB: '大盲', UTG: 'UTG', MP: 'MP', CO: 'CO' }[pos] || pos;
      let status: string;
      if (p.isFolded) {
        status = '已弃牌';
      } else if (p.isAllIn) {
        status = '全下';
      } else {
        const hasActed = state.actionHistory.some(r => r.playerId === p.id && r.phase === state.phase);
        status = `筹码${p.chips}${p.currentBet > 0 ? `, 本轮下注${p.currentBet}` : hasActed ? ', 过牌' : ', 未行动'}`;
      }
      return `${p.name}[${posLabel}](${status})`;
    })
    .join('; ');

  const allOpponentsAllIn = state.players
    .filter(p => p.id !== player.id && !p.isEliminated && !p.isFolded)
    .every(p => p.isAllIn);

  // Pot odds
  const potOdds = state.pot > 0 && toCall > 0
    ? `${(toCall / (state.pot + toCall) * 100).toFixed(1)}%`
    : 'N/A';

  const sizingGuide = `下注尺寸参考:
- 高牌/弱对: 过牌或小注(底池的30-50%)
- 两对/三条: 中等下注(底池的50-75%)
- 同花/葫芦/四条+: 可以大额下注(底池的75-100%)
- 没有成牌时，只在有明确诈唬计划时才加注`;

  let systemPrompt: string;
  if (config.strategy === 'human') {
    const emotionContext = buildEmotionContext(player.chips, state.handNumber, player.id);
    systemPrompt = buildHumanSystemPrompt(player.name, minRaise, maxRaise, emotionContext);
  } else if (proInfo) {
    systemPrompt = `你是真实的德州扑克职业选手"${proInfo.name}"(${proInfo.title})。

你的真实打牌风格：
${proInfo.style}

你的性格特点：
${proInfo.personality}

你必须完全按照${proInfo.name}的真实风格来打牌。用中文思考。

重要: 作为职业选手，你要平衡过牌/跟注和加注。不要过度保守，该加注时要果断加注。

作为顶级职业选手，你会读对手——对手加注不一定代表有强牌，你要考虑他的范围和可能的诈唬。不要轻易被对手的下注吓退，尤其当你有中等牌力时。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的思考过程(用${proInfo.name}的口吻)", "chat": "对其他玩家说的话(可以是诈唬、挑衅、示弱、闲聊等，空字符串就不说话)"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount范围: ${minRaise}(最小) ~ ${normalMax}(建议上限) ~ ${maxRaise}(极限，仅超强牌或特殊诈唬)
- 如果可以check，不要fold
- 不要每次都加注到最大值，大多数加注应该适中
- 你可以选择对其他玩家说点什么(chat字段)，这可以用来误导对手、建立形象、或纯粹是性格表达
- 你的发言要符合${proInfo.name}的性格——可以嚣张、冷漠、幽默或友善
- 不要每手都说话，只在想说话的时候说

${sizingGuide}`;
  } else {
    systemPrompt = `你是一个德州扑克AI玩家。你的名字是"${player.name}"。

重要: 作为牌手，你要平衡过牌/跟注和加注。不要过度保守，该加注时要果断加注。对手加注不一定代表有强牌，你要考虑他可能在诈唬，不要轻易被吓退。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的思考过程", "chat": "对其他玩家说的话(可以是诈唬、挑衅、示弱、闲聊等，空字符串就不说话)"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount范围: ${minRaise}(最小) ~ ${normalMax}(建议上限) ~ ${maxRaise}(极限，仅超强牌或特殊诈唬)
- 如果可以check，不要fold
- 不要频繁all-in(全下)，all-in是最后的手段
- 不要每次都加注到最大值，大多数加注应该适中
- 你可以选择对其他玩家说点什么(chat字段)，用来误导、挑衅或友善互动
- 不要每手都说话，只在想说话的时候说

${sizingGuide}`;
  }

  const isHumanStrategy = config.strategy === 'human';

  const userPrompt = isHumanStrategy
    ? `现在轮到你了！

局面:
你的手牌: ${player.holeCards.map(cardStr).join(' ')}
${state.communityCards.length > 0 ? `公共牌: ${state.communityCards.map(cardStr).join(' ')}` : '还没发公共牌'}
${handDesc !== '未知' ? `你现在的牌: ${handDesc}` : ''}
底池里有 ${state.pot} 筹码，${toCall > 0 ? `你需要跟 ${toCall} 筹码` : '目前没人下注'}。
你手里还有 ${player.chips} 筹码。
对手: ${state.players.filter(p => p.id !== player.id && !p.isEliminated).map(p => {
        if (p.isFolded) return `${p.name}已弃牌`;
        if (p.isAllIn) return `${p.name}全下(${p.chips}筹码)"`;
        const hasActed = state.actionHistory.some(r => r.playerId === p.id && r.phase === state.phase);
        const lastAction = hasActed ? state.actionHistory.filter(r => r.playerId === p.id && r.phase === state.phase).slice(-1)[0] : null;
        let actLabel = '';
        if (lastAction) {
          switch (lastAction.action.type) {
            case 'check': actLabel = '过牌了'; break;
            case 'call': actLabel = '跟注了'; break;
            case 'raise': actLabel = `加注到${lastAction.action.amount}`; break;
          }
        } else {
          actLabel = '还没行动';
        }
        return `${p.name}(${p.chips}筹码, ${actLabel})"`;
      }).join('、')}
${allOpponentsAllIn ? '\n所有人都全下了，你只需要决定跟不跟。' : ''}

最近聊天:
${formatRecentChats(player.id, state.handNumber)}

到现在为止的行动:
${buildActionSummary(state)}

你的决定?`
    : `现在轮到你(${player.name})做决定了！

当前局面:
阶段: ${phaseName(state.phase)}
你的手牌: ${player.holeCards.map(cardStr).join(' ')}
${state.communityCards.length > 0 ? `公共牌: ${state.communityCards.map(cardStr).join(' ')}` : '尚无公共牌'}
你的手牌成牌: ${handDesc}
底池: ${state.pot}
当前最高下注: ${state.currentBet}
你已下注: ${player.currentBet}
需要跟注: ${toCall}
你的筹码: ${player.chips}
底池赔率: ${potOdds}
对手情况: ${opponents}
可选操作: ${actions.join(', ')}
${allOpponentsAllIn ? '\n⚠️ 注意: 所有未弃牌的对手都已全下，你只需要过牌或跟注匹配即可，无需加注（他们无法再响应加注）。' : ''}

最近聊天:
${formatRecentChats(player.id, state.handNumber)}

历史操作(在你之前发生的):
${buildActionSummary(state)}

请做出决策，返回JSON:`;

  try {
    // Smart URL: if baseUrl already ends with a version path (/v1, /v4, etc), just append /chat/completions
    // Otherwise append /v1/chat/completions
    const endpoint = /\/v\d+\/?$/.test(config.baseUrl)
      ? `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
      : `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    // 60s timeout (reasoning models can be slow)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const messages = buildMessages(player.id, systemPrompt, userPrompt);
    const historyCount = (chatHistories.get(player.id) || []).length;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📤 ${player.name} → LLM (历史消息: ${historyCount}条, 总消息: ${messages.length}条)`);
    console.log(`${'='.repeat(60)}`);
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isHistory = i > 0 && i < messages.length - 1;
      console.log(`[${msg.role}]${isHistory ? ' 📜历史' : ''}`);
      console.log(msg.content);
      console.log('---');
    }
    console.log(`${'='.repeat(60)}\n`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages(player.id, systemPrompt, userPrompt),
        temperature: 0.8,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('LLM API error:', response.status, errText);
      lastError = `API ${response.status}: ${errText.slice(0, 100)}`;
      return fallbackDecision(state, playerIndex);
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message;
    // glm reasoning models: content may be empty if reasoning used all tokens
    let content = msg?.content?.trim() || '';
    if (!content && msg?.reasoning_content) {
      // Extract JSON from reasoning content as fallback
      const reasoning = msg.reasoning_content;
      const jsonInReasoning = reasoning.match(/\{[\s\S]*\}/);
      if (jsonInReasoning) {
        content = jsonInReasoning[0];
      } else {
        // No JSON found anywhere, construct from reasoning
        content = '';
        lastError = `模型回复为空(推理消耗全部token)，reasoning: ${reasoning.slice(0, 80)}`;
      }
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (!jsonMatch) {
      console.error('LLM response not JSON:', content);
      lastError = `Not JSON: ${content.slice(0, 100)}`;
      return fallbackDecision(state, playerIndex);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const action: GameAction = { type: parsed.action };
    if (parsed.action === 'raise' && parsed.amount) {
      // Hard cap: protect against all-in unless truly intended
      const clampedAmount = Math.floor(Math.min(parsed.amount, maxRaise));
      action.amount = Math.max(minRaise, clampedAmount);
    }

    // Validate action
    if (!['fold', 'check', 'call', 'raise'].includes(action.type)) {
      return fallbackDecision(state, playerIndex);
    }
    if (action.type === 'check' && !canCheck) {
      action.type = 'call';
    }
    if (action.type === 'raise' && (!action.amount || action.amount < minRaise)) {
      action.amount = minRaise;
    }

    // Save this exchange to chat history
    const history = chatHistories.get(player.id) || [];
    history.push({ role: 'user', content: userPrompt });
    history.push({ role: 'assistant', content: content || JSON.stringify(parsed) });
    // Keep only last 10 exchanges to avoid token overflow
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    chatHistories.set(player.id, history);

    console.log(`📥 ${player.name} ← LLM: ${JSON.stringify({ action, thought: parsed.thought })}${parsed.chat ? ` 💬chat: "${parsed.chat}"` : ''}`);

    // Store chat message if present
    if (parsed.chat && typeof parsed.chat === 'string' && parsed.chat.trim()) {
      tableChats.push({
        playerId: player.id,
        playerName: player.name,
        content: parsed.chat.trim(),
        handNumber: state.handNumber,
        phase: state.phase,
      });
      // Keep only last 50 messages
      if (tableChats.length > 50) tableChats.splice(0, tableChats.length - 50);
    }

    return {
      action,
      thought: parsed.thought || '思考中...',
    };
  } catch (err) {
    console.error('❌❌❌ LLM decision FAILED:', err);
    console.error('Config:', { model: config.model, baseUrl: config.baseUrl, enabled: config.enabled, hasKey: !!config.apiKey });
    lastError = `${err}`;
    return fallbackDecision(state, playerIndex);
  }
}

function describeShort(cards: Card[]): string {
  if (cards.length !== 2) return '未知';
  const [a, b] = cards;
  const suited = a.suit === b.suit;
  if (a.rank === b.rank) return `口袋对${a.rank >= 12 ? '(强)' : ''}`;
  const high = Math.max(a.rank, b.rank);
  const low = Math.min(a.rank, b.rank);
  if (high === 14 && low >= 12) return suited ? '强同花' : '强杂色';
  if (high === 14) return suited ? '同花Ax' : 'Ax';
  if (high >= 12 && low >= 10) return '大牌';
  return suited ? '同花' : '杂牌';
}

// Fallback to simple logic if LLM fails
function fallbackDecision(state: GameState, playerIndex: number): AIDecision {
  const player = state.players[playerIndex];
  const toCall = state.currentBet - player.currentBet;
  if (toCall === 0) {
    return { action: { type: 'check' }, thought: '(网络问题，自动过牌)' };
  }
  if (toCall <= state.pot * 0.3) {
    return { action: { type: 'call' }, thought: '(网络问题，自动跟注)' };
  }
  return { action: { type: 'fold' }, thought: '(网络问题，自动弃牌)' };
}
