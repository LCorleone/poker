import React, { useState, useEffect } from 'react';
import { Card } from '../engine/types';
import { rankToString, suitToSymbol } from '../engine/deck';

interface CardProps {
  card?: Card;
  faceDown?: boolean;
  small?: boolean;
  animate?: boolean;
}

const CardComponent: React.FC<CardProps> = ({ card, faceDown, small, animate }) => {
  const [dealt, setDealt] = useState(!animate);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setDealt(true), 50);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  if (faceDown || !card) {
    return (
      <div className={`card card-back${small ? ' card-small' : ''}${animate && !dealt ? ' card-dealing' : ''}`}>
        <div className="card-back-pattern">🂠</div>
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const symbol = suitToSymbol(card.suit);
  const rank = rankToString(card.rank);

  return (
    <div className={`card${small ? ' card-small' : ''}${isRed ? ' card-red' : ' card-black'}${animate && !dealt ? ' card-dealing' : ''}`}>
      <div className="card-rank">{rank}</div>
      <div className="card-suit">{symbol}</div>
      <div className="card-center">{symbol}</div>
    </div>
  );
};

export default CardComponent;
