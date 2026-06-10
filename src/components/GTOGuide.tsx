import React from 'react';
import { GTOAdvice, POSITION_NAMES, Position, PostFlopAdvice } from '../engine/gto';

interface GTOGuideProps {
  advice?: GTOAdvice;
  position: Position;
  postFlopAdvice?: PostFlopAdvice;
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

const POSTFLOP_ACTION_LABELS: Record<string, string> = {
  bet: '下注',
  check: '过牌',
  call: '跟注',
  fold: '弃牌',
  raise: '加注',
};

function getActionColor(action: string): string {
  switch (action) {
    case 'bet': case 'raise': return '#4caf50';
    case 'call': return '#ff9800';
    case 'fold': return '#f44336';
    default: return '#fff';
  }
}

const GTOGuide: React.FC<GTOGuideProps> = ({ advice, position, postFlopAdvice }) => {
  const cfg = advice ? ACTION_CONFIG[advice.action] : null;

  return (
    <div
      className="gto-guide"
      style={{ borderLeftColor: cfg?.borderColor ?? '#4caf50', background: cfg?.bg ?? 'rgba(76, 175, 80, 0.12)' }}
    >
      <div className="gto-header">
        <span className="gto-icon">📌</span>
        <span className="gto-title">GTO建议</span>
        <span className="gto-divider">|</span>
        <span className="gto-position">位置: {POSITION_NAMES[position]}</span>
        {advice && (
          <>
            <span className="gto-divider">|</span>
            <span className="gto-tier">手牌: {advice.handTier}</span>
          </>
        )}
      </div>
      {cfg && advice && (
        <>
          <div className="gto-action-row">
            <span className="gto-action-label">
              建议: <strong style={{ color: cfg.borderColor }}>{cfg.label}</strong> {cfg.icon}
            </span>
            <span className="gto-confidence" style={{ color: cfg.borderColor }}>
              [{CONFIDENCE_LABEL[advice.confidence]}]
            </span>
          </div>
          <div className="gto-explanation">{advice.explanation}</div>
        </>
      )}
      {postFlopAdvice && (
        <>
          <div style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
            <div className="gto-action-row">
              <span className="gto-action-label">
                翻后建议: <strong style={{ color: getActionColor(postFlopAdvice.action) }}>{POSTFLOP_ACTION_LABELS[postFlopAdvice.action] || postFlopAdvice.action}</strong>
              </span>
              <span className="gto-tier" style={{ marginLeft: '8px' }}>
                牌面: {postFlopAdvice.boardTexture}
              </span>
            </div>
            <div className="gto-explanation">{postFlopAdvice.explanation}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default GTOGuide;
