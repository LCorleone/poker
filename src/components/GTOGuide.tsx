import React from 'react';
import { GTOAdvice, POSITION_NAMES, Position } from '../engine/gto';

interface GTOGuideProps {
  advice: GTOAdvice;
  position: Position;
}

const ACTION_CONFIG: Record<string, { label: string; icon: string; borderColor: string; bg: string }> = {
  raise: { label: '加注', icon: '💪', borderColor: '#4caf50', bg: 'rgba(76, 175, 80, 0.12)' },
  call: { label: '跟注', icon: '🤔', borderColor: '#ff9800', bg: 'rgba(255, 152, 0, 0.12)' },
  fold: { label: '弃牌', icon: '🛑', borderColor: '#f44336', bg: 'rgba(244, 67, 54, 0.12)' },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  strong: '明确',
  marginal: '边缘',
  weak: '勉强',
};

const GTOGuide: React.FC<GTOGuideProps> = ({ advice, position }) => {
  const cfg = ACTION_CONFIG[advice.action];

  return (
    <div
      className="gto-guide"
      style={{ borderLeftColor: cfg.borderColor, background: cfg.bg }}
    >
      <div className="gto-header">
        <span className="gto-icon">📌</span>
        <span className="gto-title">GTO建议</span>
        <span className="gto-divider">|</span>
        <span className="gto-position">位置: {POSITION_NAMES[position]}</span>
        <span className="gto-divider">|</span>
        <span className="gto-tier">手牌: {advice.handTier}</span>
      </div>
      <div className="gto-action-row">
        <span className="gto-action-label">
          建议: <strong style={{ color: cfg.borderColor }}>{cfg.label}</strong> {cfg.icon}
        </span>
        <span className="gto-confidence" style={{ color: cfg.borderColor }}>
          [{CONFIDENCE_LABEL[advice.confidence]}]
        </span>
      </div>
      <div className="gto-explanation">{advice.explanation}</div>
    </div>
  );
};

export default GTOGuide;
