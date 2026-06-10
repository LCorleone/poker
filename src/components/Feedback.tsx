import React from 'react';
import { DecisionFeedback, Player } from '../engine/types';
import { HandResult } from '../engine/game';

interface FeedbackProps {
  feedback: DecisionFeedback;
  handResult: HandResult | null;
  players: Player[];
  onDismiss: () => void;
}

const Feedback: React.FC<FeedbackProps> = ({ feedback, handResult, players, onDismiss }) => {
  const winnerNames = handResult?.winners.map((w: { playerId: number; amount: number; hand: { name: string } }) => {
    const p = players.find(pl => pl.id === w.playerId);
    return p ? `${p.name}(${w.hand.name})` : '';
  }).join(', ') || '';

  return (
    <div className="feedback-overlay">
      <div className="feedback-panel">
        <h2 className="feedback-title">手牌分析</h2>

        {handResult && (
          <div className="feedback-result">
            <span className="result-label">赢家: </span>
            <span className="result-value">{winnerNames}</span>
            <span className="result-label"> | 赢得: </span>
            <span className="result-value">{handResult.winners[0]?.amount ?? 0}</span>
          </div>
        )}

        <div className="feedback-grid">
          <div className="feedback-item">
            <div className="feedback-label"><span className="tip" data-tip="你当前2张底牌+公共牌组成的最强5张牌型">你的牌型</span></div>
            <div className="feedback-value">{feedback.handStrength}</div>
          </div>

          <div className="feedback-item">
            <div className="feedback-label"><span className="tip" data-tip={"跟注成本占底池的比例\n高于这个比例的赢率才值得跟注"}>底池赔率</span></div>
            <div className="feedback-value">{Math.round(feedback.potOdds * 100)}%</div>
          </div>

          <div className="feedback-item">
            <div className="feedback-label"><span className="tip" data-tip="通过蒙特卡洛模拟200次，估算你当前手牌的胜率">赢率估算</span></div>
            <div className="feedback-value">{Math.round(feedback.equityEstimate * 100)}%</div>
          </div>

          <div className="feedback-item">
            <div className="feedback-label"><span className="tip" data-tip="基于你的赢率和底池赔率对比，系统推荐的最优操作">建议操作</span></div>
            <div className="feedback-value">{feedback.recommendation}</div>
          </div>
        </div>

        <div className={`feedback-assessment ${feedback.wasCorrect ? 'correct' : 'incorrect'}`}>
          {feedback.wasCorrect ? '✅ 决策正确!' : '❌ 决策欠佳'}
        </div>

        <div className="feedback-explanation">
          {feedback.explanation}
        </div>

        <button className="btn btn-next" onClick={onDismiss}>
          下一手牌 →
        </button>
      </div>
    </div>
  );
};

export default Feedback;
