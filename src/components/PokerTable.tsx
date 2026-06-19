import React, { useMemo } from 'react';
import { GameState } from '../engine/types';
import { evaluateHand, calculateExactEquity } from '../engine/evaluate';
import { HandResult } from '../engine/game';
import PlayerSeat from './PlayerSeat';
import CardComponent from './Card';

interface PokerTableProps {
  gameState: GameState;
  handResult: HandResult | null;
  showEquity: boolean;
  revealCards?: boolean;
}

// Seat positions around the table (top, left, right, bottom-left, bottom)
// NOTE: index 5 is competition-only (6th player). The 5-player trainer uses
// indices 0-4 only, so appending (not reordering) keeps the trainer intact.
const SEAT_POSITIONS = [
  'seat-bottom',   // Player (你) - bottom center
  'seat-left',     // 小明 - left
  'seat-top-left', // 小红 - top left
  'seat-top-right',// 老王 - top right
  'seat-right',    // 阿强 - right
  'seat-bottom-left', // 6th player (competition only) - bottom left
];

const PokerTable: React.FC<PokerTableProps> = ({ gameState, handResult, showEquity, revealCards }) => {
  const { players, communityCards, pot, phase, dealerIndex, currentPlayerIndex } = gameState;

  // Calculate exact equity when toggled on
  const equityMap = useMemo(() => {
    if (!showEquity) return new Map<number, number>();
    return calculateExactEquity(players, communityCards);
  }, [showEquity, players, communityCards]);

  // Calculate SB and BB seat indices (persist for entire hand regardless of fold)
  const activeCount = players.filter(p => !p.isEliminated).length;
  const sbSeatIndex = (() => {
    // Heads-up: dealer is the small blind
    if (activeCount === 2) return players[dealerIndex].seatIndex;
    const n = players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (dealerIndex + i) % n;
      if (!players[idx].isEliminated) return players[idx].seatIndex;
    }
    return -1;
  })();

  const bbSeatIndex = (() => {
    const n = players.length;
    // Heads-up: BB is the non-dealer player
    if (activeCount === 2) {
      for (let i = 1; i <= n; i++) {
        const idx = (dealerIndex + i) % n;
        if (!players[idx].isEliminated) return players[idx].seatIndex;
      }
      return -1;
    }
    let foundSB = false;
    for (let i = 1; i <= n; i++) {
      const idx = (dealerIndex + i) % n;
      if (!players[idx].isEliminated) {
        if (!foundSB) { foundSB = true; continue; }
        return players[idx].seatIndex;
      }
    }
    return -1;
  })();
  const isShowdown = phase === 'showdown';

  // Extract last thought for each AI player
  const lastThoughts: Record<number, string> = {};
  for (const record of gameState.actionHistory) {
    if (record.thought) {
      lastThoughts[record.playerId] = record.thought;
    }
  }

  // Extract last action for each player in the CURRENT betting round.
  // (Phase-scoped so a check doesn't linger after the round advances.)
  // Call/raise already show via "下注: X"; fold shows via "弃牌"; only
  // check has no chip movement and needs an explicit "过牌" badge.
  const lastActions: Record<number, string> = {};
  for (const record of gameState.actionHistory) {
    if (record.phase === phase) {
      lastActions[record.playerId] = record.action.type;
    }
  }

  const winnerIds = new Set(handResult?.winners.map((w: { playerId: number }) => w.playerId) ?? []);

  return (
    <div className="poker-table-container">
      <div className="poker-table">
        {/* Pot display */}
        <div className="pot-display">
          <span className="pot-label">底池</span>
          <span className="pot-amount">{pot}</span>
        </div>

        {/* Community cards */}
        <div className="community-cards">
          {communityCards.map((card, i) => (
            <CardComponent key={i} card={card} animate />
          ))}
          {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
            <div key={`empty-${i}`} className="card card-empty" />
          ))}
        </div>

        {/* Phase indicator */}
        <div className="phase-indicator">
          {phase === 'waiting' && '等待开始'}
          {phase === 'preflop' && '翻牌前'}
          {phase === 'flop' && '翻牌'}
          {phase === 'turn' && '转牌'}
          {phase === 'river' && '河牌'}
          {phase === 'showdown' && '摊牌'}
        </div>

        {/* Players */}
        {players.map((player, i) => {
          const posClass = SEAT_POSITIONS[player.seatIndex] || `seat-${i}`;
          const isWinner = winnerIds.has(player.id);
          const winnerData = handResult?.winners.find(w => w.playerId === player.id);
          let handName: string | undefined;
          if (
            (revealCards || isShowdown) &&
            !player.isEliminated &&
            player.holeCards.length > 0 &&
            communityCards.length >= 3
          ) {
            const hand = evaluateHand([...player.holeCards, ...communityCards]);
            handName = hand.name;
          }

          return (
            <div key={player.id} className={`player-position ${posClass}`}>
              <PlayerSeat
                player={player}
                isDealer={dealerIndex === player.seatIndex}
                isSmallBlind={player.seatIndex === sbSeatIndex}
                isBigBlind={player.seatIndex === bbSeatIndex}
                isCurrentTurn={currentPlayerIndex === i}
                showCards={revealCards || (isShowdown && !player.isFolded)}
                isHuman={player.isHuman}
                isWinner={isWinner}
                handName={handName}
                lastThought={lastThoughts[player.id]}
                lastAction={lastActions[player.id]}
                equity={showEquity && !player.isFolded && !player.isEliminated ? equityMap.get(player.id) : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PokerTable;
