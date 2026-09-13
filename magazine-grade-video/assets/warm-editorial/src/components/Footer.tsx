import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS, ML, MR, WIDTH } from '../theme';
import type { LyricContent } from '../../../types';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

export const Footer: React.FC<{ content: LyricContent }> = ({ content }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const progress = Math.min(1, t / content.durationSec);
  const w = WIDTH - ML - MR;

  return (
    <div style={{ position: 'absolute', left: ML, bottom: 40, width: w }}>
      <div style={{ position: 'relative', height: 1, background: COLORS.hairline }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: 1,
            width: `${progress * 100}%`,
            background: COLORS.coral,
            opacity: 0.9,
          }}
        />
      </div>

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FONTS.mono,
          fontSize: 15,
          letterSpacing: 1.5,
          color: COLORS.ink,
          opacity: 0.6,
        }}
      >
        <span>
          {fmt(t)} / {fmt(content.durationSec)}
        </span>
        <span>{content.footerRight}</span>
      </div>
    </div>
  );
};
