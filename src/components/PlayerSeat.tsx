import React from 'react';
import { Player } from '../engine/types';
import { evaluateHand } from '../engine/evaluate';
import CardComponent from './Card';

interface PlayerSeatProps {
  player: Player;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isCurrentTurn: boolean;
  showCards: boolean; // show hole cards face-up?
  isHuman: boolean;
  isWinner: boolean;
  handName?: string;
  lastThought?: string;
  lastAction?: string;
  equity?: number;
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isCurrentTurn,
  showCards,
  isHuman,
  isWinner,
  handName,
  lastThought,
  lastAction,
  equity,
}) => {
  if (player.isEliminated) {
    return (
      <div className="player-seat eliminated">
        <div className="player-name">{player.name}</div>
        <div className="player-chips eliminated-text">已淘汰</div>
      </div>
    );
  }

  const cards = player.holeCards;
  const showHoleCards = isHuman || showCards;

  return (
    <div className={`player-seat${isCurrentTurn ? ' active' : ''}${player.isFolded ? ' folded' : ''}${isWinner ? ' winner' : ''}`}>
      {isDealer && <div className="dealer-btn">D</div>}
      {isSmallBlind && !isDealer && <div className="blind-btn sb-btn">SB</div>}
      {isBigBlind && <div className="blind-btn bb-btn">BB</div>}
      <div className="player-name">
        {player.name}
        {player.isAllIn && <span className="allin-badge">全下</span>}
      </div>
      <div className="player-chips"><span className="tip" data-tip="玩家当前剩余的筹码数量">筹码:</span> {player.chips}</div>
      {/* Persona hidden from user — must learn through play */}
      {cards.length > 0 && (
        <div className="player-cards">
          {cards.map((card, i) => (
            <CardComponent
              key={i}
              card={card}
              faceDown={!showHoleCards}
              small={!isHuman}
            />
          ))}
        </div>
      )}
      {player.currentBet > 0 && (
        <div className="player-bet"><span className="tip" data-tip="本轮下注的金额">下注:</span> {player.currentBet}</div>
      )}
      {lastAction === 'check' && player.currentBet === 0 && !player.isFolded && (
        <div className="player-bet check-badge">过牌</div>
      )}
      {player.isFolded && <div className="folded-overlay">弃牌</div>}
      {/* Show evaluated hand name + win probability when cards are visible */}
      {((handName && showCards) || (equity !== undefined && equity > 0)) && (
        <div className="hand-info-row">
          {handName && showCards && <span className="winner-hand">{handName}</span>}
          {equity !== undefined && equity > 0 && (
            <span className={`equity-badge ${equity >= 0.5 ? 'equity-high' : equity >= 0.25 ? 'equity-mid' : 'equity-low'}`}>
              {(equity * 100).toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerSeat;
