import { GameState, GameAction, Card } from '../engine/types';
import { evaluateHand } from '../engine/evaluate';

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

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

const LLM_CONFIG_KEY = 'poker-llm-config';

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: '',
  baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
  model: 'glm-5.1',
  enabled: false,
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
  const lines: string[] = [];
  let currentPhase = '';
  for (const rec of state.actionHistory) {
    if (rec.phase !== currentPhase) {
      currentPhase = rec.phase;
      lines.push(`【${phaseName(currentPhase)}】`);
    }
    const p = state.players.find(pl => pl.id === rec.playerId);
    const name = p?.name || `玩家${rec.playerId}`;
    let act = '';
    switch (rec.action.type) {
      case 'fold': act = '弃牌'; break;
      case 'check': act = '过牌'; break;
      case 'call': act = '跟注'; break;
      case 'raise': act = `加注到${rec.action.amount}`; break;
    }
    lines.push(`  ${name}: ${act}`);
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

export async function makeLLMDecision(
  state: GameState,
  playerIndex: number,
  config: LLMConfig,
): Promise<AIDecision> {
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
  const stackProtectedMax = player.currentBet + player.chips * 0.6;
  const effectiveMaxRaise = Math.min(potSizedMax, stackProtectedMax, fullStack);
  const maxRaise = fullStack;
  if (maxRaise >= minRaise && player.chips > 0) {
    actions.push(`raise (min: ${minRaise}, max: ${effectiveMaxRaise})`);
  }

  // Opponents info
  const opponents = state.players
    .filter(p => p.id !== player.id && !p.isEliminated)
    .map(p => {
      let status = p.isFolded ? '已弃牌' : p.isAllIn ? '全下(已无筹码，加注无意义)' : `筹码${p.chips}, 本轮下注${p.currentBet}`;
      return `${p.name}(${status})`;
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

  const systemPrompt = proInfo
    ? `你是真实的德州扑克职业选手"${proInfo.name}"(${proInfo.title})。

你的真实打牌风格：
${proInfo.style}

你的性格特点：
${proInfo.personality}

你必须完全按照${proInfo.name}的真实风格来打牌。用中文思考。

重要: 即使是最激进的职业选手，大部分手牌也会选择过牌或跟注。加注是例外而非常态。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的思考过程(用${proInfo.name}的口吻)"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount必须在${minRaise}到${effectiveMaxRaise}之间
- 如果可以check，不要fold
- 不要每次都加注到最大值，大多数加注应该适中

${sizingGuide}`
    : `你是一个德州扑克AI玩家。你的名字是"${player.name}"。

重要: 即使是最激进的玩家，大部分手牌也会选择过牌或跟注。加注是例外而非常态。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的思考过程"}

格式规则:
- action只能是: fold, check, call, raise
- raise时amount必须在${minRaise}到${effectiveMaxRaise}之间
- 如果可以check，不要fold
- 不要频繁all-in(全下)，all-in是最后的手段
- 不要每次都加注到最大值，大多数加注应该适中

${sizingGuide}`;

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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('LLM response not JSON:', content);
      lastError = `Not JSON: ${content.slice(0, 100)}`;
      return fallbackDecision(state, playerIndex);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const action: GameAction = { type: parsed.action };
    if (parsed.action === 'raise' && parsed.amount) {
      // Hard cap: protect against all-in unless truly intended
      const clampedAmount = Math.floor(Math.min(parsed.amount, effectiveMaxRaise));
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

    return {
      action,
      thought: parsed.thought || '思考中...',
    };
  } catch (err) {
    console.error('LLM decision error:', err);
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
