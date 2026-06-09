import React from 'react';
import './App.css';
import { useGame } from './hooks/useGame';
import PokerTable from './components/PokerTable';
import ActionBar from './components/ActionBar';
import Feedback from './components/Feedback';
import GameOver from './components/GameOver';
import GTOGuide from './components/GTOGuide';

function App() {
  const {
    gameState,
    feedback,
    handResult,
    isProcessing,
    isHumanTurn,
    availableActions,
    raiseRange,
    isGameOver,
    humanWon,
    gtoAdvice,
    humanPosition,
    startGame,
    playerAction,
    dealNewHand,
  } = useGame();

  const humanPlayer = gameState.players.find(p => p.isHuman);

  // Welcome screen
  if (gameState.phase === 'waiting' && !isProcessing) {
    return (
      <div className="app">
        <div className="welcome-screen">
          <h1 className="welcome-title">🃏 德州扑克训练</h1>
          <p className="welcome-subtitle">与4个AI对手对战，提升你的扑克技巧</p>
          <div className="welcome-info">
            <div className="info-item">💰 起始筹码: 1,000</div>
            <div className="info-item">🎲 盲注: 10/20</div>
            <div className="info-item">👥 玩家: 你 + 4个AI</div>
          </div>
          <button className="btn btn-start" onClick={startGame}>
            开始游戏
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🃏 德州扑克训练</h1>
      </header>

      <PokerTable gameState={gameState} handResult={handResult} />

      {isHumanTurn && !isProcessing && gtoAdvice && humanPosition && (
        <GTOGuide advice={gtoAdvice} position={humanPosition} />
      )}

      {isHumanTurn && !isProcessing && (
        <ActionBar
          availableActions={availableActions}
          raiseRange={raiseRange}
          currentBet={gameState.currentBet}
          playerChips={humanPlayer?.chips ?? 0}
          playerCurrentBet={humanPlayer?.currentBet ?? 0}
          onAction={playerAction}
          disabled={isProcessing}
        />
      )}

      {isProcessing && (
        <div className="processing-bar">
          <div className="processing-text">思考中...</div>
        </div>
      )}

      {/* Show feedback + hand result when hand is complete */}
      {gameState.isHandComplete && feedback && !isGameOver && !humanWon && (
        <Feedback
          feedback={feedback}
          handResult={handResult}
          players={gameState.players}
          onDismiss={dealNewHand}
        />
      )}

      {/* If hand is complete but no feedback (e.g. won by fold), just show next button */}
      {gameState.isHandComplete && !feedback && !isGameOver && !humanWon && (
        <div className="feedback-overlay">
          <div className="feedback-panel">
            <h2 className="feedback-title">
              {handResult
                ? `${gameState.players.find(p => p.id === handResult.winners[0]?.playerId)?.name ?? ''} 赢得 ${handResult.winners[0]?.amount ?? 0} 筹码!`
                : '手牌结束'}
            </h2>
            <button className="btn btn-next" onClick={dealNewHand}>
              下一手牌 →
            </button>
          </div>
        </div>
      )}

      {humanWon && (
        <GameOver won={true} onRestart={startGame} />
      )}

      {isGameOver && (
        <GameOver won={false} onRestart={startGame} />
      )}
    </div>
  );
}

export default App;
