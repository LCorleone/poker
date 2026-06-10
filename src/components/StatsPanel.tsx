import React, { useState } from 'react';
import { SessionStats } from '../hooks/useStats';

interface StatsPanelProps {
  stats: SessionStats;
  onReset: () => void;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ stats, onReset }) => {
  const [visible, setVisible] = useState(false);

  const accuracy = stats.decisionsTotal > 0
    ? Math.round((stats.decisionsCorrect / stats.decisionsTotal) * 100)
    : 0;
  const winRate = stats.handsPlayed > 0
    ? Math.round((stats.handsWon / stats.handsPlayed) * 100)
    : 0;

  if (!visible) {
    return (
      <button
        className="stats-toggle"
        onClick={() => setVisible(true)}
        title="统计数据"
      >
        📊
      </button>
    );
  }

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <span className="stats-title">📊 训练统计</span>
        <button className="stats-close" onClick={() => setVisible(false)}>✕</button>
      </div>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-label">手牌数</div>
          <div className="stat-value">{stats.handsPlayed}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">决策准确率</div>
          <div className={`stat-value ${accuracy >= 60 ? 'stat-good' : accuracy >= 40 ? 'stat-ok' : 'stat-bad'}`}>
            {accuracy}%
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">正确/总决策</div>
          <div className="stat-value">{stats.decisionsCorrect}/{stats.decisionsTotal}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">当前连胜</div>
          <div className="stat-value stat-streak">🔥 {stats.currentStreak}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">最长连胜</div>
          <div className="stat-value">⭐ {stats.longestStreak}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">赢牌率</div>
          <div className="stat-value">{winRate}%</div>
        </div>
      </div>
      <button className="stats-reset" onClick={onReset}>
        重置统计
      </button>
    </div>
  );
};

export default StatsPanel;
