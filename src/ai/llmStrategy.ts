import { GameState, GameAction, Card } from '../engine/types';
import { evaluateHand } from '../engine/evaluate';
import { calculatePosition } from '../engine/gto';

// Last error for debugging (must be declared before use)
let lastError: string | null = null;
export function getLastError(): string | null { return lastError; }

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

function buildEmotionContext(playerChips: number, handNumber: number, actionHistory: { playerId: number; action: { type: string; amount?: number } }[], playerId: number): string {
  const startingChips = 5000;
  const profit = playerChips - startingChips;
  const profitStr = profit > 0 ? `+${profit}` : `${profit}`;

  // Count recent results: wins/losses in last few hands
  const myActions = actionHistory.filter(a => a.playerId === playerId);
  const recentActions = myActions.slice(-20);
  const bigBets = recentActions.filter(a => a.action.type === 'raise' && (a.action.amount || 0) > startingChips * 0.1).length;
  const folds = recentActions.filter(a => a.action.type === 'fold').length;

  let mood: string;
  if (profit > startingChips * 0.5) {
    mood = `你目前赢了很多(+${profit}筹码)，信心满满，感觉自己不可阻挡。你可能会更激进，想要利用这股气势继续赢下去。`;
  } else if (profit > startingChips * 0.2) {
    mood = `你目前处于盈利状态(${profitStr}筹码)，心情不错，打牌比较放松自信。`;
  } else if (profit > -startingChips * 0.2) {
    mood = `你目前大致持平(${profitStr}筹码)，心态平稳，正常发挥。`;
  } else if (profit > -startingChips * 0.5) {
    mood = `你目前亏损较多(${profitStr}筹码)，开始有些焦虑和不甘心。你会倾向于想要赢回来，可能会做出更激进的举动。`;
  } else {
    mood = `你目前亏损严重(${profitStr}筹码)，已经进入tilt状态！你非常沮丧和愤怒，很可能会冲动地做出不理智的决定——比如用烂牌全下，想要一把翻本。`;
  }

  // Short stack pressure
  let stackPressure = '';
  if (playerChips < startingChips * 0.2 && playerChips > 0) {
    stackPressure = '\n你的筹码已经很少了， desperation(绝望)感很强——要么赶紧翻倍，要么就要被淘汰了！';
  } else if (playerChips > startingChips * 2) {
    stackPressure = '\n你是桌上筹码最多的玩家，这让你有底气欺压筹码少的对手。';
  }

  // Fold pressure — if folded a lot recently
  let foldPressure = '';
  if (folds >= 4) {
    foldPressure = '\n你最近弃牌了很多次，感觉一直在被动挨打，很想找机会反击一下。';
  }

  return `【你当前的心理状态】
第${handNumber}手牌 | 筹码: ${playerChips} | 盈亏: ${profitStr}
${mood}${stackPressure}${foldPressure}`;
}

function buildHumanSystemPrompt(playerName: string, minRaise: number, maxRaise: number, emotionContext: string): string {
  return `你是一个真实的人类扑克玩家，名叫"${playerName}"。

你不是一个机器人。你有真实的人类情感和心理状态:
- 拿到好牌会兴奋，想赢更多
- 面对大额下注会紧张、害怕
- 连续输牌后会变得急躁、想要翻本(tilt)
- 被对手诈唬后会愤怒，想要报复
- 看到对手犹豫会觉得他可能没有好牌
- 手里筹码多时会更大胆，筹码少时会更谨慎

你精通所有扑克策略，可以自由使用:
- Bluff (诈唬) — 用弱牌下注让对手弃牌
- Continuation Bet (C-Bet) — 翻牌前加注后翻牌继续下注
- Check-Raise (过牌加注) — 先过牌引诱对手下注，然后加注
- 3-Bet / 4-Bet / 5-Bet — 连续加注施压
- Overbet for Value (超额下注) — 用超强牌下注超过底池
- Slow Play (慢打) — 有超强牌时故意示弱
- Float — 翻牌跟注，计划在后面街道诈唬
- Donk Bet — 翻牌后不在位置优势时主动下注

${emotionContext}

你的决策应该像真人一样，考虑:
1. 你的牌力和成牌潜力
2. 对手可能的牌范围(根据他们的行动判断)
3. 底池赔率是否值得跟注
4. 你的位置优势或劣势
5. 你的筹码量和对手的筹码量
6. 你当前的心理状态(是否在tilt，是否自信)

用中文思考。你的思考过程应该反映真实的人类心理活动。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的真实内心想法"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount必须 ≥ ${minRaise} 且 ≤ ${maxRaise}
- 如果可以check，不要fold
- 下注大小应该根据你的牌力和心理状态变化，不要机械地每次下注相同比例`;
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
    actions.push(`raise (min: ${minRaise}, 建议: ${normalMax}, 最大: ${maxRaise})`);
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
    const emotionContext = buildEmotionContext(player.chips, state.handNumber, state.actionHistory, player.id);
    systemPrompt = buildHumanSystemPrompt(player.name, minRaise, maxRaise, emotionContext);
  } else if (proInfo) {
    systemPrompt = `你是真实的德州扑克职业选手"${proInfo.name}"(${proInfo.title})。

你的真实打牌风格：
${proInfo.style}

你的性格特点：
${proInfo.personality}

你必须完全按照${proInfo.name}的真实风格来打牌。用中文思考。

重要: 作为职业选手，你要平衡过牌/跟注和加注。不要过度保守，该加注时要果断加注。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的思考过程(用${proInfo.name}的口吻)"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount范围: ${minRaise}(最小) ~ ${normalMax}(建议上限) ~ ${maxRaise}(极限，仅超强牌或特殊诈唬)
- 如果可以check，不要fold
- 不要每次都加注到最大值，大多数加注应该适中

${sizingGuide}`;
  } else {
    systemPrompt = `你是一个德州扑克AI玩家。你的名字是"${player.name}"。

重要: 作为牌手，你要平衡过牌/跟注和加注。不要过度保守，该加注时要果断加注。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的思考过程"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount范围: ${minRaise}(最小) ~ ${normalMax}(建议上限) ~ ${maxRaise}(极限，仅超强牌或特殊诈唬)
- 如果可以check，不要fold
- 不要频繁all-in(全下)，all-in是最后的手段
- 不要每次都加注到最大值，大多数加注应该适中

${sizingGuide}`;
  }

  const userPrompt = `现在轮到你(${player.name})做决定了！

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

    console.log(`📥 ${player.name} ← LLM: ${JSON.stringify({ action, thought: parsed.thought })}`);

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
