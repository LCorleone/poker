import React, { useState } from 'react';
import { HandHistoryEntry } from '../ai/competitionStore';
import { Suit, Rank } from '../engine/types';
import { rankToString, suitToSymbol } from '../engine/deck';

interface HandHistoryPanelProps {
  history: HandHistoryEntry[];
}

// Phase → Chinese label for the header row.
const PHASE_LABELS: Record<string, string> = {
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
  showdown: '摊牌',
};

// Action type → Chinese label, optionally formatting the amount.
const ACTION_LABELS: Record<string, (amount?: number) => string> = {
  fold: () => '弃牌',
  check: () => '过牌',
  call: () => '跟注',
  raise: (a) => (a != null ? `加注到${a}` : '加注'),
};

function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

function actionLabel(actionType: string, amount?: number): string {
  const fn = ACTION_LABELS[actionType];
  return fn ? fn(amount) : actionType;
}

/** Compact text rendering of a snapshot card, e.g. "♠A" or "♥10". */
function cardText(c: { suit: string; rank: number }): string {
  // The snapshot stores the engine's literal Suit string and numeric Rank at
  // capture time, but its static type is the wider string/number. Cast back
  // to the engine's narrow union types so we can reuse the canonical helpers.
  return `${suitToSymbol(c.suit as Suit)}${rankToString(c.rank as Rank)}`;
}

/** Group an entry's flat actionHistory into per-phase sub-lists, preserving order. */
function groupActionsByPhase(entry: HandHistoryEntry): { phase: string; actions: typeof entry.actionHistory }[] {
  const order: string[] = [];
  const buckets: Record<string, typeof entry.actionHistory> = {};
  for (const a of entry.actionHistory) {
    if (!buckets[a.phase]) {
      buckets[a.phase] = [];
      order.push(a.phase);
    }
    buckets[a.phase].push(a);
  }
  return order.map(phase => ({ phase, actions: buckets[phase] }));
}

const HandHistoryPanel: React.FC<HandHistoryPanelProps> = ({ history }) => {
  // Multiple entries may be expanded at once; track by handNumber.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (handNumber: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(handNumber)) next.delete(handNumber);
      else next.add(handNumber);
      return next;
    });
  };

  // Most recent first.
  const entries = [...history].reverse();

  return (
    <>
      <div className="hh-title">📜 历史记录（{history.length}手）</div>
      <div className="hh-list">
        {entries.length === 0 && (
          <div className="comp-leaderboard-empty">暂无历史记录</div>
        )}
        {entries.map(entry => {
          const isOpen = expanded.has(entry.handNumber);
          const winnerText = entry.winners
            .map(w => {
              const name = entry.players.find(p => p.playerId === w.playerId)?.name ?? `#${w.playerId}`;
              return `🏆 ${name} +${w.amount}（${w.handName}）`;
            })
            .join('、');

          return (
            <div key={entry.handNumber} className="hh-entry">
              <div className="hh-entry-header">
                <span>第{entry.handNumber}手</span>
                <span className="hh-phase">{phaseLabel(entry.phase)}</span>
                <span className="hh-pot">💰 {entry.pot}</span>
              </div>
              <div className="hh-winner">{winnerText}</div>
              <div className="hh-toggle" onClick={() => toggle(entry.handNumber)}>
                {isOpen ? '隐藏详情 ▴' : '查看详情 ▾'}
              </div>

              {isOpen && (
                <div className="hh-details">
                  <div className="hh-players">
                    {entry.players.map(p => (
                      <div key={p.playerId} className={`hh-player${p.isFolded ? ' folded' : ''}`}>
                        <span className="hh-player-name">{p.name}</span>
                        <span className="hh-player-cards">
                          {p.holeCards.length > 0 ? p.holeCards.map(cardText).join(' ') : '—'}
                        </span>
                        <span className="hh-player-hand">
                          {p.isEliminated
                            ? '已淘汰'
                            : p.isFolded
                              ? '弃牌'
                              : p.finalHandName ?? ''}
                        </span>
                        <span className="hh-player-chips">💰 {p.chipsAfter}</span>
                      </div>
                    ))}
                  </div>

                  <div className="hh-timeline">
                    {groupActionsByPhase(entry).map(group => (
                      <div key={group.phase} className="hh-phase-group">
                        <div className="hh-phase-header">{phaseLabel(group.phase)}</div>
                        {group.actions.map((a, i) => (
                          <div key={i} className="hh-action">
                            <span className="hh-action-name">{a.playerName}</span>
                            <span>{actionLabel(a.actionType, a.amount)}</span>
                            {a.thought && <span className="hh-action-thought">💭 {a.thought}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default HandHistoryPanel;
