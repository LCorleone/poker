import React from 'react';

interface GameOverProps {
  won: boolean;
  onRestart: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ won, onRestart }) => {
  return (
    <div className="feedback-overlay">
      <div className="feedback-panel game-over-panel">
        <h2 className="game-over-title">
          {won ? '🏆 恭喜获胜！' : '😔 游戏结束'}
        </h2>
        <p className="game-over-text">
          {won
            ? '你击败了所有对手，成为最后的赢家！'
            : '你的筹码已经用完了。不要灰心，再来一局！'}
        </p>
        <button className="btn btn-restart" onClick={onRestart}>
          重新开始
        </button>
      </div>
    </div>
  );
};

export default GameOver;
