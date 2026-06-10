import React, { useState } from 'react';
import { HandRank } from '../engine/types';

interface RankInfo {
  rank: HandRank;
  name: string;
  example: string;
  description: string;
}

const HAND_RANKS: RankInfo[] = [
  { rank: HandRank.ROYAL_FLUSH, name: '皇家同花顺', example: 'A♥ K♥ Q♥ J♥ T♥', description: '同花色的A K Q J T，最强牌型' },
  { rank: HandRank.STRAIGHT_FLUSH, name: '同花顺', example: '9♠ 8♠ 7♠ 6♠ 5♠', description: '同花色的五张连续牌' },
  { rank: HandRank.FOUR_OF_A_KIND, name: '四条', example: 'Q♥ Q♦ Q♣ Q♠ 7♣', description: '四张相同点数的牌' },
  { rank: HandRank.FULL_HOUSE, name: '葫芦', example: 'J♥ J♦ J♣ 4♠ 4♣', description: '三条加一对' },
  { rank: HandRank.FLUSH, name: '同花', example: 'A♦ J♦ 8♦ 5♦ 2♦', description: '五张相同花色的牌' },
  { rank: HandRank.STRAIGHT, name: '顺子', example: 'T♠ 9♥ 8♦ 7♣ 6♠', description: '五张连续点数的牌（花色不同）' },
  { rank: HandRank.THREE_OF_A_KIND, name: '三条', example: '7♥ 7♦ 7♣ K♠ 3♣', description: '三张相同点数的牌' },
  { rank: HandRank.TWO_PAIR, name: '两对', example: 'A♥ A♦ 5♣ 5♠ T♦', description: '两组对子' },
  { rank: HandRank.ONE_PAIR, name: '一对', example: 'K♥ K♦ 9♣ 6♠ 2♦', description: '两张相同点数的牌' },
  { rank: HandRank.HIGH_CARD, name: '高牌', example: 'A♠ J♦ 8♣ 5♥ 2♠', description: '无以上组合，以最大单牌论大小' },
];

const HandRankRef: React.FC = () => {
  const [visible, setVisible] = useState(false);

  if (!visible) {
    return (
      <button
        className="handref-toggle"
        onClick={() => setVisible(true)}
        title="牌型参考"
      >
        📋
      </button>
    );
  }

  return (
    <div className="handref-overlay" onClick={() => setVisible(false)}>
      <div className="handref-panel" onClick={e => e.stopPropagation()}>
        <div className="handref-header">
          <span className="handref-title">📋 牌型大小参考</span>
          <button className="handref-close" onClick={() => setVisible(false)}>✕</button>
        </div>
        <div className="handref-list">
          {HAND_RANKS.map((h, i) => (
            <div key={h.rank} className="handref-item">
              <div className="handref-rank">#{i + 1}</div>
              <div className="handref-info">
                <div className="handref-name">{h.name}</div>
                <div className="handref-example">{h.example}</div>
                <div className="handref-desc">{h.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HandRankRef;
