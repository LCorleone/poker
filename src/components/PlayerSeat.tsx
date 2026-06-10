import React from 'react';
import { Player, AIPersona } from '../engine/types';
import { PERSONA_INFO } from '../ai/strategy';
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
      <div className="player-chips">筹码: {player.chips}</div>
      {!isHuman && player.persona && (
        <div className="persona-label">
          {PERSONA_INFO[player.persona].label} · {PERSONA_INFO[player.persona].style}
        </div>
      )}
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
        <div className="player-bet">下注: {player.currentBet}</div>
      )}
      {player.isFolded && <div className="folded-overlay">弃牌</div>}
      {lastThought && !player.isFolded && (
        <div className="thought-bubble">
          💭 {lastThought}
        </div>
      )}
      {isWinner && handName && (
        <div className="winner-hand">{handName}</div>
      )}
    </div>
  );
};

export default PlayerSeat;
