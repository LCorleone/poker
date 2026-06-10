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
          <span className="pot-odds-label"><span className="tip" data-tip="当前底池的总金额">底池</span></span>
          <span className="pot-odds-value">{pot}</span>
        </div>
        {toCall > 0 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label"><span className="tip" data-tip="你需要追加的金额才能继续留在手牌中">需跟注</span></span>
            <span className="pot-odds-value">{toCall}</span>
          </div>
        )}
        {toCall > 0 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label"><span className="tip" data-tip={"底池赔率 = 需跟注金额 ÷ (底池 + 需跟注金额)\n代表你需要多少赢率才能盈亏平衡"}>底池赔率</span></span>
            <span className="pot-odds-value">{Math.round(potOdds * 100)}%</span>
          </div>
        )}
        {communityCards.length >= 3 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label"><span className="tip" data-tip={"能让你牌力升级的剩余牌数\n例如：你有4张同花，还剩9张同花牌可以成同花"}>出牌数</span></span>
            <span className="pot-odds-value">{outs}</span>
          </div>
        )}
        {outs > 0 && cardsToCome > 0 && (
          <div className="pot-odds-item">
            <span className="pot-odds-label"><span className="tip" data-tip={"根据出牌数用4×2规则估算\n翻牌圈：出牌数×4%\n转牌圈：出牌数×2%"}>出牌赢率</span></span>
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
