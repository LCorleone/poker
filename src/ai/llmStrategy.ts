import { GameState, GameAction, Card, AIPersona } from '../engine/types';
import { evaluateHand } from '../engine/evaluate';
import { PERSONA_INFO } from './strategy';

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

export async function makeLLMDecision(
  state: GameState,
  playerIndex: number,
  config: LLMConfig,
): Promise<AIDecision> {
  const player = state.players[playerIndex];
  const persona = player.persona || 'tag';
  const personaInfo = PERSONA_INFO[persona as keyof typeof PERSONA_INFO];
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
  const maxRaise = player.currentBet + player.chips;
  if (maxRaise >= minRaise && player.chips > 0) {
    actions.push(`raise (min: ${minRaise}, max: ${maxRaise})`);
  }

  // Opponents info
  const opponents = state.players
    .filter(p => p.id !== player.id && !p.isEliminated)
    .map(p => {
      let status = p.isFolded ? '已弃牌' : p.isAllIn ? '全下' : `筹码${p.chips}, 本轮下注${p.currentBet}`;
      if (!p.isFolded && !p.isEliminated && p.holeCards.length === 2 && state.phase === 'showdown') {
        status += `, 手牌: ${p.holeCards.map(cardStr).join(' ')}`;
      }
      return `${p.name}(${status})`;
    })
    .join('; ');

  // Pot odds
  const potOdds = state.pot > 0 && toCall > 0
    ? `${(toCall / (state.pot + toCall) * 100).toFixed(1)}%`
    : 'N/A';

  const systemPrompt = `你是一个德州扑克AI玩家。你的名字是"${player.name}"，你的风格是"${personaInfo?.label || '紧凶'}"(${personaInfo?.style || '稳健型'})。

你必须严格按照你的风格做出决策。用中文思考。

你必须返回严格的JSON格式(不要用markdown代码块):
{"action": "fold"|"check"|"call"|"raise", "amount": 数字(仅raise时需要), "thought": "你的思考过程"}

规则:
- action只能是: fold, check, call, raise
- raise时amount必须在${minRaise}到${maxRaise}之间
- 如果可以check，不要fold
- 保持你的"${personaInfo?.label}"风格`;

  const userPrompt = `当前局面:
阶段: ${phaseName(state.phase)}
你的手牌: ${player.holeCards.map(cardStr).join(' ')}
${state.communityCards.length > 0 ? `公共牌: ${state.communityCards.map(cardStr).join(' ')}` : '尚无公共牌'}
你的手牌成牌: ${handDesc}
底池: ${state.currentBet > 0 ? state.pot : state.pot}
当前最高下注: ${state.currentBet}
你已下注: ${player.currentBet}
需要跟注: ${toCall}
你的筹码: ${player.chips}
底池赔率: ${potOdds}
对手情况: ${opponents}
可选操作: ${actions.join(', ')}

历史操作:
${buildActionSummary(state)}

请做出决策，返回JSON:`;

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LLM API error:', response.status, errText);
      return fallbackDecision(state, playerIndex);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('LLM response not JSON:', content);
      return fallbackDecision(state, playerIndex);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const action: GameAction = { type: parsed.action };
    if (parsed.action === 'raise' && parsed.amount) {
      action.amount = Math.max(minRaise, Math.min(maxRaise, Math.floor(parsed.amount)));
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

    return {
      action,
      thought: parsed.thought || '思考中...',
    };
  } catch (err) {
    console.error('LLM decision error:', err);
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
