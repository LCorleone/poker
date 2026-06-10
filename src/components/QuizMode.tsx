import React, { useState, useCallback } from 'react';
import { QUIZ_SCENARIOS } from '../engine/scenarios';
import CardComponent from './Card';

interface QuizState {
  currentIndex: number;
  selectedAction: string | null;
  showResult: boolean;
  score: { correct: number; total: number };
  category: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  '翻牌前基础': '#4caf50',
  '翻牌后·价值下注': '#2196f3',
  '底池赔率': '#ff9800',
  '诈唬技巧': '#f44336',
  '位置意识': '#9c27b0',
};

const QuizMode: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [state, setState] = useState<QuizState>({
    currentIndex: 0,
    selectedAction: null,
    showResult: false,
    score: { correct: 0, total: 0 },
    category: null,
  });

  const scenarios = state.category
    ? QUIZ_SCENARIOS.filter(s => s.category === state.category)
    : QUIZ_SCENARIOS;

  const current = scenarios[state.currentIndex % scenarios.length];
  const isFinished = state.score.total >= Math.min(scenarios.length, 10);

  const handleCategorySelect = (category: string | null) => {
    setState({
      currentIndex: 0,
      selectedAction: null,
      showResult: false,
      score: { correct: 0, total: 0 },
      category,
    });
  };

  const handleAnswer = useCallback((action: string) => {
    if (state.showResult) return;
    const isCorrect = action === current.correctAction;
    setState(prev => ({
      ...prev,
      selectedAction: action,
      showResult: true,
      score: {
        correct: prev.score.correct + (isCorrect ? 1 : 0),
        total: prev.score.total + 1,
      },
    }));
  }, [current, state.showResult]);

  const handleNext = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
      selectedAction: null,
      showResult: false,
    }));
  }, []);

  const categories = [...new Set(QUIZ_SCENARIOS.map(s => s.category))];

  // Category selection screen
  if (state.score.total === 0 && !state.showResult && state.currentIndex === 0 && state.category === null) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h2>🎯 手牌测验</h2>
          <button className="quiz-exit" onClick={onExit}>返回游戏</button>
        </div>
        <p className="quiz-subtitle">选择一个类别开始练习：</p>
        <div className="quiz-categories">
          {categories.map(cat => (
            <button
              key={cat}
              className="quiz-category-btn"
              style={{ borderColor: CATEGORY_COLORS[cat] || '#666' }}
              onClick={() => handleCategorySelect(cat)}
            >
              <span className="quiz-category-name" style={{ color: CATEGORY_COLORS[cat] || '#fff' }}>
                {cat}
              </span>
              <span className="quiz-category-count">
                {QUIZ_SCENARIOS.filter(s => s.category === cat).length} 题
              </span>
            </button>
          ))}
          <button className="quiz-category-btn quiz-all-btn" onClick={() => handleCategorySelect(null)}>
            <span className="quiz-category-name">📋 全部</span>
            <span className="quiz-category-count">{QUIZ_SCENARIOS.length} 题</span>
          </button>
        </div>
      </div>
    );
  }

  // Results screen
  if (isFinished) {
    const pct = Math.round((state.score.correct / state.score.total) * 100);
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h2>🎯 测验完成!</h2>
        </div>
        <div className="quiz-result-card">
          <div className="quiz-score-big" style={{ color: pct >= 70 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#f44336' }}>
            {pct}%
          </div>
          <div className="quiz-score-detail">
            {state.score.correct} / {state.score.total} 正确
          </div>
          <div className="quiz-score-msg">
            {pct >= 80 ? '🎉 出色！你的扑克基础很扎实！' :
             pct >= 60 ? '👍 不错！继续练习可以更好。' :
             '💪 需要更多练习，别灰心！'}
          </div>
        </div>
        <div className="quiz-result-actions">
          <button className="btn btn-next" onClick={() => handleCategorySelect(null)}>再做一次</button>
          <button className="btn btn-restart" onClick={onExit}>返回游戏</button>
        </div>
      </div>
    );
  }

  // Quiz question screen
  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h2>🎯 {current.category}</h2>
        <div className="quiz-meta">
          <span className="quiz-progress">第 {state.currentIndex + 1} / {scenarios.length} 题</span>
          <span className="quiz-score-live">
            得分: {state.score.correct}/{state.score.total}
          </span>
          <button className="quiz-exit" onClick={onExit}>退出</button>
        </div>
      </div>

      <div className="quiz-question">
        <div className="quiz-difficulty">
          {current.difficulty === 'easy' && '🟢 简单'}
          {current.difficulty === 'medium' && '🟡 中等'}
          {current.difficulty === 'hard' && '🔴 困难'}
        </div>

        <p className="quiz-desc">{current.description}</p>

        <div className="quiz-cards-row">
          <div className="quiz-card-group">
            <span className="quiz-card-label">你的手牌:</span>
            <div className="quiz-cards">
              {current.holeCards.map((c, i) => <CardComponent key={i} card={c} />)}
            </div>
          </div>
          {current.communityCards.length > 0 && (
            <div className="quiz-card-group">
              <span className="quiz-card-label">公共牌:</span>
              <div className="quiz-cards">
                {current.communityCards.map((c, i) => <CardComponent key={i} card={c} />)}
              </div>
            </div>
          )}
        </div>

        <div className="quiz-info-row">
          <span>位置: <strong>{current.position}</strong></span>
          <span>底池: <strong>{current.potSize}</strong></span>
          {current.currentBet > 0 && <span>当前下注: <strong>{current.currentBet}</strong></span>}
        </div>

        {!state.showResult ? (
          <div className="quiz-options">
            {current.options.map(opt => (
              <button
                key={opt.action}
                className="quiz-option-btn"
                onClick={() => handleAnswer(opt.action)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="quiz-feedback">
            <div className={`quiz-verdict ${state.selectedAction === current.correctAction ? 'correct' : 'wrong'}`}>
              {state.selectedAction === current.correctAction ? '✅ 正确!' : '❌ 不正确'}
            </div>
            <div className="quiz-explanation">{current.explanation}</div>
            <button className="btn btn-next" onClick={handleNext}>
              下一题 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizMode;
