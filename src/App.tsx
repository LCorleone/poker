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
import LLMSettings from './components/LLMSettings';
import ChatPanel from './components/ChatPanel';
import { ChatMessage, getTableChats, clearTableChats, addPlayerChat } from './ai/llmStrategy';

import CompetitionSetup from './components/CompetitionSetup';
import CompetitionSaves from './components/CompetitionSaves';
import CompetitionArena from './components/CompetitionArena';
import { useCompetition } from './hooks/useCompetition';
import { Competitor, CompetitionSave } from './ai/competitionStore';

type Mode =
  | 'select'
  | 'trainer'
  | 'competition-setup'
  | 'competition-saves'
  | 'competition-arena';

interface CompetitionConfig {
  startingChips: number;
  handsPerLevel: number;
}

function App() {
  const [mode, setMode] = React.useState<Mode>('select');
  const competition = useCompetition();

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
    replayPlayers,
    stats,
    resetStats,
    blindInfo,
    startGame,
    playerAction,
    dealNewHand,
  } = useGame();

  const [showEquity, setShowEquity] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [showQuiz, setShowQuiz] = React.useState(false);
  const [showLLMSettings, setShowLLMSettings] = React.useState(false);
  const [showReplay, setShowReplay] = React.useState(false);
  const [showTutorial, setShowTutorial] = React.useState(false);

  const humanPlayer = gameState.players.find(p => p.isHuman);

  // Sync chat messages from LLM strategy
  React.useEffect(() => {
    setChatMessages(getTableChats());
  }, [gameState, handResult]);

  // ----- Competition wiring -----
  const handleCompetitionStart = (
    competitors: Competitor[],
    config: CompetitionConfig,
    saveName: string,
  ) => {
    competition.init(competitors, config, saveName);
    setMode('competition-arena');
  };

  const handleCompetitionResume = (save: CompetitionSave) => {
    competition.load(save);
    setMode('competition-arena');
  };

  // ----- Mode router: non-trainer modes render here and return early -----
  if (mode === 'select') {
    return <ModeSelect onSelect={setMode} />;
  }

  if (mode === 'competition-setup') {
    return (
      <CompetitionSetup
        onStart={handleCompetitionStart}
        onCancel={() => setMode('select')}
      />
    );
  }

  if (mode === 'competition-saves') {
    return (
      <CompetitionSaves
        onBack={() => setMode('select')}
        onResume={handleCompetitionResume}
      />
    );
  }

  if (mode === 'competition-arena') {
    return (
      <CompetitionArena
        competition={competition}
        onExit={() => { competition.pause(); setMode('select'); }}
      />
    );
  }

  // ----- Trainer mode (existing logic, intact below) -----

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

  // Welcome screen
  if (gameState.phase === 'waiting' && !isProcessing) {
    return (
      <div className="app">
        <div className="welcome-screen">
          <h1 className="welcome-title">🃏 德州扑克训练</h1>
          <p className="welcome-subtitle">与4个AI对手对战，提升你的扑克技巧</p>
          <div className="welcome-info">
            <div className="info-item">💰 起始筹码: 5,000</div>
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
          <button className="btn btn-llm-welcome" onClick={() => setShowLLMSettings(true)}>
            🤖 AI设置
          </button>
        </div>
        {showLLMSettings && (
          <LLMSettings onClose={() => setShowLLMSettings(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🃏 德州扑克训练</h1>
        <BlindInfo {...blindInfo} handNumber={gameState.handNumber} />
      </header>

      <PokerTable gameState={gameState} handResult={handResult} showEquity={showEquity} />

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

      {gameState.phase !== 'waiting' && (
        <ChatPanel
          chats={chatMessages}
          onSend={(msg) => {
            addPlayerChat('July', msg, gameState.handNumber, gameState.phase);
            setChatMessages(getTableChats());
          }}
        />
      )}

      {/* Show feedback + hand result when hand is complete */}
      {gameState.isHandComplete && feedback && !isGameOver && !humanWon && (
        <Feedback
          feedback={feedback}
          handResult={handResult}
          players={gameState.players}
          onDismiss={dealNewHand}
          onReplay={() => setShowReplay(true)}
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
          players={replayPlayers || gameState.players}
          communityCards={gameState.communityCards}
          handResult={handResult}
          pot={gameState.pot}
          onClose={() => setShowReplay(false)}
        />
      )}
      {showLLMSettings && (
        <LLMSettings onClose={() => setShowLLMSettings(false)} />
      )}
      {!isGameOver && !humanWon && gameState.phase !== 'waiting' && (
        <button className="quiz-toggle-game" onClick={() => setShowQuiz(true)} title="手牌测验">
          🎯
        </button>
      )}
      <button className="llm-settings-toggle" onClick={() => setShowLLMSettings(true)} title="AI设置">
        🤖
      </button>
      {gameState.phase !== 'waiting' && !gameState.isHandComplete && gameState.players.filter(p => !p.isFolded && !p.isEliminated).length > 1 && (
        <button
          className={`equity-toggle${showEquity ? ' active' : ''}`}
          onClick={() => setShowEquity(v => !v)}
          title="显示/隐藏所有玩家胜率"
        >
          📊 胜率
        </button>
      )}
    </div>
  );
}

const ModeSelect: React.FC<{ onSelect: (mode: Mode) => void }> = ({ onSelect }) => {
  return (
    <div className="app">
      <div className="mode-select">
        <h1 className="mode-select-title">🃏 德州扑克</h1>
        <p className="mode-select-subtitle">选择模式</p>
        <div className="mode-select-cards">
          <div className="mode-select-card">
            <div className="mode-select-card-icon">🎓</div>
            <div className="mode-select-card-name">训练模式</div>
            <div className="mode-select-card-desc">与AI对战，学习扑克技巧</div>
            <button
              className="btn btn-mode-enter"
              onClick={() => onSelect('trainer')}
            >
              进入
            </button>
          </div>

          <div className="mode-select-card">
            <div className="mode-select-card-icon">⚔️</div>
            <div className="mode-select-card-name">AI对战</div>
            <div className="mode-select-card-desc">观看AI模型互相竞争</div>
            <div className="mode-select-card-actions">
              <button
                className="btn btn-mode-enter"
                onClick={() => onSelect('competition-setup')}
              >
                🆕 新建对战
              </button>
              <button
                className="btn btn-mode-secondary"
                onClick={() => onSelect('competition-saves')}
              >
                📂 载入存档
              </button>
            </div>
          </div>
        </div>
        <p className="mode-select-footer">提示：对战进度会自动保存到本地</p>
      </div>
    </div>
  );
};

export default App;
