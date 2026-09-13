import React from 'react';
import { COLORS, FONTS, ML, MR, HEADER_TOP, WIDTH, CONTENT_W } from '../theme';
import type { LyricContent } from '../../../types';

const titleSize = (title: string) => {
  const max = 46;
  const min = 32;
  const fitted = Math.floor(CONTENT_W / (title.length * 1.05));
  return Math.max(min, Math.min(max, fitted));
};

export const Header: React.FC<{ content: LyricContent }> = ({ content }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: HEADER_TOP,
        left: ML,
        width: WIDTH - ML - MR,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: FONTS.mono,
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: 2,
          color: COLORS.ink,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: 0.88 }}>
          <span style={{ fontSize: 13, color: COLORS.coral }}>✱</span>
          <span>{content.kicker}</span>
        </div>
        <span style={{ opacity: 0.5 }}>{content.source}</span>
      </div>

      <div
        style={{
          marginTop: 16,
          fontFamily: FONTS.serif,
          fontSize: titleSize(content.title),
          fontWeight: 500,
          lineHeight: 1.1,
          letterSpacing: -1,
          color: COLORS.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {content.title}
      </div>

      <div style={{ marginTop: 18, height: 1, width: '100%', background: COLORS.hairline }} />
      <div style={{ width: 52, height: 2, marginTop: -1, background: COLORS.coral }} />
    </div>
  );
};
