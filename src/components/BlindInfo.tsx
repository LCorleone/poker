import React from 'react';

interface BlindInfoProps {
  level: number;
  small: number;
  big: number;
  handsUntilNext: number;
  totalLevels: number;
  handNumber: number;
}

const BlindInfo: React.FC<BlindInfoProps> = ({ level, small, big, handsUntilNext, totalLevels, handNumber }) => {
  return (
    <div className="blind-info">
      <span className="blind-level">级别 {level}/{totalLevels}</span>
      <span className="blind-amounts">盲注: {small}/{big}</span>
      <span className="blind-progress">
        <span className="blind-bar" style={{ width: handsUntilNext > 0 ? `${((10 - handsUntilNext) / 10) * 100}%` : '100%' }} />
      </span>
      <span className="blind-hands">{handsUntilNext > 0 ? `还剩 ${handsUntilNext} 手升级` : '最高级别'}</span>
    </div>
  );
};

export default BlindInfo;
