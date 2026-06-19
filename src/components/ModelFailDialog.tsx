import React, { useState } from 'react';
import { LLMConfig } from '../ai/llmStrategy';

export interface ModelFailureInfo {
  competitorId: string;
  competitorName: string;
  error: string;
  atHand: number;
}

interface ModelFailDialogProps {
  failure: ModelFailureInfo;
  competitorLlm?: LLMConfig;   // current config of the failing competitor (for pre-fill)
  onRetry: () => void;
  onEditSave: (newLlm: LLMConfig) => void;  // called with edited config
  onAbandon: () => void;
}

/**
 * Modal shown when an LLM model call fails during a competition.
 * The autoplay loop has already paused + auto-saved before this renders.
 *
 * The "修改配置" button reveals an inline form to edit the model / base URL /
 * API key without leaving the arena; saving calls onEditSave with the patched
 * config so the caller can apply it and resume the loop.
 */
const ModelFailDialog: React.FC<ModelFailDialogProps> = ({
  failure,
  competitorLlm,
  onRetry,
  onEditSave,
  onAbandon,
}) => {
  const [editing, setEditing] = useState(false);
  const [editModel, setEditModel] = useState(competitorLlm?.model ?? '');
  const [editBaseUrl, setEditBaseUrl] = useState(competitorLlm?.baseUrl ?? '');
  const [editApiKey, setEditApiKey] = useState(competitorLlm?.apiKey ?? '');

  const handleSave = () => {
    onEditSave({
      ...(competitorLlm as LLMConfig),
      model: editModel.trim(),
      baseUrl: editBaseUrl.trim(),
      apiKey: editApiKey.trim(),
      enabled: true,
    });
  };

  return (
    <div className="comp-fail-overlay">
      <div className="comp-fail-panel">
        <div className="comp-fail-title">
          <span className="comp-fail-icon">⚠️</span>
          AI模型调用失败
        </div>

        <p className="comp-fail-text">
          玩家「{failure.competitorName}」的模型在第 {failure.atHand} 手出错，对战已自动暂停并保存。
        </p>

        <div className="comp-fail-error">
          {failure.error}
        </div>

        {editing ? (
          <>
            <div className="comp-fail-note">
              修改后点击「保存并继续」会用新配置重试。
            </div>

            <div className="llm-settings-row">
              <label className="llm-settings-label">模型</label>
              <input
                className="llm-settings-input"
                type="text"
                placeholder="例如 glm-5.1"
                value={editModel}
                onChange={e => setEditModel(e.target.value)}
              />
            </div>

            <div className="llm-settings-row">
              <label className="llm-settings-label">API地址</label>
              <input
                className="llm-settings-input"
                type="text"
                placeholder="https://..."
                value={editBaseUrl}
                onChange={e => setEditBaseUrl(e.target.value)}
              />
            </div>

            <div className="llm-settings-row">
              <label className="llm-settings-label">API Key</label>
              <input
                className="llm-settings-input"
                type="password"
                placeholder="sk-..."
                value={editApiKey}
                onChange={e => setEditApiKey(e.target.value)}
              />
            </div>

            <div className="comp-fail-actions">
              <button className="btn btn-comp-retry" onClick={handleSave}>
                💾 保存并继续
              </button>
              <button className="btn btn-comp-abandon" onClick={() => setEditing(false)}>
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="comp-fail-note">
              已自动保存当前进度，可稍后继续。
            </div>

            <div className="comp-fail-actions">
              <button className="btn btn-comp-retry" onClick={onRetry}>
                🔄 重试
              </button>
              <button className="btn btn-comp-edit" onClick={() => setEditing(true)}>
                ✏️ 修改配置
              </button>
              <button className="btn btn-comp-abandon" onClick={onAbandon}>
                🏳️ 放弃
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelFailDialog;
