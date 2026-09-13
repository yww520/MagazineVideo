import React from 'react';
import { COLORS, HEIGHT, WIDTH } from '../theme';

export const PageGround: React.FC = () => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: COLORS.green,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 90% 70% at 18% -8%, rgba(64,78,52,0.55) 0%, rgba(14,29,24,0) 62%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(22,36,28,0.35) 0%, rgba(14,29,24,0) 42%, rgba(8,16,12,0.55) 100%)',
        }}
      />
      <svg width={WIDTH} height={HEIGHT} style={{ position: 'absolute', inset: 0, opacity: 0.04 }}>
        {Array.from({ length: 48 }).map((_, i) => (
          <circle
            key={i}
            cx={(i * 167) % WIDTH}
            cy={(i * 97) % HEIGHT}
            r={i % 5 === 0 ? 1.6 : 0.8}
            fill={COLORS.oat}
          />
        ))}
      </svg>
    </>
  );
};
