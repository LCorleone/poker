import React from 'react';
import { ActionRecord, Player, Card, GamePhase } from '../engine/types';
import { HandResult } from '../engine/game';
import CardComponent from './Card';

interface HandReplayProps {
  actionHistory: ActionRecord[];
  players: Player[];
  communityCards: Card[];
  handResult: HandResult | null;
  pot: number;
  onClose: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
  showdown: '摊牌',
};

const ACTION_LABELS: Record<string, (amount?: number) => string> = {
  fold: () => '弃牌',
  check: () => '过牌',
  call: () => '跟注',
  raise: (amount) => `加注到 ${amount}`,
};

const HandReplay: React.FC<HandReplayProps> = ({
  actionHistory,
  players,
  communityCards,
  handResult,
  pot,
  onClose,
}) => {
  // Group actions by phase
  const phases: GamePhase[] = [];
  let currentPhase = '';
  for (const record of actionHistory) {
    if (record.phase !== currentPhase) {
      currentPhase = record.phase;
      if (!phases.includes(record.phase as GamePhase)) {
        phases.push(record.phase as GamePhase);
      }
    }
  }

  const winnerIds = new Set(handResult?.winners.map(w => w.playerId) ?? []);

  return (
    <div className="replay-overlay" onClick={onClose}>
      <div className="replay-panel" onClick={e => e.stopPropagation()}>
        <div className="replay-header">
          <h3>🔄 手牌回顾</h3>
          <button className="replay-close" onClick={onClose}>✕</button>
        </div>

        {/* Community cards */}
        <div className="replay-community">
          <span className="replay-section-label">公共牌</span>
          <div className="replay-cards">
            {communityCards.length > 0 ? (
              communityCards.map((c, i) => <CardComponent key={i} card={c} />)
            ) : (
              <span className="replay-none">无</span>
            )}
          </div>
          <span className="replay-pot">底池: {pot}</span>
        </div>

        {/* Players at showdown */}
        <div className="replay-players">
          <span className="replay-section-label">参与者</span>
          {players.filter(p => !p.isEliminated && p.holeCards.length > 0).map(p => {
            const isWinner = winnerIds.has(p.id);
            const winnerData = handResult?.winners.find(w => w.playerId === p.id);
            return (
              <div key={p.id} className={`replay-player ${isWinner ? 'replay-winner' : ''} ${p.isFolded ? 'replay-folded' : ''}`}>
                <div className="replay-player-info">
                  <span className="replay-player-name">
                    {p.name} {isWinner && '🏆'}
                  </span>
                  <span className="replay-player-chips">投入: {p.totalBetThisHand}</span>
                </div>
                <div className="replay-cards">
                  {!p.isFolded ? (
                    p.holeCards.map((c, i) => <CardComponent key={i} card={c} small />)
                  ) : (
                    <span className="replay-folded-text">弃牌</span>
                  )}
                </div>
                {isWinner && winnerData && (
                  <span className="replay-win-amount">
                    +{winnerData.amount} ({winnerData.hand.name})
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Action timeline */}
        <div className="replay-timeline">
          <span className="replay-section-label">行动时间线</span>
          {phases.map(phase => (
            <div key={phase} className="replay-phase">
              <div className="replay-phase-header">{PHASE_LABELS[phase] || phase}</div>
              {actionHistory
                .filter(r => r.phase === phase)
                .map((record, i) => {
                  const player = players.find(p => p.id === record.playerId);
                  const label = ACTION_LABELS[record.action.type](record.action.amount);
                  return (
                    <div key={i} className="replay-action">
                      <span className={`replay-action-name ${player?.isHuman ? 'replay-human' : ''}`}>
                        {player?.name || `P${record.playerId}`}
                      </span>
                      <span className="replay-action-type">{label}</span>
                      {record.thought && (
                        <span className="replay-thought">💭 {record.thought}</span>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>

        <button className="btn btn-next replay-done" onClick={onClose}>
          关闭回顾
        </button>
      </div>
    </div>
  );
};

export default HandReplay;
