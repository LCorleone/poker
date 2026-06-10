import React from 'react';
import { Card } from '../engine/types';
import { countOuts } from '../engine/evaluate';

interface PotOddsDisplayProps {
  holeCards: Card[];
  communityCards: Card[];
  pot: number;
  toCall: number;
  phase: string;
  isHumanTurn: boolean;
}

const PotOddsDisplay: React.FC<PotOddsDisplayProps> = ({
  holeCards,
  communityCards,
  pot,
  toCall,
  phase,
  isHumanTurn,
}) => {
  // Only show when there are community cards and it's a meaningful moment
  if (!isHumanTurn || holeCards.length === 0 || phase === 'waiting' || phase === 'showdown') {
    return null;
  }

  const potOdds = pot > 0 && toCall > 0 ? toCall / (pot + toCall) : 0;
  const outs = countOuts(holeCards, communityCards);
  
  // Rule of 4 and 2 for equity from outs
  const cardsToCome = phase === 'flop' ? 2 : phase === 'turn' ? 1 : 0;
  const outsEquity = cardsToCome > 0 ? (outs * (cardsToCome === 2 ? 4 : 2)) / 100 : 0;
  
  const isProfitableCall = toCall > 0 && outsEquity > potOdds;

  return (
    <div className="pot-odds-panel">
      <div className="pot-odds-title">📊 底池赔率 &amp; 出牌</div>
      <div className="pot-odds-grid">
        <div className="pot-odds-item">
          <span className="pot-odds-label">底池</span>
          <span className="pot-odds-value">{pot}</span>
        </div>
        {toCall > 0 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label">需跟注</span>
            <span className="pot-odds-value">{toCall}</span>
          </div>
        )}
        {toCall > 0 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label">底池赔率</span>
            <span className="pot-odds-value">{Math.round(potOdds * 100)}%</span>
          </div>
        )}
        {communityCards.length >= 3 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label">出牌数</span>
            <span className="pot-odds-value">{outs}</span>
          </div>
        )}
        {outs > 0 && cardsToCome > 0 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label">出牌赢率</span>
            <span className="pot-odds-value">~{Math.round(outsEquity * 100)}%</span>
          </div>
        )}
      </div>
      {toCall > 0 && outs > 0 && cardsToCome > 0 && (
        <div className={`pot-odds-verdict ${isProfitableCall ? 'profitable' : 'unprofitable'}`}>
          {isProfitableCall
            ? `✅ 出牌赢率(${Math.round(outsEquity * 100)}%) > 底池赔率(${Math.round(potOdds * 100)}%)，跟注正期望`
            : `⚠️ 出牌赢率(${Math.round(outsEquity * 100)}%) < 底池赔率(${Math.round(potOdds * 100)}%)，跟注负期望`}
        </div>
      )}
    </div>
  );
};

export default PotOddsDisplay;
