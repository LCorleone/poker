import React, { useRef, useEffect } from 'react';
import { ActionRecord, Player, GamePhase } from '../engine/types';

interface ActionLogProps {
  actionHistory: ActionRecord[];
  players: Player[];
  phase: GamePhase;
}

const ACTION_LABELS: Record<string, (amount?: number) => string> = {
  fold: () => '弃牌',
  check: () => '过牌',
  call: () => '跟注',
  raise: (amount) => `加注到 ${amount}`,
};

const PHASE_LABELS: Record<string, string> = {
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
  showdown: '摊牌',
};

const ActionLog: React.FC<ActionLogProps> = ({ actionHistory, players, phase }) => {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actionHistory.length]);

  if (actionHistory.length === 0 && phase === 'waiting') return null;

  // Group actions by phase
  const phases: string[] = [];
  let currentPhase = '';
  for (const record of actionHistory) {
    if (record.phase !== currentPhase) {
      currentPhase = record.phase;
      if (!phases.includes(currentPhase)) phases.push(currentPhase);
    }
  }

  return (
    <div className="action-log">
      <div className="action-log-title">📝 行动记录</div>
      <div className="action-log-scroll" ref={logRef}>
        {phases.map(phaseKey => (
          <div key={phaseKey}>
            <div className="action-log-phase">{PHASE_LABELS[phaseKey] || phaseKey}</div>
            {actionHistory
              .filter(r => r.phase === phaseKey)
              .map((record, i) => {
                const player = players.find(p => p.id === record.playerId);
                const label = ACTION_LABELS[record.action.type](record.action.amount);
                return (
                  <div key={i} className="action-log-entry">
                    <span className={`action-log-name ${player?.isHuman ? 'action-log-human' : ''}`}>
                      {player?.name || `P${record.playerId}`}
                    </span>
                    <span className="action-log-action">{label}</span>
                  </div>
                );
              })}
          </div>
        ))}
        {actionHistory.length === 0 && (
          <div className="action-log-empty">等待行动...</div>
        )}
      </div>
    </div>
  );
};

export default ActionLog;
