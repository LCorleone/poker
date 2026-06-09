import React from 'react';
import { GameState } from '../engine/types';
import { evaluateHand } from '../engine/evaluate';
import { HandResult } from '../engine/game';
import PlayerSeat from './PlayerSeat';
import CardComponent from './Card';

interface PokerTableProps {
  gameState: GameState;
  handResult: HandResult | null;
}

// Seat positions around the table (top, left, right, bottom-left, bottom)
const SEAT_POSITIONS = [
  'seat-bottom',   // Player (你) - bottom center
  'seat-left',     // 小明 - left
  'seat-top-left', // 小红 - top left
  'seat-top-right',// 老王 - top right
  'seat-right',    // 阿强 - right
];

const PokerTable: React.FC<PokerTableProps> = ({ gameState, handResult }) => {
  const { players, communityCards, pot, phase, dealerIndex, currentPlayerIndex } = gameState;

  // Calculate SB and BB seat indices (persist for entire hand regardless of fold)
  const sbSeatIndex = (() => {
    const n = players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (dealerIndex + i) % n;
      if (!players[idx].isEliminated) return players[idx].seatIndex;
    }
    return -1;
  })();

  const bbSeatIndex = (() => {
    const n = players.length;
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
            <CardComponent key={i} card={card} />
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
          if (isShowdown && !player.isFolded && !player.isEliminated && player.holeCards.length > 0) {
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
                showCards={isShowdown && !player.isFolded}
                isHuman={player.isHuman}
                isWinner={isWinner}
                handName={handName}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PokerTable;
