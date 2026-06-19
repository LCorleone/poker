import React, { useState } from 'react';
import { GameAction } from '../engine/types';

interface ActionBarProps {
  availableActions: GameAction[];
  raiseRange: { min: number; max: number };
  currentBet: number;
  playerChips: number;
  playerCurrentBet: number;
  pot: number;
  onAction: (action: GameAction) => void;
  disabled: boolean;
}

const ActionBar: React.FC<ActionBarProps> = ({
  availableActions,
  raiseRange,
  currentBet,
  playerChips,
  playerCurrentBet,
  pot,
  onAction,
  disabled,
}) => {
  const [raiseAmount, setRaiseAmount] = useState(raiseRange.min);
  const [showPresets, setShowPresets] = useState(false);

  // Reset raise amount when it's a new turn (availableActions changes)
  React.useEffect(() => {
    setRaiseAmount(raiseRange.min);
  }, [availableActions, raiseRange.min]);

  if (availableActions.length === 0 || disabled) return null;

  const round10 = (n: number) => Math.round(n / 10) * 10;
  const clampedRaiseAmount = Math.min(Math.max(round10(raiseAmount), raiseRange.min), raiseRange.max);
  const toCall = currentBet - playerCurrentBet;

  const handleRaise = () => {
    onAction({ type: 'raise', amount: raiseAmount });
  };

  const handlePresetRaise = (amount: number) => {
    const clamped = Math.min(Math.max(amount, raiseRange.min), raiseRange.max);
    setRaiseAmount(clamped);
    setShowPresets(false);
  };

  // Calculate preset amounts (these are total bet amounts, not additional)
  const hasRaise = availableActions.some(a => a.type === 'raise');

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

      {hasRaise && (
        <div className="raise-control">
          <button
            className={`btn btn-presets-toggle ${showPresets ? 'active' : ''}`}
            onClick={() => setShowPresets(!showPresets)}
          >
            📐 快捷
          </button>

          {showPresets && (
            <div className="raise-presets">
              <button
                className="btn-preset"
                onClick={() => handlePresetRaise(round10(currentBet + pot * 0.5))}
                disabled={round10(currentBet + pot * 0.5) > raiseRange.max}
              >
                ½底池 {round10(currentBet + pot * 0.5)}
              </button>
              <button
                className="btn-preset"
                onClick={() => handlePresetRaise(round10(currentBet + pot * 0.75))}
                disabled={round10(currentBet + pot * 0.75) > raiseRange.max}
              >
                ¾底池 {round10(currentBet + pot * 0.75)}
              </button>
              <button
                className="btn-preset"
                onClick={() => handlePresetRaise(round10(currentBet + pot))}
                disabled={round10(currentBet + pot) > raiseRange.max}
              >
                底池 {round10(currentBet + pot)}
              </button>
              <button
                className="btn-preset btn-preset-allin"
                onClick={() => handlePresetRaise(raiseRange.max)}
              >
                全下 {raiseRange.max}
              </button>
            </div>
          )}

          <input
            type="number"
            min={raiseRange.min}
            max={raiseRange.max}
            value={raiseAmount}
            onChange={e => {
              const v = Number(e.target.value);
              if (!isNaN(v)) setRaiseAmount(v);
            }}
            onBlur={() => {
              // Clamp on blur
              const clamped = Math.min(Math.max(round10(raiseAmount), raiseRange.min), raiseRange.max);
              setRaiseAmount(clamped);
            }}
            className="raise-input"
            step={10}
          />
          <button className="btn btn-raise" onClick={() => {
            setRaiseAmount(clampedRaiseAmount);
            onAction({ type: 'raise', amount: clampedRaiseAmount });
          }} disabled={disabled}>
            加注到 {clampedRaiseAmount}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActionBar;
