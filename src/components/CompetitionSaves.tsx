import React, { useState } from 'react';
import {
  CompetitionSave,
  listCompetitions,
  deleteCompetition,
} from '../ai/competitionStore';

interface CompetitionSavesProps {
  onBack: () => void;                   // back to mode-select / setup
  onResume: (save: CompetitionSave) => void; // load + go to arena
}

function statusBadge(status: CompetitionSave['status']): { icon: string; label: string } {
  switch (status) {
    case 'running':
      return { icon: '🟢', label: '运行中' };
    case 'paused':
      return { icon: '⏸', label: '已暂停' };
    case 'finished':
      return { icon: '🏁', label: '已结束' };
    default:
      return { icon: '•', label: status };
  }
}

// Relative-ish timestamp for the save list ("刚刚" / "N 分钟前" / date).
function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MAX_NAME_PREVIEW = 4;

const CompetitionSaves: React.FC<CompetitionSavesProps> = ({ onBack, onResume }) => {
  const [saves, setSaves] = useState<CompetitionSave[]>(() => listCompetitions());

  const refresh = () => setSaves(listCompetitions());

  const handleDelete = (save: CompetitionSave) => {
    if (!window.confirm(`确认删除「${save.name}」?`)) return;
    deleteCompetition(save.id);
    refresh();
  };

  return (
    <div className="comp-saves">
      <header className="comp-saves-header">
        <button className="btn comp-saves-back" onClick={onBack}>
          ← 返回
        </button>
        <h1 className="comp-saves-title">📂 对战存档</h1>
        <button
          className="btn comp-saves-refresh"
          onClick={refresh}
          title="刷新"
        >
          🔄
        </button>
      </header>

      {saves.length === 0 ? (
        <div className="comp-saves-empty">
          <div className="comp-saves-empty-icon">🗂️</div>
          <p className="comp-saves-empty-text">暂无保存的对战记录</p>
        </div>
      ) : (
        <div className="comp-saves-list">
          {saves.map(save => {
            const badge = statusBadge(save.status);
            const names = save.competitors.map(c => c.name);
            const shown = names.slice(0, MAX_NAME_PREVIEW);
            const extra = names.length - shown.length;
            return (
              <div className="comp-saves-card" key={save.id}>
                <div className="comp-saves-card-head">
                  <div className="comp-saves-card-title">
                    <span className="comp-saves-name">{save.name}</span>
                    <span className="comp-saves-badge">
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                  <div className="comp-saves-meta">
                    第{save.currentHand}手 · {save.competitors.length}名玩家 · {formatTime(save.updatedAt)}
                  </div>
                  <div className="comp-saves-players">
                    {shown.map((n, i) => (
                      <span className="comp-saves-player" key={i}>
                        {n}
                        {save.competitors[i]?.llm.model && (
                          <span className="comp-saves-player-model">
                            {' '}
                            ({save.competitors[i].llm.model})
                          </span>
                        )}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="comp-saves-player-extra">+{extra}</span>
                    )}
                  </div>
                </div>

                <div className="comp-saves-card-actions">
                  {save.status === 'finished' ? (
                    <button
                      className="btn btn-comp-play"
                      onClick={() => onResume(save)}
                    >
                      📊 查看结果
                    </button>
                  ) : (
                    <button
                      className="btn btn-comp-play"
                      onClick={() => onResume(save)}
                    >
                      ▶ 继续
                    </button>
                  )}
                  <button
                    className="btn btn-comp-exit"
                    onClick={() => handleDelete(save)}
                  >
                    🗑 删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CompetitionSaves;
