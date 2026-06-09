import React, { useState } from 'react';
import { GameAction } from '../engine/types';

interface ActionBarProps {
  availableActions: GameAction[];
  raiseRange: { min: number; max: number };
  currentBet: number;
  playerChips: number;
  playerCurrentBet: number;
  onAction: (action: GameAction) => void;
  disabled: boolean;
}

const ActionBar: React.FC<ActionBarProps> = ({
  availableActions,
  raiseRange,
  currentBet,
  playerChips,
  playerCurrentBet,
  onAction,
  disabled,
}) => {
  const [raiseAmount, setRaiseAmount] = useState(raiseRange.min);

  // Update raise amount when range changes
  React.useEffect(() => {
    setRaiseAmount(raiseRange.min);
  }, [raiseRange.min]);

  if (availableActions.length === 0 || disabled) return null;

  const toCall = currentBet - playerCurrentBet;

  const handleRaise = () => {
    onAction({ type: 'raise', amount: raiseAmount });
  };

  return (
    <div className="action-bar">
      {availableActions.some(a => a.type === 'fold') && (
        <button className="btn btn-fold" onClick={() => onAction({ type: 'fold' })} disabled={disabled}>
          弃牌
        </button>
      )}

      {availableActions.some(a => a.type === 'check') && (
        <button className="btn btn-check" onClick={() => onAction({ type: 'check' })} disabled={disabled}>
          过牌
        </button>
      )}

      {availableActions.some(a => a.type === 'call') && (
        <button className="btn btn-call" onClick={() => onAction({ type: 'call' })} disabled={disabled}>
          跟注 {toCall}
        </button>
      )}

      {availableActions.some(a => a.type === 'raise') && (
        <div className="raise-control">
          <input
            type="range"
            min={raiseRange.min}
            max={raiseRange.max}
            value={raiseAmount}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            className="raise-slider"
          />
          <span className="raise-amount">{raiseAmount}</span>
          <button className="btn btn-raise" onClick={handleRaise} disabled={disabled}>
            加注到 {raiseAmount}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActionBar;
