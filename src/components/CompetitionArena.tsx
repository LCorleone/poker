import React, { useState } from 'react';
import PokerTable from './PokerTable';
import ModelFailDialog from './ModelFailDialog';
import ChatPanel from './ChatPanel';
import { ChatMessage, getTableChats } from '../ai/llmStrategy';
import { useCompetition } from '../hooks/useCompetition';

// Use the hook's full return type so any future fields Just Work.
// `typeof` is a type-only usage, so TypeScript elides the runtime import.
type CompetitionApi = ReturnType<typeof useCompetition>;

interface CompetitionArenaProps {
  competition: CompetitionApi;
  onExit: () => void;
}

const CompetitionArena: React.FC<CompetitionArenaProps> = ({ competition, onExit }) => {
  const [savedFlash, setSavedFlash] = useState(false);
  const [revealCards, setRevealCards] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);

  const {
    gameState,
    handResult,
    competitors,
    leaderboard,
    saveName,
    config,
    isRunning,
    pauseAfterHand,
    isFinished,
    winnerId,
    modelFailure,
    blindInfo,
    play,
    pause,
    setPauseAfterHand,
    dealNextHand,
    manualSave,
    updateCompetitorConfig,
  } = competition;

  React.useEffect(() => {
    setChatMessages(getTableChats());
  }, [gameState, handResult]);

  const handleSave = () => {
    manualSave();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  // ---- Leaderboard (sorted by chips desc) ----
  const sortedEntries = leaderboard
    .map((entry, i) => ({
      entry,
      name: competitors[i]?.name ?? `#${i}`,
      model: competitors[i]?.llm.model ?? '',
      isEliminated: gameState.players[i]?.isEliminated ?? entry.chips <= 0,
    }))
    .sort((a, b) => b.entry.chips - a.entry.chips);

  const leaderId = sortedEntries[0]?.entry.competitorId ?? null;

  // Latest thought per player (from this hand's action history)
  const latestThoughts: Record<number, string> = {};
  for (const record of gameState.actionHistory) {
    if (record.thought) {
      latestThoughts[record.playerId] = record.thought;
    }
  }

  // ---- Finished overlay winner lookup ----
  const winner = winnerId ? competitors.find(c => c.id === winnerId) : null;
  const winnerChips = (() => {
    if (!winnerId) return 0;
    const idx = competitors.findIndex(c => c.id === winnerId);
    if (idx < 0) return 0;
    return gameState.players[idx]?.chips ?? leaderboard[idx]?.chips ?? 0;
  })();

  const handJustFinished =
    !!handResult && !isRunning && !isFinished && pauseAfterHand;

  // True while a finished hand's result is on screen and the competition is
  // still going. Covers BOTH the pause-after-hand window AND the continuous
  // 10s result window (where isRunning may still be true).
  const resultWindow =
    !!handResult && gameState.isHandComplete && !isFinished;

  const winnerText = handResult?.winners
    .map(w => {
      const player = gameState.players[w.playerId];
      const name = player?.name ?? `#${w.playerId}`;
      return `${name} +${w.amount}（${w.hand.name}）`;
    })
    .join('、') ?? '';

  return (
    <div className="comp-arena">
      {/* Header */}
      <header className="comp-arena-header">
        <h1>⚔️ AI对战</h1>
        <span className="comp-save-name">{saveName || '未命名对战'}</span>
        <span className="comp-hand-info">
          第{gameState.handNumber}手 · 盲注 {blindInfo.small}/{blindInfo.big} · 级别 {blindInfo.level}/{blindInfo.totalLevels}
        </span>
        <div className="comp-panel-toggles">
          <button
            className={`btn-comp-panel-toggle${showLeaderboard ? ' active' : ''}`}
            onClick={() => setShowLeaderboard(v => !v)}
            title="显示/隐藏排行榜"
          >
            🏆 榜
          </button>
          {revealCards && (
            <button
              className={`btn-comp-panel-toggle${showThoughts ? ' active' : ''}`}
              onClick={() => setShowThoughts(v => !v)}
              title="显示/隐藏思考过程"
            >
              🧠 思考
            </button>
          )}
        </div>
      </header>

      {/* Main: table + leaderboard */}
      <div className="comp-arena-main">
        <div className="comp-arena-table">
          <PokerTable
            gameState={gameState}
            handResult={handResult}
            showEquity={revealCards || resultWindow}
            revealCards={revealCards || resultWindow}
          />

          {resultWindow && (
            <div className="comp-result-banner">
              <span className="comp-result-icon">🏆</span>
              <span className="comp-result-text">{winnerText}</span>
            </div>
          )}

          <div className="comp-controls">
            {isFinished ? (
              <button className="btn btn-comp-play" disabled>
                🏁 已结束
              </button>
            ) : isRunning ? (
              <button className="btn btn-comp-pause" onClick={pause}>
                ⏸ 暂停
              </button>
            ) : (
              <button className="btn btn-comp-play" onClick={play}>
                ▶ {gameState.handNumber > 0 ? '继续' : '开始'}
              </button>
            )}

            <label className="comp-toggle">
              <input
                type="checkbox"
                checked={pauseAfterHand}
                onChange={e => setPauseAfterHand(e.target.checked)}
                disabled={isFinished}
              />
              <span>暂停查看每手结果</span>
            </label>

            <button
              className={`btn btn-comp-reveal${revealCards ? ' active' : ''}`}
              onClick={() => setRevealCards(v => !v)}
              title="显示/隐藏所有玩家手牌"
            >
              {revealCards ? '🃏 隐藏手牌' : '🃏 显示手牌'}
            </button>

            {handJustFinished && (
              <button className="btn btn-comp-next" onClick={dealNextHand}>
                🔄 下一手
              </button>
            )}

            <button
              className="btn btn-comp-save"
              onClick={handleSave}
            >
              {savedFlash ? '✅ 已保存!' : '💾 保存'}
            </button>

            <button className="btn btn-comp-exit" onClick={onExit}>
              🚪 退出
            </button>
          </div>
        </div>

        {showLeaderboard && (
          <aside className="comp-leaderboard comp-overlay-panel">
            <h3 className="comp-leaderboard-title">🏆 排行榜</h3>
          <div className="comp-leaderboard-list">
            {sortedEntries.length === 0 && (
              <div className="comp-leaderboard-empty">暂无数据</div>
            )}
            {sortedEntries.map((row, idx) => (
              <div
                key={row.entry.competitorId}
                className={`comp-leaderboard-entry${row.isEliminated ? ' eliminated' : ''}${
                  row.entry.competitorId === leaderId ? ' leader' : ''
                }`}
              >
                <div className="comp-leaderboard-rank">
                  {row.entry.competitorId === leaderId && !row.isEliminated ? '🥇' : `#${idx + 1}`}
                </div>
                <div className="comp-leaderboard-main">
                  <div className="comp-leaderboard-name">
                    {row.name}
                    {row.isEliminated && <span className="comp-leaderboard-out"> 已淘汰</span>}
                  </div>
                  <div className="comp-leaderboard-model">{row.model}</div>
                  <div className="comp-leaderboard-stats">
                    <span className="comp-leaderboard-chips">💰 {row.entry.chips}</span>
                    <span className="comp-leaderboard-wins">🏆 {row.entry.wins}</span>
                    <span className="comp-leaderboard-hands">🎯 {row.entry.handsPlayed}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="comp-leaderboard-footer">
            起始筹码 {config.startingChips} · 每级 {config.handsPerLevel} 手
          </div>
          </aside>
        )}

        {revealCards && showThoughts && (
          <aside className={`comp-thoughts comp-overlay-panel${showLeaderboard ? ' offset' : ''}`}>
            <h3 className="comp-thoughts-title">🧠 思考过程</h3>
            <div className="comp-thoughts-list">
              {gameState.players.map(p => {
                const thought = latestThoughts[p.id];
                return (
                  <div
                    key={p.id}
                    className={`comp-thoughts-entry${p.isEliminated ? ' eliminated' : ''}${!thought ? ' empty' : ''}`}
                  >
                    <div className="comp-thoughts-name">
                      {p.name}
                      {p.isEliminated && <span className="comp-thoughts-out"> 已淘汰</span>}
                      {p.isFolded && !p.isEliminated && <span className="comp-thoughts-folded"> 弃牌</span>}
                    </div>
                    <div className="comp-thoughts-text">
                      {thought ? `💭 ${thought}` : '（暂无思考）'}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* Finished overlay */}
      {isFinished && (
        <div className="comp-finish-overlay">
          <div className="comp-finish-panel">
            <h2>🏁 对战结束！</h2>
            <p className="comp-finish-winner">
              冠军：<strong>{winner?.name ?? '—'}</strong>
            </p>
            <p className="comp-finish-chips">最终筹码：{winnerChips}</p>
            <div className="comp-finish-actions">
              <button className="btn btn-comp-save" onClick={handleSave}>
                {savedFlash ? '✅ 已保存!' : '💾 保存'}
              </button>
              <button className="btn btn-comp-exit" onClick={onExit}>
                🚪 退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model failure dialog */}
      {modelFailure && (
        <ModelFailDialog
          failure={modelFailure}
          competitorLlm={competitors.find(c => c.id === modelFailure.competitorId)?.llm}
          onRetry={() => play()}
          onEditSave={(newLlm) => {
            updateCompetitorConfig(modelFailure.competitorId, newLlm);
            play();
          }}
          onAbandon={() => {
            pause();
            onExit();
          }}
        />
      )}

      <ChatPanel chats={chatMessages} className="chat-panel-left" />
    </div>
  );
};

export default CompetitionArena;
