import React from 'react';
import './App.css';
import { useGame } from './hooks/useGame';
import PokerTable from './components/PokerTable';
import ActionBar from './components/ActionBar';
import Feedback from './components/Feedback';
import GameOver from './components/GameOver';
import GTOGuide from './components/GTOGuide';
import ActionLog from './components/ActionLog';
import StatsPanel from './components/StatsPanel';
import PotOddsDisplay from './components/PotOddsDisplay';
import BlindInfo from './components/BlindInfo';

import HandRankRef from './components/HandRankRef';
import QuizMode from './components/QuizMode';
import HandReplay from './components/HandReplay';
import Tutorial from './components/Tutorial';

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
    postFlopAdvice,
    humanPosition,
    stats,
    resetStats,
    blindInfo,
    startGame,
    playerAction,
    dealNewHand,
  } = useGame();

  const humanPlayer = gameState.players.find(p => p.isHuman);

  const [showQuiz, setShowQuiz] = React.useState(false);
  const [showReplay, setShowReplay] = React.useState(false);
  const [showTutorial, setShowTutorial] = React.useState(false);

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
          <button className="btn btn-quiz-start" onClick={() => setShowQuiz(true)}>
            🎯 手牌测验
          </button>
          <button className="btn btn-tutorial-start" onClick={() => setShowTutorial(true)}>
            📖 新手教程
          </button>
        </div>
      </div>
    );
  }

  if (showTutorial) {
    return (
      <div className="app">
        <Tutorial onComplete={() => setShowTutorial(false)} />
      </div>
    );
  }

  if (showQuiz) {
    return (
      <div className="app">
        <QuizMode onExit={() => setShowQuiz(false)} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🃏 德州扑克训练</h1>
        <BlindInfo {...blindInfo} handNumber={gameState.handNumber} />
      </header>

      <PokerTable gameState={gameState} handResult={handResult} />

      {isHumanTurn && !isProcessing && humanPosition && (gtoAdvice || postFlopAdvice) && (
        <GTOGuide advice={gtoAdvice ?? undefined} position={humanPosition} postFlopAdvice={postFlopAdvice ?? undefined} />
      )}
      <PotOddsDisplay
        holeCards={humanPlayer?.holeCards ?? []}
        communityCards={gameState.communityCards}
        pot={gameState.pot}
        toCall={gameState.currentBet - (humanPlayer?.currentBet ?? 0)}
        phase={gameState.phase}
        isHumanTurn={isHumanTurn && !isProcessing}
      />

      {isHumanTurn && !isProcessing && (
        <ActionBar
          availableActions={availableActions}
          raiseRange={raiseRange}
          currentBet={gameState.currentBet}
          playerChips={humanPlayer?.chips ?? 0}
          playerCurrentBet={humanPlayer?.currentBet ?? 0}
          pot={gameState.pot}
          onAction={playerAction}
          disabled={isProcessing}
        />
      )}

      {isProcessing && (
        <div className="processing-bar">
          <div className="processing-text">思考中...</div>
        </div>
      )}

      <ActionLog
        actionHistory={gameState.actionHistory}
        players={gameState.players}
        phase={gameState.phase}
      />

      {/* Show feedback + hand result when hand is complete */}
      {gameState.isHandComplete && feedback && !isGameOver && !humanWon && (
        <Feedback
          feedback={feedback}
          handResult={handResult}
          players={gameState.players}
          onDismiss={dealNewHand}
        />
      )}

      {gameState.isHandComplete && feedback && !isGameOver && !humanWon && (
        <button className="btn btn-replay-floating" onClick={() => setShowReplay(true)}>
          🔄 查看回顾
        </button>
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
            <button className="btn btn-replay" onClick={() => setShowReplay(true)}>
              🔄 查看回顾
            </button>
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

      {gameState.phase !== 'waiting' && (
        <StatsPanel stats={stats} onReset={resetStats} />
      )}
      <HandRankRef />
      {showReplay && (
        <HandReplay
          actionHistory={gameState.actionHistory}
          players={gameState.players}
          communityCards={gameState.communityCards}
          handResult={handResult}
          pot={gameState.pot}
          onClose={() => setShowReplay(false)}
        />
      )}
      {!isGameOver && !humanWon && gameState.phase !== 'waiting' && (
        <button className="quiz-toggle-game" onClick={() => setShowQuiz(true)} title="手牌测验">
          🎯
        </button>
      )}
    </div>
  );
}

export default App;
