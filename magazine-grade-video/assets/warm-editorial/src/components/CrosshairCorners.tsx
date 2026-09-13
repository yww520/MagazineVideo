import React from 'react';
import { COLORS } from '../theme';

const Crosshair: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const arm = 13;
  return (
    <g>
      <line x1={x - arm} y1={y} x2={x + arm} y2={y} stroke={COLORS.ink} strokeWidth={1} opacity={0.34} />
      <line x1={x} y1={y - arm} x2={x} y2={y + arm} stroke={COLORS.ink} strokeWidth={1} opacity={0.34} />
    </g>
  );
};

export const CrosshairCorners: React.FC<{ w: number; h: number; pad?: number }> = ({
  w,
  h,
  pad = 26,
}) => {
  return (
    <svg width={w} height={h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Crosshair x={pad} y={pad} />
      <Crosshair x={w - pad} y={pad} />
      <Crosshair x={pad} y={h - pad} />
      <Crosshair x={w - pad} y={h - pad} />
    </svg>
  );
};
