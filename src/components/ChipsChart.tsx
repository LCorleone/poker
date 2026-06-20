import React from 'react';
import { HandHistoryEntry } from '../ai/competitionStore';

interface ChipsChartProps {
  history: HandHistoryEntry[];
  startingChips: number;
  playerNames: string[];   // index-aligned with playerId (0..N-1)
}

// Fixed palette cycled by player index. Gold first to match the app accent.
const COLORS = ['#ffd700', '#64b5f6', '#4caf50', '#f44336', '#ce93d8', '#ff9800'];

// Internal coordinate system. The SVG scales to its container via viewBox;
// we keep the aspect close to the narrow overlay-panel aspect (~1:1) so the
// default 'meet' scaling has minimal letterboxing.
const VW = 320;
const VH = 280;
const PAD = { left: 40, right: 12, top: 12, bottom: 24 };

type Point = { hand: number; chips: number };

const ChipsChart: React.FC<ChipsChartProps> = ({ history, startingChips, playerNames }) => {
  if (history.length === 0) {
    return (
      <>
        <div className="cc-title">📈 筹码走势</div>
        <div className="cc-empty">暂无数据，开始对战后显示走势</div>
      </>
    );
  }

  const playerCount = playerNames.length;
  const maxHand = history[history.length - 1].handNumber;

  // One series per player. Every series begins with a synthetic hand-0 point
  // at startingChips, so all lines share a common origin. For each finished
  // hand we append a point only if the player was present in that snapshot —
  // eliminated players simply stop appearing, so their line ends at their
  // last hand instead of dragging flat to the end.
  const series: Point[][] = Array.from({ length: playerCount }, () => [
    { hand: 0, chips: startingChips },
  ]);
  const lastEliminated: boolean[] = new Array(playerCount).fill(false);

  for (const entry of history) {
    for (let pid = 0; pid < playerCount; pid++) {
      const p = entry.players.find(pl => pl.playerId === pid);
      if (!p) continue;                 // not present this hand — line ends naturally
      series[pid].push({ hand: entry.handNumber, chips: p.chipsAfter });
      lastEliminated[pid] = p.isEliminated || p.chipsAfter <= 0;
    }
  }

  // Y range: always anchor at 0, and include startingChips + the observed
  // peak so the chart frames the action.
  let maxChips = startingChips;
  for (const s of series) {
    for (const pt of s) {
      if (pt.chips > maxChips) maxChips = pt.chips;
    }
  }
  const minChips = 0;
  if (maxChips === minChips) maxChips = 1;   // avoid divide-by-zero

  const chartLeft = PAD.left;
  const chartRight = VW - PAD.right;
  const chartTop = PAD.top;
  const chartBottom = VH - PAD.bottom;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  const xFor = (hand: number) => (maxHand <= 0 ? chartLeft : chartLeft + (hand / maxHand) * chartW);
  const yFor = (chips: number) =>
    chartBottom - ((chips - minChips) / (maxChips - minChips)) * chartH;

  // Dots get noisy on long games; only render them for short ones.
  const showDots = history.length <= 30;

  // Y gridlines at max / mid / 0.
  const gridVals = [maxChips, Math.round((maxChips + minChips) / 2), minChips];

  // X labels: always first + last, plus a few in between for longer games.
  const xLabels: number[] = [0, maxHand];
  if (maxHand >= 4) {
    const step = Math.max(1, Math.ceil(maxHand / 4));
    for (let h = step; h < maxHand; h += step) xLabels.push(h);
  }

  return (
    <>
      <div className="cc-title">📈 筹码走势</div>
      <div className="cc-subtitle">
        起始 {startingChips} · {history.length} 手
      </div>

      <svg className="cc-svg" viewBox={`0 0 ${VW} ${VH}`}>
        {/* Horizontal gridlines + y-axis labels */}
        {gridVals.map((v, i) => {
          const y = yFor(v);
          return (
            <g key={`grid-${i}`}>
              <line className="cc-grid" x1={chartLeft} y1={y} x2={chartRight} y2={y} />
              <text className="cc-axis-label" x={chartLeft - 6} y={y + 3} textAnchor="end">
                {v}
              </text>
            </g>
          );
        })}
        {/* X-axis baseline */}
        <line className="cc-grid" x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} />
        {/* X-axis labels */}
        {xLabels.map((h, i) => (
          <text
            key={`xlabel-${i}`}
            className="cc-axis-label"
            x={xFor(h)}
            y={chartBottom + 14}
            textAnchor="middle"
          >
            {h}
          </text>
        ))}
        {/* One line (+ optional dots) per player */}
        {series.map((s, pid) => {
          if (s.length < 2) return null;
          const color = COLORS[pid % COLORS.length];
          const pts = s.map(pt => `${xFor(pt.hand)},${yFor(pt.chips)}`).join(' ');
          return (
            <g key={`series-${pid}`}>
              <polyline className="cc-line" points={pts} stroke={color} />
              {showDots &&
                s.map((pt, idx) => (
                  <circle
                    key={idx}
                    className="cc-dot"
                    cx={xFor(pt.hand)}
                    cy={yFor(pt.chips)}
                    r={2.5}
                    fill={color}
                  />
                ))}
            </g>
          );
        })}
      </svg>

      <div className="cc-legend">
        {Array.from({ length: playerCount }, (_, pid) => {
          const s = series[pid];
          const lastChips = s[s.length - 1].chips;
          const eliminated = lastEliminated[pid];
          return (
            <div key={pid} className={`cc-legend-row${eliminated ? ' eliminated' : ''}`}>
              <span
                className="cc-legend-swatch"
                style={{ background: COLORS[pid % COLORS.length] }}
              />
              <span className="cc-legend-name">{playerNames[pid]}</span>
              <span className="cc-legend-chips">{lastChips}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ChipsChart;
