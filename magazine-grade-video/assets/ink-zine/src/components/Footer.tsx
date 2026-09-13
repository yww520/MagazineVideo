import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS, ML, WIDTH } from '../theme';
import type { LyricContent } from '../../../types';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

export const Footer: React.FC<{ content: LyricContent }> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const progress = Math.min(1, t / content.durationSec);
  const w = WIDTH - ML * 2;
  const played = Math.max(0, w * progress);

  return (
    <div style={{ position: 'absolute', left: ML, bottom: 36, width: w }}>
      <div style={{ position: 'relative', height: 12 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 5,
            height: 2,
            background: COLORS.oat,
            opacity: 0.22,
            borderRadius: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 5,
            width: played,
            height: 2,
            background: COLORS.coral,
            borderRadius: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: Math.max(0, played - 6),
            top: 0,
            width: 12,
            height: 12,
            borderRadius: 6,
            background: COLORS.coral,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FONTS.display,
          fontSize: 13,
          fontWeight: 400,
          color: COLORS.oat,
          opacity: 0.38,
          letterSpacing: 1,
        }}
      >
        <span>{fmt(t)}</span>
        <span>{fmt(content.durationSec)}</span>
      </div>
      <div
        style={{
          marginTop: 18,
          textAlign: 'center',
          fontFamily: FONTS.display,
          fontSize: 14,
          fontWeight: 400,
          letterSpacing: 2.4,
          color: COLORS.oat,
          opacity: 0.32,
        }}
      >
        {content.footerRight}
      </div>
    </div>
  );
};
