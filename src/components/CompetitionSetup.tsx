import React, { useState } from 'react';
import { Competitor } from '../ai/competitionStore';
import { POKER_PROS } from '../engine/pros';

interface CompetitionConfig {
  startingChips: number;
  handsPerLevel: number;
}

interface CompetitionSetupProps {
  onStart: (
    competitors: Competitor[],
    config: CompetitionConfig,
    saveName: string,
  ) => void;
  onCancel: () => void;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const DEFAULT_CUSTOM_PROMPT = '你是一个谨慎保守的扑克玩家，不喜欢冒险，只会在拿到强牌时才下注或加注。';

type PromptType = 'human' | 'pro' | 'custom';

interface PlayerDraft {
  id: string;
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  promptType: PromptType;
  proId: string;
  customText: string;
}

function newDraftId(index: number): string {
  return `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeDraft(index: number): PlayerDraft {
  return {
    id: newDraftId(index),
    name: `AI #${index + 1}`,
    model: '',
    baseUrl: '',
    apiKey: '',
    promptType: 'human',
    proId: POKER_PROS[0]?.id ?? '',
    customText: DEFAULT_CUSTOM_PROMPT,
  };
}

const CompetitionSetup: React.FC<CompetitionSetupProps> = ({ onStart, onCancel }) => {
  const [saveName, setSaveName] = useState<string>('AI对战-1');
  const [startingChips, setStartingChips] = useState<number>(5000);
  const [handsPerLevel, setHandsPerLevel] = useState<number>(10);
  const [drafts, setDrafts] = useState<PlayerDraft[]>(() =>
    Array.from({ length: 4 }, (_, i) => makeDraft(i)),
  );
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (id: string, patch: Partial<PlayerDraft>) => {
    setDrafts(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));
  };

  const addPlayer = () => {
    if (drafts.length >= MAX_PLAYERS) return;
    setDrafts(prev => [...prev, makeDraft(prev.length)]);
  };

  const removePlayer = (id: string) => {
    if (drafts.length <= MIN_PLAYERS) return;
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const handleStart = () => {
    // Validate: every player needs name + model + baseUrl + apiKey.
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (!d.name.trim() || !d.model.trim() || !d.baseUrl.trim() || !d.apiKey.trim()) {
        setError(`第 ${i + 1} 个玩家的名称、模型、API地址、API Key 都不能为空。`);
        return;
      }
    }
    if (!startingChips || startingChips <= 0) {
      setError('起始筹码必须为正数。');
      return;
    }
    if (!handsPerLevel || handsPerLevel <= 0) {
      setError('每级手数必须为正数。');
      return;
    }
    setError(null);

    const competitors: Competitor[] = drafts.map((d, i) => ({
      id: `comp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: d.name.trim(),
      llm: {
        apiKey: d.apiKey.trim(),
        baseUrl: d.baseUrl.trim(),
        model: d.model.trim(),
        enabled: true,
        strategy: d.promptType === 'pro' ? 'pro' : 'human',
      },
      prompt: {
        type: d.promptType,
        proId: d.promptType === 'pro' ? (d.proId || POKER_PROS[0]?.id) : undefined,
        customText: d.promptType === 'custom' ? d.customText : undefined,
      },
    }));

    onStart(competitors, { startingChips, handsPerLevel }, saveName.trim() || 'AI对战-1');
  };

  return (
    <div className="comp-setup">
      <h1 className="comp-setup-title">⚔️ AI对战设置</h1>

      <div className="comp-setup-body">
        {/* Save name + config */}
        <div className="comp-setup-row">
          <div className="llm-settings-row" style={{ flex: 2 }}>
            <label className="llm-settings-label">存档名称</label>
            <input
              type="text"
              className="llm-settings-input"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="AI对战-1"
            />
          </div>
          <div className="llm-settings-row" style={{ flex: 1 }}>
            <label className="llm-settings-label">起始筹码</label>
            <input
              type="number"
              className="llm-settings-input"
              value={startingChips}
              min={1}
              onChange={e => setStartingChips(Number(e.target.value) || 0)}
            />
          </div>
          <div className="llm-settings-row" style={{ flex: 1 }}>
            <label className="llm-settings-label">每级手数</label>
            <input
              type="number"
              className="llm-settings-input"
              value={handsPerLevel}
              min={1}
              onChange={e => setHandsPerLevel(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Player count stepper */}
        <div className="comp-player-count">
          <span className="llm-settings-label">玩家数量</span>
          <button
            type="button"
            className="btn comp-stepper-btn"
            onClick={() => drafts.length > MIN_PLAYERS && removePlayer(drafts[drafts.length - 1].id)}
            disabled={drafts.length <= MIN_PLAYERS}
          >
            −
          </button>
          <span className="comp-player-count-value">{drafts.length}</span>
          <button
            type="button"
            className="btn comp-stepper-btn"
            onClick={addPlayer}
            disabled={drafts.length >= MAX_PLAYERS}
          >
            +
          </button>
          <span className="comp-player-count-hint">（{MIN_PLAYERS}-{MAX_PLAYERS}）</span>
        </div>

        {/* Player cards */}
        <div className="comp-player-list">
          {drafts.map((d, i) => (
            <div className="comp-player-card" key={d.id}>
              <div className="comp-player-card-header">
                <span className="comp-player-card-title">玩家 {i + 1}</span>
                {drafts.length > MIN_PLAYERS && (
                  <button
                    type="button"
                    className="comp-player-remove"
                    onClick={() => removePlayer(d.id)}
                    title="移除该玩家"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="comp-player-card-grid">
                <div className="llm-settings-row">
                  <label className="llm-settings-label">名称</label>
                  <input
                    type="text"
                    className="llm-settings-input"
                    value={d.name}
                    onChange={e => updateDraft(d.id, { name: e.target.value })}
                    placeholder={`AI #${i + 1}`}
                  />
                </div>
                <div className="llm-settings-row">
                  <label className="llm-settings-label">模型</label>
                  <input
                    type="text"
                    className="llm-settings-input"
                    value={d.model}
                    onChange={e => updateDraft(d.id, { model: e.target.value })}
                    placeholder="deepseek-chat / glm-5-turbo"
                  />
                </div>
                <div className="llm-settings-row">
                  <label className="llm-settings-label">API地址</label>
                  <input
                    type="text"
                    className="llm-settings-input"
                    value={d.baseUrl}
                    onChange={e => updateDraft(d.id, { baseUrl: e.target.value })}
                    placeholder="https://api.deepseek.com"
                  />
                </div>
                <div className="llm-settings-row">
                  <label className="llm-settings-label">API Key</label>
                  <input
                    type="password"
                    className="llm-settings-input"
                    value={d.apiKey}
                    onChange={e => updateDraft(d.id, { apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>
              </div>

              <div className="llm-settings-row">
                <label className="llm-settings-label">人设</label>
                <select
                  className="llm-settings-input comp-persona-select"
                  value={d.promptType}
                  onChange={e => updateDraft(d.id, { promptType: e.target.value as PromptType })}
                >
                  <option value="human">🧠 真人模拟</option>
                  <option value="pro">🎩 职业牌手</option>
                  <option value="custom">✍️ 自定义</option>
                </select>
              </div>

              {d.promptType === 'pro' && (
                <div className="llm-settings-row">
                  <label className="llm-settings-label">职业牌手</label>
                  <select
                    className="llm-settings-input comp-persona-select"
                    value={d.proId}
                    onChange={e => updateDraft(d.id, { proId: e.target.value })}
                  >
                    {POKER_PROS.map(pro => (
                      <option key={pro.id} value={pro.id}>
                        {pro.name} - {pro.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {d.promptType === 'custom' && (
                <div className="llm-settings-row">
                  <label className="llm-settings-label">自定义提示词</label>
                  <textarea
                    className="llm-settings-input comp-custom-prompt"
                    value={d.customText}
                    onChange={e => updateDraft(d.id, { customText: e.target.value })}
                    rows={3}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {drafts.length < MAX_PLAYERS && (
          <button type="button" className="btn comp-add-btn" onClick={addPlayer}>
            ➕ 添加玩家
          </button>
        )}

        {error && <div className="comp-error">{error}</div>}

        <div className="comp-setup-actions">
          <button type="button" className="btn btn-comp-cancel" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn btn-comp-start" onClick={handleStart}>
            开始对战
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompetitionSetup;
